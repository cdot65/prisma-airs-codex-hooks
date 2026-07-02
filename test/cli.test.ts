// test/cli.test.ts
//
// The CLI must operate on the INVOKING directory, not the package install
// dir — a globally-installed `prisma-airs-codex-hooks verify` has to find
// .codex/ in the user's repo (regression: cwd was forced to package ROOT).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const PROJECT_ROOT = resolve(import.meta.dirname, "..");
const CLI = join(PROJECT_ROOT, "src", "cli.ts");

function run(args: string[], cwd: string) {
  const result = spawnSync("npx", ["tsx", CLI, ...args], {
    encoding: "utf-8",
    cwd,
    env: { ...process.env, PRISMA_AIRS_API_KEY: "test-key" },
    timeout: 60000,
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    exitCode: result.status ?? -1,
  };
}

describe("cli", () => {
  let workDir: string;

  beforeAll(() => {
    workDir = realpathSync(mkdtempSync(join(tmpdir(), "airs-cli-test-")));
    spawnSync("git", ["init", "-q"], { cwd: workDir });
    // Install hooks into the scratch repo using the install script directly
    const install = spawnSync("npx", ["tsx", join(PROJECT_ROOT, "scripts", "install-hooks.ts")], {
      encoding: "utf-8",
      cwd: workDir,
      env: { ...process.env, PRISMA_AIRS_API_KEY: "test-key" },
      timeout: 60000,
    });
    expect(install.status).toBe(0);
  }, 90000);

  afterAll(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  it("shows usage on --help", () => {
    const { stdout, exitCode } = run(["--help"], workDir);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("prisma-airs-codex-hooks install");
  });

  it("fails on unknown command", () => {
    const { exitCode } = run(["frobnicate"], workDir);
    expect(exitCode).toBe(1);
  });

  it("verify runs against the invoking directory, not the package root", () => {
    // workDir has hooks fully installed; the package root does not.
    const { stdout, exitCode } = run(["verify"], workDir);
    expect(stdout).toContain(workDir);
    expect(exitCode).toBe(0);
  }, 60000);
});
