// test/hooks-config.test.ts
//
// Pure hooks.json generation/merge/removal — the installer scripts are thin
// FS wrappers around these functions.
import { describe, it, expect } from "vitest";
import {
  buildAirsHooks,
  mergeAirsHooks,
  removeAirsHooks,
  projectHookCommand,
  globalHookCommand,
} from "../src/hooks-config.js";
import type { CodexHooksConfig } from "../src/types.js";

const commandFor = (bundle: string) => `node "/tmp/.codex/hooks/${bundle}"`;

describe("buildAirsHooks", () => {
  it("registers all four Codex events", () => {
    const config = buildAirsHooks(commandFor);
    expect(Object.keys(config.hooks).sort()).toEqual([
      "PostToolUse",
      "PreToolUse",
      "Stop",
      "UserPromptSubmit",
    ]);
  });

  it("uses mcp__.* matcher for tool events only", () => {
    const config = buildAirsHooks(commandFor);
    expect(config.hooks.PreToolUse[0].matcher).toBe("mcp__.*");
    expect(config.hooks.PostToolUse[0].matcher).toBe("mcp__.*");
    expect(config.hooks.UserPromptSubmit[0].matcher).toBeUndefined();
    expect(config.hooks.Stop[0].matcher).toBeUndefined();
  });

  it("emits command handlers with timeout in seconds", () => {
    const config = buildAirsHooks(commandFor);
    for (const groups of Object.values(config.hooks)) {
      for (const group of groups) {
        for (const handler of group.hooks) {
          expect(handler.type).toBe("command");
          expect(handler.timeout).toBe(15);
          expect(handler.command).toContain("node ");
          expect(typeof handler.statusMessage).toBe("string");
        }
      }
    }
  });

  it("points each event at its bundle", () => {
    const config = buildAirsHooks(commandFor);
    expect(config.hooks.UserPromptSubmit[0].hooks[0].command).toContain("user-prompt-submit.mjs");
    expect(config.hooks.PreToolUse[0].hooks[0].command).toContain("pre-tool-use.mjs");
    expect(config.hooks.PostToolUse[0].hooks[0].command).toContain("post-tool-use.mjs");
    expect(config.hooks.Stop[0].hooks[0].command).toContain("stop.mjs");
  });
});

describe("mergeAirsHooks", () => {
  it("returns a fresh config when existing is null", () => {
    expect(mergeAirsHooks(null, commandFor)).toEqual(buildAirsHooks(commandFor));
  });

  it("preserves foreign hooks in the same events", () => {
    const existing: CodexHooksConfig = {
      hooks: {
        UserPromptSubmit: [{ hooks: [{ type: "command", command: "python3 ~/my-hook.py" }] }],
      },
    };
    const merged = mergeAirsHooks(existing, commandFor);
    expect(merged.hooks.UserPromptSubmit).toHaveLength(2);
    expect(merged.hooks.UserPromptSubmit[0].hooks[0].command).toBe("python3 ~/my-hook.py");
    expect(merged.hooks.UserPromptSubmit[1].hooks[0].command).toContain("user-prompt-submit.mjs");
  });

  it("is idempotent on re-merge", () => {
    const once = mergeAirsHooks(null, commandFor);
    const twice = mergeAirsHooks(once, commandFor);
    expect(twice).toEqual(once);
  });

  it("preserves unrelated events untouched", () => {
    const existing: CodexHooksConfig = {
      hooks: {
        SessionStart: [{ matcher: "startup", hooks: [{ type: "command", command: "echo hi" }] }],
      },
    };
    const merged = mergeAirsHooks(existing, commandFor);
    expect(merged.hooks.SessionStart).toEqual(existing.hooks.SessionStart);
    expect(merged.hooks.UserPromptSubmit).toHaveLength(1);
  });
});

describe("removeAirsHooks", () => {
  it("removes only AIRS entries and prunes empty events", () => {
    const merged = mergeAirsHooks(
      {
        hooks: {
          UserPromptSubmit: [{ hooks: [{ type: "command", command: "python3 ~/my-hook.py" }] }],
        },
      },
      commandFor,
    );
    const { config, removed } = removeAirsHooks(merged);
    expect(removed).toBe(4);
    expect(config.hooks.UserPromptSubmit).toHaveLength(1);
    expect(config.hooks.UserPromptSubmit[0].hooks[0].command).toBe("python3 ~/my-hook.py");
    expect(config.hooks.PreToolUse).toBeUndefined();
    expect(config.hooks.PostToolUse).toBeUndefined();
    expect(config.hooks.Stop).toBeUndefined();
  });

  it("reports zero removals on a config without AIRS hooks", () => {
    const { removed } = removeAirsHooks({ hooks: {} });
    expect(removed).toBe(0);
  });
});

describe("hook commands", () => {
  // Codex runs hook commands with a system PATH; nvm-managed node is not on
  // it (exit 127). Commands must use the absolute node binary, never "node".
  it("project command uses absolute node binary and git-root resolution", () => {
    const cmd = projectHookCommand("stop.mjs", "/Users/x/.nvm/versions/node/v22.14.0/bin/node");
    expect(cmd).toBe(
      '"/Users/x/.nvm/versions/node/v22.14.0/bin/node" "$(git rev-parse --show-toplevel)/.codex/hooks/stop.mjs"',
    );
  });

  it("global command uses absolute node binary and absolute bundle path", () => {
    const cmd = globalHookCommand(
      "pre-tool-use.mjs",
      "/opt/node/bin/node",
      "/Users/x/.codex/hooks",
    );
    expect(cmd).toBe('"/opt/node/bin/node" "/Users/x/.codex/hooks/pre-tool-use.mjs"');
  });

  it("never emits a bare node invocation", () => {
    for (const cmd of [
      projectHookCommand("stop.mjs", "/opt/node/bin/node"),
      globalHookCommand("stop.mjs", "/opt/node/bin/node", "/tmp/hooks"),
    ]) {
      expect(cmd.startsWith("node ")).toBe(false);
    }
  });
});
