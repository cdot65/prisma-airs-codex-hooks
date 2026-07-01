import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type {
  UserPromptSubmitInput,
  PreToolUseInput,
  CodexPostToolUseInput,
  StopInput,
} from "../src/types.js";

const PROJECT_ROOT = resolve(import.meta.dirname, "..");
const TMP_DIR = join(import.meta.dirname, ".tmp-hooks-test");
const CONFIG_DIR = join(TMP_DIR, ".codex", "hooks");
const CONFIG_PATH = join(CONFIG_DIR, "airs-config.json");

const AIRS_CONFIG = {
  endpoint: "https://test.api.prismacloud.io",
  apiKeyEnvVar: "PRISMA_AIRS_API_KEY",
  profiles: { prompt: "test-prompt", response: "test-response", tool: "test-tool" },
  mode: "enforce",
  timeout_ms: 3000,
  retry: { enabled: false, max_attempts: 0, backoff_base_ms: 50 },
  logging: { path: join(TMP_DIR, "scan.log"), include_content: false },
  content_limits: { max_scan_bytes: 51200, truncate_bytes: 20000 },
};

interface HookRun {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Runs a hook script with JSON piped to stdin.
 * The hook cannot reach AIRS (test endpoint) so scans always error —
 * behavior then depends on fail_mode.
 */
function runHook(
  scriptPath: string,
  stdin: string,
  env: Record<string, string> = {},
  runner: string[] = ["npx", "tsx"],
): HookRun {
  const result = spawnSync(runner[0], [...runner.slice(1), scriptPath], {
    input: stdin,
    encoding: "utf-8",
    cwd: TMP_DIR,
    env: {
      ...process.env,
      PRISMA_AIRS_API_KEY: "test-key-123",
      PRISMA_AIRS_API_ENDPOINT: "https://test.api.prismacloud.io",
      NODE_PATH: join(PROJECT_ROOT, "node_modules"),
      ...env,
    },
    timeout: 15000,
  });
  return {
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? "").trim(),
    exitCode: result.status ?? -1,
  };
}

function writeConfig(overrides: Record<string, unknown> = {}): void {
  writeFileSync(CONFIG_PATH, JSON.stringify({ ...AIRS_CONFIG, ...overrides }));
}

