#!/usr/bin/env tsx
/**
 * Remove Prisma AIRS hook entries from Codex hooks.json.
 *
 * Usage:
 *   npx tsx scripts/uninstall-hooks.ts             # project-level
 *   npx tsx scripts/uninstall-hooks.ts --global     # user-level (~/.codex/hooks.json)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { execSync } from "node:child_process";
import { removeAirsHooks } from "../src/hooks-config.js";
import type { CodexHooksConfig } from "../src/types.js";

const isGlobal = process.argv.includes("--global");

function gitToplevel(): string | null {
  try {
    return execSync("git rev-parse --show-toplevel", { encoding: "utf-8" }).trim();
  } catch {
    return null;
  }
}

const TARGET_ROOT = isGlobal ? homedir() : (gitToplevel() ?? process.cwd());
const HOOKS_JSON_PATH = join(TARGET_ROOT, ".codex", "hooks.json");

function main() {
  const scope = isGlobal ? "global" : "project";
  console.log(`Uninstalling Prisma AIRS Codex hooks [${scope}]...\n`);

  if (!existsSync(HOOKS_JSON_PATH)) {
    console.log(`  No ${HOOKS_JSON_PATH} found — nothing to uninstall.`);
    return;
  }

  let config: CodexHooksConfig;
  try {
    config = JSON.parse(readFileSync(HOOKS_JSON_PATH, "utf-8"));
  } catch {
    console.error("  ERROR: hooks.json is invalid JSON.");
    return;
  }

  const { config: cleaned, removed } = removeAirsHooks(config);

  if (removed === 0) {
    console.log("  No AIRS hook entries found in hooks.json.");
  } else {
    writeFileSync(HOOKS_JSON_PATH, JSON.stringify(cleaned, null, 2) + "\n", "utf-8");
    console.log(`  Removed ${removed} AIRS hook entry/entries from ${HOOKS_JSON_PATH}`);
  }

  console.log("\n✅ Hooks uninstalled");
  console.log("  Hook bundles, AIRS config, and logs under .codex/hooks/ preserved.");
  console.log("  Restart Codex (or start a new session) to apply changes.");
}

main();
