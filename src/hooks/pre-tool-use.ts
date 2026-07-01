#!/usr/bin/env node
/**
 * Codex hook: PreToolUse (can block) — MCP tools only
 *
 * Scans MCP tool inputs via Prisma AIRS before the tool executes.
 * Registered with matcher "mcp__.*"; non-MCP tools (Bash, apply_patch) are
 * intentionally not scanned and pass through untouched even if Codex sends
 * them here.
 *
 * Codex contract:
 *   stdin  → JSON { tool_name, tool_use_id, tool_input, session_id, turn_id, ... }
 *   stdout → nothing to allow; hookSpecificOutput.permissionDecision:"deny" to block.
 *            Never emit continue/stopReason/suppressOutput — Codex marks the
 *            hook run failed and continues the tool call.
 *   stderr → diagnostics
 */
import { loadConfig, readFailMode } from "../config.js";
import { Logger } from "../logger.js";
import { scanToolEvent } from "../scanner.js";
import { applyContentLimits, DEFAULT_CONTENT_LIMITS } from "../content-limits.js";
import { isMcpToolName } from "../tool-name-parser.js";
import { preToolUseDeny, writeOutput } from "../adapters/codex-adapter.js";
import { readStdin, normalize, buildCorrelation } from "./shared.js";
import type { PreToolUseInput } from "../types.js";

/** Allow = exit 0 with no stdout (PreToolUse rejects continue:true JSON) */
function allowThrough(): void {}

function denyTool(reason: string): void {
  writeOutput(preToolUseDeny(reason));
}

async function main(): Promise<void> {
  const raw = await readStdin();

  let input: PreToolUseInput;
  try {
    input = JSON.parse(raw);
  } catch {
    console.error("[AIRS] Failed to parse hook stdin as JSON, allowing through.");
    allowThrough();
    return;
  }

  const toolName = input.tool_name ?? "";

  // MCP-only by design: Bash and apply_patch are not scanned
  if (!isMcpToolName(toolName)) {
    allowThrough();
    return;
  }

  let config;
  try {
    config = loadConfig();
  } catch (err) {
    console.error(`[AIRS] Config error: ${err}`);
    if (readFailMode() === "closed") {
      denyTool("Prisma AIRS is not configured and fail_mode is closed. Fix the AIRS hook configuration to run MCP tools.");
    } else {
      allowThrough();
    }
    return;
  }

  const logger = new Logger(config.logging.path, config.logging.include_content);

  const inputStr = normalize(input.tool_input);
  if (!inputStr.trim() || inputStr === "{}") {
    allowThrough();
    return;
  }

  const limits = config.content_limits ?? DEFAULT_CONTENT_LIMITS;
  const limited = applyContentLimits(inputStr, limits);
  if (limited.skipped) {
    logger.logEvent("scan_skipped_size_limit", { direction: "tool", tool: toolName });
    allowThrough();
    return;
  }

  const result = await scanToolEvent(
    config, toolName, limited.content, undefined, logger, buildCorrelation(input),
  );

  if (result.action === "block") {
    denyTool(result.message ?? `Prisma AIRS blocked MCP tool call: ${toolName}`);
    return;
  }

  allowThrough();
}

main().catch((err) => {
  console.error(`[AIRS] Unhandled hook error: ${err}`);
});
