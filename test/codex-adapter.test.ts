// test/codex-adapter.test.ts
//
// Codex hook stdout contracts. Each builder must produce the exact JSON
// shape Codex accepts for that event — see https://developers.openai.com/codex/hooks
import { describe, it, expect } from "vitest";
import {
  userPromptSubmitBlock,
  preToolUseDeny,
  stopContinue,
  stopTerminate,
} from "../src/adapters/codex-adapter.js";

describe("userPromptSubmitBlock", () => {
  it("produces the UserPromptSubmit block shape", () => {
    expect(userPromptSubmitBlock("bad prompt")).toEqual({
      decision: "block",
      reason: "bad prompt",
    });
  });
});

describe("preToolUseDeny", () => {
  it("produces the PreToolUse hookSpecificOutput deny shape", () => {
    expect(preToolUseDeny("blocked by policy")).toEqual({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: "blocked by policy",
      },
    });
  });

  it("never emits fields Codex rejects for PreToolUse", () => {
    // Codex marks the hook run FAILED (and allows the tool call) if a
    // PreToolUse hook returns continue/stopReason/suppressOutput.
    const payload = preToolUseDeny("reason") as Record<string, unknown>;
    expect(payload).not.toHaveProperty("continue");
    expect(payload).not.toHaveProperty("stopReason");
    expect(payload).not.toHaveProperty("suppressOutput");
    expect(payload).not.toHaveProperty("decision");
  });
});

describe("stop outputs", () => {
  it("stopContinue produces continue:true", () => {
    expect(stopContinue()).toEqual({ continue: true });
  });

  it("stopTerminate produces continue:false with stopReason", () => {
    expect(stopTerminate("AIRS blocked the response")).toEqual({
      continue: false,
      stopReason: "AIRS blocked the response",
    });
  });

  it("stop outputs serialize to valid JSON (Stop rejects plain text)", () => {
    for (const payload of [stopContinue(), stopTerminate("x")]) {
      const parsed = JSON.parse(JSON.stringify(payload));
      expect(typeof parsed.continue).toBe("boolean");
    }
  });
});
