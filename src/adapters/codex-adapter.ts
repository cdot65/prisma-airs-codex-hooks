import type { UserPromptSubmitBlockOutput, PreToolUseDenyOutput, StopOutput } from "../types.js";

/**
 * Codex hook stdout builders.
 *
 * Codex hook contract (https://developers.openai.com/codex/hooks):
 *   stdin  → one JSON object with event-specific fields
 *   stdout → event-specific JSON; exit 0 with no output = success/allow
 *   exit 2 + stderr = block (alternative to JSON; not used here)
 *   stderr → diagnostics
 *
 * Per-event rules encoded here:
 *   - UserPromptSubmit blocks with { decision: "block", reason }
 *   - PreToolUse denies with hookSpecificOutput.permissionDecision; it must
 *     NOT emit continue/stopReason/suppressOutput or Codex marks the hook
 *     run failed and lets the tool call proceed
 *   - Stop requires JSON stdout (plain text is invalid for that event);
 *     continue:false terminates the turn
 */

/** Block a prompt in UserPromptSubmit */
export function userPromptSubmitBlock(reason: string): UserPromptSubmitBlockOutput {
  return { decision: "block", reason };
}

/** Deny a tool call in PreToolUse */
export function preToolUseDeny(reason: string): PreToolUseDenyOutput {
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  };
}

/** Let the turn continue from a Stop hook */
export function stopContinue(): StopOutput {
  return { continue: true };
}

/** Terminate the turn from a Stop hook */
export function stopTerminate(stopReason: string): StopOutput {
  return { continue: false, stopReason };
}

/** Write a hook payload to stdout as a single JSON line */
export function writeOutput(payload: unknown): void {
  process.stdout.write(JSON.stringify(payload) + "\n");
}
