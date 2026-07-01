#!/usr/bin/env node
/**
 * Codex hook: PostToolUse — MCP tools only, observe-only by policy
 *
 * Fires after an MCP tool produced output. Scans the tool input + response
 * via Prisma AIRS for audit; violations are logged and warned on stderr but
 * never block (Codex CAN block PostToolUse — this project chooses observe).
 *
 * Codex contract:
 *   stdin  → JSON { tool_name, tool_use_id, tool_input, tool_response, ... }
 *   stdout → nothing (observe-only)
 *   stderr → diagnostics
 */
import { loadConfig } from "../config.js";
import { Logger } from "../logger.js";
import { scanToolEvent } from "../scanner.js";
import { applyContentLimits, DEFAULT_CONTENT_LIMITS } from "../content-limits.js";
import { isMcpToolName } from "../tool-name-parser.js";
import { readStdin, normalize, buildCorrelation } from "./shared.js";
import type { CodexPostToolUseInput } from "../types.js";

async function main(): Promise<void> {
  const raw = await readStdin();

  let input: CodexPostToolUseInput;
  try {
    input = JSON.parse(raw);
  } catch {
    console.error("[AIRS] Failed to parse hook stdin as JSON.");
    return;
  }

  const toolName = input.tool_name ?? "";

  // MCP-only by design: Bash and apply_patch outputs are not scanned
  if (!isMcpToolName(toolName)) {
    return;
  }

  let config;
  try {
    config = loadConfig();
  } catch (err) {
    console.error(`[AIRS] Config error: ${err}`);
    return;
  }

  const logger = new Logger(config.logging.path, config.logging.include_content);
  const limits = config.content_limits ?? DEFAULT_CONTENT_LIMITS;

  const toolInput = normalize(input.tool_input);
  const toolResponse = normalize(input.tool_response);
  if (!toolInput.trim() && !toolResponse.trim()) {
    return;
  }

  const limitedInput = applyContentLimits(toolInput, limits);
  const limitedResponse = applyContentLimits(toolResponse, limits);
  if (limitedInput.skipped && limitedResponse.skipped) {
    logger.logEvent("scan_skipped_size_limit", { direction: "tool", tool: toolName });
    return;
  }

  const result = await scanToolEvent(
    config,
    toolName,
    limitedInput.skipped ? undefined : limitedInput.content,
    limitedResponse.skipped ? undefined : limitedResponse.content,
    logger,
    buildCorrelation(input),
  );

  // Observe-only by policy — log violations, warn, never block
  if (result.action === "block") {
    console.error(`[AIRS] PostToolUse violation detected for tool=${toolName} (observe-only by policy).`);
  }
}

main().catch((err) => {
  console.error(`[AIRS] Unhandled hook error: ${err}`);
});
