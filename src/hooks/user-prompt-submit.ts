#!/usr/bin/env node
/**
 * Codex hook: UserPromptSubmit (can block)
 *
 * Intercepts the user's prompt before Codex processes it. Reads JSON from
 * stdin, scans the prompt via Prisma AIRS, and either lets the turn continue
 * or blocks it.
 *
 * Codex contract:
 *   stdin  → JSON { prompt, session_id, turn_id, ... }
 *   stdout → {"continue":true} to allow; {"decision":"block","reason"} to block
 *   stderr → diagnostics
 *
 * Fail mode: stdin parse errors always allow; config/scan errors block only
 * when fail_mode is "closed".
 */
import { loadConfig, readFailMode } from "../config.js";
import { Logger } from "../logger.js";
import { scanPrompt } from "../scanner.js";
import { userPromptSubmitBlock, writeOutput } from "../adapters/codex-adapter.js";
import { readStdin, buildCorrelation } from "./shared.js";
import type { UserPromptSubmitInput } from "../types.js";

function allowThrough(): void {
  writeOutput({ continue: true });
}

function blockPrompt(reason: string): void {
  writeOutput(userPromptSubmitBlock(reason));
}

async function main(): Promise<void> {
  const raw = await readStdin();

  let input: UserPromptSubmitInput;
  try {
    input = JSON.parse(raw);
  } catch {
    console.error("[AIRS] Failed to parse hook stdin as JSON, allowing through.");
    allowThrough();
    return;
  }

  let config;
  try {
    config = loadConfig();
  } catch (err) {
    console.error(`[AIRS] Config error: ${err}`);
    if (readFailMode() === "closed") {
      blockPrompt("Prisma AIRS is not configured and fail_mode is closed. Fix the AIRS hook configuration to submit prompts.");
    } else {
      allowThrough();
    }
    return;
  }

  const logger = new Logger(config.logging.path, config.logging.include_content);
  const result = await scanPrompt(config, input.prompt ?? "", logger, buildCorrelation(input));

  if (result.action === "block") {
    blockPrompt(result.message ?? "Prisma AIRS blocked this prompt.");
    return;
  }

  allowThrough();
}

main().catch((err) => {
  // Unhandled errors never block — they are hook bugs, not security verdicts
  console.error(`[AIRS] Unhandled hook error: ${err}`);
  writeOutput({ continue: true });
});
