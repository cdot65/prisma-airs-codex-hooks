// test/bundles.test.ts
//
// Self-contained bundle contract: each hook ships as one minified .mjs that
// runs with plain `node` from any directory, with NO node_modules available.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync, rmSync, existsSync, statSync, mkdtempSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const PROJECT_ROOT = resolve(import.meta.dirname, "..");
const BUNDLE_DIR = join(PROJECT_ROOT, "dist", "hooks");

const BUNDLES = [
  "user-prompt-submit.mjs",
  "pre-tool-use.mjs",
  "post-tool-use.mjs",
  "stop.mjs",
];

const haveBundles = BUNDLES.every((b) => existsSync(join(BUNDLE_DIR, b)));

describe.skipIf(!haveBundles)("hook bundles (dist/hooks/*.mjs)", () => {
  let workDir: string;

  beforeEach(() => {
    // A directory far away from the repo: no node_modules, no NODE_PATH
    workDir = mkdtempSync(join(tmpdir(), "airs-bundle-test-"));
    const configDir = join(workDir, ".codex", "hooks");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, "airs-config.json"),
      JSON.stringify({
        endpoint: "https://test.api.prismacloud.io",
        apiKeyEnvVar: "PRISMA_AIRS_API_KEY",
        profiles: { prompt: "p", response: "r", tool: "t" },
        mode: "enforce",
        timeout_ms: 3000,
        retry: { enabled: false, max_attempts: 0, backoff_base_ms: 50 },
        logging: { path: join(workDir, "scan.log"), include_content: false },
      }),
    );
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  function runBundle(bundle: string, stdin: string) {
    const result = spawnSync("node", [join(BUNDLE_DIR, bundle)], {
      input: stdin,
      encoding: "utf-8",
      cwd: workDir,
      env: {
        PATH: process.env.PATH,
        HOME: workDir,
        PRISMA_AIRS_API_KEY: "test-key-123",
      },
      timeout: 15000,
    });
    return {
      stdout: (result.stdout ?? "").trim(),
      stderr: (result.stderr ?? "").trim(),
      exitCode: result.status ?? -1,
    };
  }

  it("every bundle is under 1MB", () => {
    for (const bundle of BUNDLES) {
      const size = statSync(join(BUNDLE_DIR, bundle)).size;
      expect(size, `${bundle} is ${size} bytes`).toBeLessThan(1024 * 1024);
    }
  });

  it("user-prompt-submit bundle runs standalone (fail-open on unreachable API)", () => {
    const run = runBundle("user-prompt-submit.mjs", JSON.stringify({
      hook_event_name: "UserPromptSubmit",
      prompt: "What is 2+2?",
    }));
    expect(run.stderr).not.toMatch(/Cannot find (module|package)/);
    expect(run.exitCode).toBe(0);
    expect(JSON.parse(run.stdout)).toEqual({ continue: true });
  });

  it("pre-tool-use bundle runs standalone", () => {
    const run = runBundle("pre-tool-use.mjs", JSON.stringify({
      hook_event_name: "PreToolUse",
      tool_name: "mcp__github__get_file_contents",
      tool_input: { path: "README.md" },
    }));
    expect(run.stderr).not.toMatch(/Cannot find (module|package)/);
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toBe("");
  });

  it("post-tool-use bundle runs standalone", () => {
    const run = runBundle("post-tool-use.mjs", JSON.stringify({
      hook_event_name: "PostToolUse",
      tool_name: "mcp__test__tool",
      tool_input: {},
      tool_response: "safe output",
    }));
    expect(run.stderr).not.toMatch(/Cannot find (module|package)/);
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toBe("");
  });

  it("stop bundle runs standalone", () => {
    const run = runBundle("stop.mjs", JSON.stringify({
      hook_event_name: "Stop",
      last_assistant_message: "The answer is 4.",
    }));
    expect(run.stderr).not.toMatch(/Cannot find (module|package)/);
    expect(run.exitCode).toBe(0);
    expect(JSON.parse(run.stdout)).toEqual({ continue: true });
  });
});
