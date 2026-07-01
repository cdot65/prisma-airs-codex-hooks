#!/usr/bin/env tsx
/**
 * Tamper detection: verify Codex hooks.json contains the AIRS hook entries,
 * the hook bundles are installed, and the AIRS config file is present.
 *
 * Usage:
 *   npx tsx scripts/verify-hooks.ts             # project-level
 *   npx tsx scripts/verify-hooks.ts --global     # user-level (~/.codex)
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { execSync } from "node:child_process";
import { AIRS_HOOK_SPECS } from "../src/hooks-config.js";
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
const CODEX_DIR = join(TARGET_ROOT, ".codex");
const HOOKS_JSON = join(CODEX_DIR, "hooks.json");
const HOOKS_DIR = join(CODEX_DIR, "hooks");
const AIRS_CONFIG = join(HOOKS_DIR, "airs-config.json");

function main() {
  console.log(`Verifying Prisma AIRS hook integrity [${isGlobal ? "global" : "project"}]...\n`);
  let issues = 0;

  if (!existsSync(HOOKS_JSON)) {
    console.log(`  ❌ MISSING: ${HOOKS_JSON}`);
    issues++;
  } else {
    console.log(`  ✅ Found:   ${HOOKS_JSON}`);

    try {
      const config: CodexHooksConfig = JSON.parse(readFileSync(HOOKS_JSON, "utf-8"));
      for (const spec of AIRS_HOOK_SPECS) {
        const registered = config.hooks?.[spec.event]?.some((group) =>
          group.hooks?.some((h) => h.command?.includes(spec.bundle)),
        );
        if (registered) {
          console.log(`  ✅ Registered: ${spec.event} → ${spec.bundle}`);
        } else {
          console.log(`  ❌ MISSING:    ${spec.event} hook entry (${spec.bundle})`);
          issues++;
        }
      }
    } catch {
      console.log("  ❌ ERROR:   hooks.json is invalid JSON");
      issues++;
    }
  }

  // Check installed bundles
  for (const spec of AIRS_HOOK_SPECS) {
    const bundlePath = join(HOOKS_DIR, spec.bundle);
    if (existsSync(bundlePath)) {
      console.log(`  ✅ Bundle:  ${spec.bundle}`);
    } else {
      console.log(`  ❌ MISSING: ${bundlePath}`);
      issues++;
    }
  }

  // Check AIRS config
  if (existsSync(AIRS_CONFIG)) {
    console.log(`  ✅ Found:   ${AIRS_CONFIG}`);
  } else {
    console.log(`  ❌ MISSING: ${AIRS_CONFIG}`);
    issues++;
  }

  // Check env vars
  if (process.env.PRISMA_AIRS_API_KEY) {
    console.log("  ✅ Set:     PRISMA_AIRS_API_KEY");
  } else {
    console.log("  ⚠️  NOT SET: PRISMA_AIRS_API_KEY (hooks fail per fail_mode)");
  }
  if (process.env.PRISMA_AIRS_PROFILE_NAME) {
    console.log("  ✅ Set:     PRISMA_AIRS_PROFILE_NAME");
  } else {
    console.log("  ⚠️  NOT SET: PRISMA_AIRS_PROFILE_NAME");
  }

  console.log("");
  if (issues === 0) {
    console.log("✅ All hooks intact and correctly configured.");
    console.log("   Reminder: hooks must also be trusted in Codex — run /hooks to check.");
  } else {
    console.log(`⚠️  ${issues} issue(s) found. Run 'npm run install-hooks' to restore.`);
    process.exit(1);
  }
}

main();
