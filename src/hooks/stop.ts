#!/usr/bin/env node
/**
 * Codex hook: Stop (post-stream)
 *
 * Fires when a turn stops, after the response has already streamed to the
 * user. Scans the final assistant message (natural language + extracted
 * code) via Prisma AIRS. On an AIRS block verdict the turn is terminated
 * with continue:false — the content was already displayed, but the session
 * does not keep building on it.
 *
 * Codex contract:
 *   stdin  → JSON { last_assistant_message, stop_hook_active, session_id, turn_id, ... }
 *   stdout → MUST be JSON (plain text invalid): {"continue":true} or
 *            {"continue":false,"stopReason"}
 *   stderr → diagnostics
 *
 * Always fail-open: detection here is audit + termination, never gating.
 */
import { loadConfig } from "../config.js";
import { Logger } from "../logger.js";
import { scanResponse } from "../scanner.js";
import { applyContentLimits, DEFAULT_CONTENT_LIMITS } from "../content-limits.js";
import { stopContinue, stopTerminate, writeOutput } from "../adapters/codex-adapter.js";
import { readStdin, buildCorrelation } from "./shared.js";
import type { StopInput } from "../types.js";

function continueTurn(): void {
  writeOutput(stopContinue());
}

async function main(): Promise<void> {
  const raw = await readStdin();

  let input: StopInput;
  try {
    input = JSON.parse(raw);
  } catch {
    console.error("[AIRS] Failed to parse hook stdin as JSON.");
    continueTurn();
    return;
  }

  // Loop guard: this turn was already continued by a Stop hook
  if (input.stop_hook_active) {
    continueTurn();
    return;
  }

  const text = input.last_assistant_message ?? "";
  if (!text.trim()) {
    continueTurn();
    return;
  }

  let config;
  try {
    config = loadConfig();
  } catch (err) {
    console.error(`[AIRS] Config error: ${err}`);
    continueTurn();
    return;
  }

  const logger = new Logger(config.logging.path, config.logging.include_content);
  const limits = config.content_limits ?? DEFAULT_CONTENT_LIMITS;

  const limited = applyContentLimits(text, limits);
  if (limited.skipped) {
    logger.logEvent("scan_skipped_size_limit", { direction: "response" });
    continueTurn();
    return;
  }

  const result = await scanResponse(config, limited.content, logger, buildCorrelation(input));

  // errored scans always continue (scanner keeps response direction fail-open)
  if (result.action === "block") {
    writeOutput(stopTerminate(result.message ?? "Prisma AIRS blocked this response."));
    return;
  }

  continueTurn();
}

main().catch((err) => {
  console.error(`[AIRS] Unhandled hook error: ${err}`);
  writeOutput(stopContinue());
});
