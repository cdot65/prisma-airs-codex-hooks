#!/usr/bin/env tsx
/**
 * Install Prisma AIRS hooks into Codex.
 *
 * Usage:
 *   npx tsx scripts/install-hooks.ts             # project-level (<repo>/.codex/hooks.json)
 *   npx tsx scripts/install-hooks.ts --global     # user-level (~/.codex/hooks.json)
 *
 * Codex loads hooks from every active config layer (all matching hooks run):
 *   1. Project: <repo>/.codex/hooks.json (requires the project layer to be trusted)
 *   2. User:    ~/.codex/hooks.json
 *
 * The self-contained hook bundles (dist/hooks/*.mjs) are copied into
 * <target>/.codex/hooks/ so the installation has no dependency on this
 * repository or node_modules.
 *
 * Codex requires you to review and trust non-managed hooks before they run:
 * open Codex and use /hooks. Trust is recorded against the hook definition's
 * hash, so re-running this installer after changes requires re-trusting.
 */
import {
  mkdirSync,
  copyFileSync,
  existsSync,
  readFileSync,
  writeFileSync,
  readdirSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { execSync } from "node:child_process";
import {
  buildAirsHooks,
  mergeAirsHooks,
  projectHookCommand,
  globalHookCommand,
  AIRS_HOOK_SPECS,
} from "../src/hooks-config.js";
import type { CodexHooksConfig } from "../src/types.js";

const PROJECT_ROOT = resolve(import.meta.dirname, "..");
const isGlobal = process.argv.includes("--global");

function gitToplevel(): string | null {
  try {
    return execSync("git rev-parse --show-toplevel", { encoding: "utf-8" }).trim();
  } catch {
    return null;
  }
}

// Determine target paths based on scope
const TARGET_ROOT = isGlobal ? homedir() : (gitToplevel() ?? process.cwd());
const CODEX_DIR = join(TARGET_ROOT, ".codex");
const HOOKS_JSON_PATH = join(CODEX_DIR, "hooks.json");
const HOOKS_DIR = join(CODEX_DIR, "hooks");
const AIRS_CONFIG_DEST = join(HOOKS_DIR, "airs-config.json");

function main() {
  const scope = isGlobal ? "global (user-level)" : "project-level";
  console.log(`Installing Prisma AIRS Codex hooks [${scope}]...\n`);

  // ---- Validate environment ----
  if (!process.env.PRISMA_AIRS_API_KEY) {
    console.warn(
      "  WARNING: PRISMA_AIRS_API_KEY is not set in your environment.\n" +
        "  Set it with:  export PRISMA_AIRS_API_KEY=<your-x-pan-token>\n",
    );
  }
  if (!process.env.PRISMA_AIRS_PROFILE_NAME) {
    console.warn(
      "  WARNING: PRISMA_AIRS_PROFILE_NAME is not set in your environment.\n" +
        "  Set it with:  export PRISMA_AIRS_PROFILE_NAME=<your-security-profile>\n",
    );
  }

  // ---- Verify bundles exist ----
  const bundleSrcDir = join(PROJECT_ROOT, "dist", "hooks");
  const bundles = existsSync(bundleSrcDir)
    ? readdirSync(bundleSrcDir).filter((f) => f.endsWith(".mjs"))
    : [];
  if (bundles.length === 0) {
    console.error("  ERROR: dist/hooks/*.mjs not found. Run 'npm run build' first.\n");
    process.exit(1);
  }

  // ---- Copy bundles + config template ----
  mkdirSync(HOOKS_DIR, { recursive: true });
  for (const bundle of bundles) {
    copyFileSync(join(bundleSrcDir, bundle), join(HOOKS_DIR, bundle));
  }
  console.log(`  Copied ${bundles.length} hook bundle(s) → ${HOOKS_DIR}`);

  if (!existsSync(AIRS_CONFIG_DEST)) {
    copyFileSync(join(PROJECT_ROOT, "airs-config.json"), AIRS_CONFIG_DEST);
    console.log(`  Copied airs-config.json → ${AIRS_CONFIG_DEST}`);
  } else {
    console.log(`  Config already exists at ${AIRS_CONFIG_DEST} (preserved)`);
  }

  // ---- Build hook commands ----
  // Absolute node binary (Codex hook PATH lacks nvm/asdf node); project
  // installs resolve from the git root so hooks work from subdirectories.
  const commandFor = (bundle: string) =>
    isGlobal
      ? globalHookCommand(bundle, process.execPath, HOOKS_DIR)
      : projectHookCommand(bundle, process.execPath);

  // ---- Write or merge hooks.json ----
  let existing: CodexHooksConfig | null = null;
  if (existsSync(HOOKS_JSON_PATH)) {
    try {
      existing = JSON.parse(readFileSync(HOOKS_JSON_PATH, "utf-8"));
      console.log(`  Found existing ${HOOKS_JSON_PATH} — merging AIRS hooks.`);
    } catch {
      console.warn("  WARNING: existing hooks.json is invalid JSON — overwriting.");
    }
  }

  const hooksConfig = existing
    ? mergeAirsHooks(existing, commandFor)
    : buildAirsHooks(commandFor);

  writeFileSync(HOOKS_JSON_PATH, JSON.stringify(hooksConfig, null, 2) + "\n", "utf-8");
  console.log(`  Wrote ${HOOKS_JSON_PATH}`);

  // ---- Summary ----
  console.log("\n✅ Hooks installed\n");
  if (isGlobal) {
    console.log("  Scope: GLOBAL — hooks apply to ALL Codex sessions.\n");
  } else {
    console.log("  Scope: PROJECT — hooks apply to this repository.");
    console.log("  Note: project hooks only load when the project's .codex layer is trusted.\n");
    console.log("  Tip: use --global to install for all sessions:\n");
    console.log("    npm run install-hooks -- --global\n");
  }
  console.log("  Registered Codex hooks:");
  for (const spec of AIRS_HOOK_SPECS) {
    const matcher = spec.matcher ? ` (matcher: ${spec.matcher})` : "";
    console.log(`    ${spec.event}${matcher} → ${spec.bundle}`);
  }
  console.log("\n  Not scanned by design: Bash commands and apply_patch file edits.\n");
  console.log(`  Hook commands embed this node binary: ${process.execPath}`);
  console.log("  (Codex runs hooks with a system PATH — re-run install-hooks after");
  console.log("  switching node versions, then re-trust via /hooks.)\n");
  console.log("  Environment variables (set in your shell profile):");
  console.log("    PRISMA_AIRS_API_KEY            — x-pan-token for AIRS API (required)");
  console.log("    PRISMA_AIRS_PROFILE_NAME       — AIRS security profile (recommended)");
  console.log("    PRISMA_AIRS_API_ENDPOINT       — regional base URL (optional, defaults to US)");
  console.log("    PRISMA_AIRS_PROMPT_PROFILE     — prompt profile override (optional)");
  console.log("    PRISMA_AIRS_RESPONSE_PROFILE   — response profile override (optional)");
  console.log("    PRISMA_AIRS_TOOL_PROFILE       — tool profile override (optional)\n");
  console.log("  IMPORTANT — trust the hooks before they run:");
  console.log("    1. Open Codex and run /hooks to review and trust the new hook definitions.");
  console.log("       (Codex records trust per definition hash — re-trust after any change.)");
  console.log("    2. npm run validate-connection");
  console.log("    3. npm run verify-hooks");
  console.log("\n  Codex hooks are enabled by default in current Codex versions.");
  console.log("  Older versions need this in ~/.codex/config.toml:");
  console.log("    [features]");
  console.log("    hooks = true");
}

main();
