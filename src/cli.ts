#!/usr/bin/env node
/**
 * CLI entry point for prisma-airs-codex-hooks.
 *
 * Usage:
 *   prisma-airs-codex-hooks install [--global]
 *   prisma-airs-codex-hooks uninstall [--global]
 *   prisma-airs-codex-hooks verify [--global]
 *   prisma-airs-codex-hooks validate-connection
 *   prisma-airs-codex-hooks validate-detection
 *   prisma-airs-codex-hooks stats [--since <duration>] [--json]
 */

import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { resolve, join } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const command = args[0];
const passthrough = args.slice(1);

const COMMANDS: Record<string, string> = {
  install: "scripts/install-hooks.ts",
  uninstall: "scripts/uninstall-hooks.ts",
  verify: "scripts/verify-hooks.ts",
  "validate-connection": "scripts/validate-connection.ts",
  "validate-detection": "scripts/validate-detection.ts",
  stats: "scripts/airs-stats.ts",
};

function usage(): void {
  console.log(
    `
Prisma AIRS Codex Hooks

Usage:
  prisma-airs-codex-hooks install [--global]      Install hooks into Codex
  prisma-airs-codex-hooks uninstall [--global]    Remove hooks from Codex
  prisma-airs-codex-hooks verify [--global]       Check hooks registration and env vars
  prisma-airs-codex-hooks validate-connection     Test AIRS API connectivity
  prisma-airs-codex-hooks validate-detection      Verify detection is working
  prisma-airs-codex-hooks stats [--since] [--json] Show scan statistics
`.trim(),
  );
}

if (!command || command === "--help" || command === "-h") {
  usage();
  process.exit(0);
}

const script = COMMANDS[command];
if (!script) {
  console.error(`Unknown command: ${command}\n`);
  usage();
  process.exit(1);
}

// Resolve the tsx runner from this package's own dependencies so the CLI
// works from any directory (incl. global installs, where `npx tsx` would
// fall back to fetching). The child inherits the INVOKING cwd — install/
// verify/uninstall/stats all resolve .codex relative to the user's repo.
const tsxCli = createRequire(import.meta.url).resolve("tsx/cli");

try {
  execFileSync(process.execPath, [tsxCli, join(ROOT, script), ...passthrough], {
    stdio: "inherit",
    cwd: process.cwd(),
    env: process.env,
  });
} catch {
  process.exit(1);
}
