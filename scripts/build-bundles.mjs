#!/usr/bin/env node
/**
 * Bundle each hook entry point (and the CLI) into a single minified,
 * self-contained ESM file. The bundles run with plain `node` from any
 * directory — no node_modules required — which is what lets the installer
 * copy them into .codex/hooks/ (project) or ~/.codex/hooks/ (global).
 */
import { build } from "esbuild";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { statSync } from "node:fs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const HOOK_ENTRIES = [
  "src/hooks/user-prompt-submit.ts",
  "src/hooks/pre-tool-use.ts",
  "src/hooks/post-tool-use.ts",
  "src/hooks/stop.ts",
];

// scanner.ts uses require() for lazy child_process loading; provide it in ESM
const REQUIRE_SHIM = `import { createRequire as __createRequire } from 'node:module';
const require = __createRequire(import.meta.url);`;

async function bundle(entry, outfile) {
  await build({
    entryPoints: [resolve(ROOT, entry)],
    outfile: resolve(ROOT, outfile),
    bundle: true,
    minify: true,
    platform: "node",
    target: "node18",
    format: "esm",
    banner: { js: REQUIRE_SHIM },
    logLevel: "warning",
  });
  const size = statSync(resolve(ROOT, outfile)).size;
  console.log(`  ${outfile}  ${(size / 1024).toFixed(0)} KB`);
}

console.log("Bundling hooks (minified, self-contained):");
for (const entry of HOOK_ENTRIES) {
  const name = basename(entry, ".ts");
  await bundle(entry, `dist/hooks/${name}.mjs`);
}
console.log("Done.");