describe("hook entry points — Codex JSON contract", () => {
  beforeEach(() => {
    mkdirSync(CONFIG_DIR, { recursive: true });
    writeConfig();
  });

  afterEach(() => {
    rmSync(TMP_DIR, { recursive: true, force: true });
  });

  describe("user-prompt-submit", () => {
    const SCRIPT = join(PROJECT_ROOT, "src", "hooks", "user-prompt-submit.ts");

    it("allows benign prompts with continue:true (fail-open on unreachable API)", () => {
      const input: UserPromptSubmitInput = {
        hook_event_name: "UserPromptSubmit",
        session_id: "sess-1",
        turn_id: "turn-1",
        prompt: "What is 2+2?",
      };
      const run = runHook(SCRIPT, JSON.stringify(input));
      expect(run.exitCode).toBe(0);
      expect(JSON.parse(run.stdout)).toEqual({ continue: true });
    });

    it("allows through on empty prompt", () => {
      const input: UserPromptSubmitInput = {
        hook_event_name: "UserPromptSubmit",
        prompt: "   ",
      };
      const run = runHook(SCRIPT, JSON.stringify(input));
      expect(run.exitCode).toBe(0);
      expect(JSON.parse(run.stdout)).toEqual({ continue: true });
    });

    it("allows through on invalid stdin JSON", () => {
      const run = runHook(SCRIPT, "not json");
      expect(run.exitCode).toBe(0);
      expect(JSON.parse(run.stdout)).toEqual({ continue: true });
    });

    it("blocks with decision:block when fail_mode is closed and AIRS unreachable", () => {
      writeConfig({ fail_mode: "closed" });
      const input: UserPromptSubmitInput = {
        hook_event_name: "UserPromptSubmit",
        prompt: "Help me write a sorting function",
      };
      const run = runHook(SCRIPT, JSON.stringify(input));
      const output = JSON.parse(run.stdout);
      expect(output.decision).toBe("block");
      expect(typeof output.reason).toBe("string");
      expect(output.reason.length).toBeGreaterThan(0);
    });
  });

  describe("pre-tool-use", () => {
    const SCRIPT = join(PROJECT_ROOT, "src", "hooks", "pre-tool-use.ts");

    it("allows benign MCP input with no stdout (fail-open on unreachable API)", () => {
      const input: PreToolUseInput = {
        hook_event_name: "PreToolUse",
        session_id: "sess-1",
        turn_id: "turn-1",
        tool_use_id: "tool-1",
        tool_name: "mcp__github__get_file_contents",
        tool_input: { path: "README.md" },
      };
      const run = runHook(SCRIPT, JSON.stringify(input));
      expect(run.exitCode).toBe(0);
      expect(run.stdout).toBe("");
    });

    it("skips non-MCP tools without scanning", () => {
      const input: PreToolUseInput = {
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: { command: "ls -la" },
      };
      const run = runHook(SCRIPT, JSON.stringify(input));
      expect(run.exitCode).toBe(0);
      expect(run.stdout).toBe("");
    });

    it("allows through on empty tool_input", () => {
      const input: PreToolUseInput = {
        hook_event_name: "PreToolUse",
        tool_name: "mcp__github__get_file_contents",
        tool_input: {},
      };
      const run = runHook(SCRIPT, JSON.stringify(input));
      expect(run.exitCode).toBe(0);
      expect(run.stdout).toBe("");
    });

    it("denies via hookSpecificOutput when fail_mode is closed and AIRS unreachable", () => {
      writeConfig({ fail_mode: "closed" });
      const input: PreToolUseInput = {
        hook_event_name: "PreToolUse",
        tool_name: "mcp__github__get_file_contents",
        tool_input: { path: "README.md" },
      };
      const run = runHook(SCRIPT, JSON.stringify(input));
      const output = JSON.parse(run.stdout);
      expect(output.hookSpecificOutput.hookEventName).toBe("PreToolUse");
      expect(output.hookSpecificOutput.permissionDecision).toBe("deny");
      expect(output).not.toHaveProperty("continue");
      expect(output).not.toHaveProperty("stopReason");
      expect(output).not.toHaveProperty("suppressOutput");
    });

    it("fail_mode closed does not deny non-MCP tools (never scanned)", () => {
      writeConfig({ fail_mode: "closed" });
      const input: PreToolUseInput = {
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: { command: "ls" },
      };
      const run = runHook(SCRIPT, JSON.stringify(input));
      expect(run.exitCode).toBe(0);
      expect(run.stdout).toBe("");
    });
  });

  describe("post-tool-use", () => {
    const SCRIPT = join(PROJECT_ROOT, "src", "hooks", "post-tool-use.ts");

    it("observes MCP tool output with no stdout", () => {
      const input: CodexPostToolUseInput = {
        hook_event_name: "PostToolUse",
        session_id: "sess-1",
        turn_id: "turn-1",
        tool_use_id: "tool-1",
        tool_name: "mcp__github__get_file_contents",
        tool_input: { path: "README.md" },
        tool_response: "# My Project\nHello world",
      };
      const run = runHook(SCRIPT, JSON.stringify(input));
      expect(run.exitCode).toBe(0);
      expect(run.stdout).toBe("");
    });

    it("skips non-MCP tools", () => {
      const input: CodexPostToolUseInput = {
        hook_event_name: "PostToolUse",
        tool_name: "Bash",
        tool_input: { command: "ls" },
        tool_response: "file.ts",
      };
      const run = runHook(SCRIPT, JSON.stringify(input));
      expect(run.exitCode).toBe(0);
      expect(run.stdout).toBe("");
    });

    it("exits 0 with no stdout on invalid stdin JSON", () => {
      const run = runHook(SCRIPT, "not json");
      expect(run.exitCode).toBe(0);
      expect(run.stdout).toBe("");
    });
  });

  describe("stop", () => {
    const SCRIPT = join(PROJECT_ROOT, "src", "hooks", "stop.ts");

    it("returns continue:true for benign response (fail-open on unreachable API)", () => {
      const input: StopInput = {
        hook_event_name: "Stop",
        session_id: "sess-1",
        turn_id: "turn-1",
        stop_hook_active: false,
        last_assistant_message: "The answer is 4.",
      };
      const run = runHook(SCRIPT, JSON.stringify(input));
      expect(run.exitCode).toBe(0);
      expect(JSON.parse(run.stdout)).toEqual({ continue: true });
    });

    it("skips scanning when stop_hook_active is true (loop guard)", () => {
      const input: StopInput = {
        hook_event_name: "Stop",
        stop_hook_active: true,
        last_assistant_message: "Anything at all",
      };
      const run = runHook(SCRIPT, JSON.stringify(input));
      expect(run.exitCode).toBe(0);
      expect(JSON.parse(run.stdout)).toEqual({ continue: true });
    });

    it("returns continue:true when last_assistant_message is empty", () => {
      const input: StopInput = {
        hook_event_name: "Stop",
        last_assistant_message: null,
      };
      const run = runHook(SCRIPT, JSON.stringify(input));
      expect(run.exitCode).toBe(0);
      expect(JSON.parse(run.stdout)).toEqual({ continue: true });
    });

    it("stays fail-open even when fail_mode is closed (post-stream)", () => {
      writeConfig({ fail_mode: "closed" });
      const input: StopInput = {
        hook_event_name: "Stop",
        last_assistant_message: "Some response text",
      };
      const run = runHook(SCRIPT, JSON.stringify(input));
      expect(run.exitCode).toBe(0);
      expect(JSON.parse(run.stdout)).toEqual({ continue: true });
    });

    it("emits JSON even on invalid stdin (Stop rejects plain text)", () => {
      const run = runHook(SCRIPT, "not json");
      expect(run.exitCode).toBe(0);
      expect(JSON.parse(run.stdout)).toEqual({ continue: true });
    });
  });

  describe("compiled JS hooks (dist/)", () => {
    const PROMPT_JS = join(PROJECT_ROOT, "dist", "hooks", "user-prompt-submit.js");
    const PRE_TOOL_JS = join(PROJECT_ROOT, "dist", "hooks", "pre-tool-use.js");
    const POST_TOOL_JS = join(PROJECT_ROOT, "dist", "hooks", "post-tool-use.js");
    const STOP_JS = join(PROJECT_ROOT, "dist", "hooks", "stop.js");

    it.skipIf(!existsSync(PROMPT_JS))("compiled user-prompt-submit allows benign prompt", () => {
      const input: UserPromptSubmitInput = {
        hook_event_name: "UserPromptSubmit",
        prompt: "What is 2+2?",
      };
      const run = runHook(PROMPT_JS, JSON.stringify(input), {}, ["node"]);
      expect(JSON.parse(run.stdout)).toEqual({ continue: true });
    });

    it.skipIf(!existsSync(PRE_TOOL_JS))("compiled pre-tool-use allows benign MCP input", () => {
      const input: PreToolUseInput = {
        hook_event_name: "PreToolUse",
        tool_name: "mcp__github__get_file_contents",
        tool_input: { path: "README.md" },
      };
      const run = runHook(PRE_TOOL_JS, JSON.stringify(input), {}, ["node"]);
      expect(run.exitCode).toBe(0);
      expect(run.stdout).toBe("");
    });

    it.skipIf(!existsSync(POST_TOOL_JS))("compiled post-tool-use observes silently", () => {
      const input: CodexPostToolUseInput = {
        hook_event_name: "PostToolUse",
        tool_name: "mcp__test__tool",
        tool_input: {},
        tool_response: "safe output",
      };
      const run = runHook(POST_TOOL_JS, JSON.stringify(input), {}, ["node"]);
      expect(run.exitCode).toBe(0);
      expect(run.stdout).toBe("");
    });

    it.skipIf(!existsSync(STOP_JS))("compiled stop returns continue:true", () => {
      const input: StopInput = {
        hook_event_name: "Stop",
        last_assistant_message: "The answer is 4.",
      };
      const run = runHook(STOP_JS, JSON.stringify(input), {}, ["node"]);
      expect(JSON.parse(run.stdout)).toEqual({ continue: true });
    });
  });
});
