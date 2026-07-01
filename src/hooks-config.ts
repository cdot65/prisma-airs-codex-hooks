// src/hooks-config.ts
//
// Pure Codex hooks.json generation, merge, and removal for the AIRS hook
// registrations. The install/uninstall scripts wrap these with file I/O.
import type { CodexHooksConfig, CodexHookMatcherGroup } from "./types.js";

/** One AIRS hook registration */
export interface AirsHookSpec {
  event: string;
  bundle: string;
  matcher?: string;
  statusMessage: string;
}

/** Codex hook timeout in SECONDS (Codex default is 600) */
export const AIRS_HOOK_TIMEOUT_S = 15;

export const AIRS_HOOK_SPECS: AirsHookSpec[] = [
  {
    event: "UserPromptSubmit",
    bundle: "user-prompt-submit.mjs",
    statusMessage: "Prisma AIRS prompt scan",
  },
  {
    event: "PreToolUse",
    bundle: "pre-tool-use.mjs",
    matcher: "mcp__.*",
    statusMessage: "Prisma AIRS MCP input scan",
  },
  {
    event: "PostToolUse",
    bundle: "post-tool-use.mjs",
    matcher: "mcp__.*",
    statusMessage: "Prisma AIRS MCP output audit",
  },
  {
    event: "Stop",
    bundle: "stop.mjs",
    statusMessage: "Prisma AIRS response scan",
  },
];

/**
 * Codex executes hook commands with a system PATH, so nvm/asdf-managed node
 * is not resolvable as bare "node" (exit 127). Commands always embed the
 * absolute node binary (process.execPath at install time).
 */

/** Project-scope command: git-root resolution keeps it stable from subdirs */
export function projectHookCommand(bundle: string, nodeBin: string): string {
  return `"${nodeBin}" "$(git rev-parse --show-toplevel)/.codex/hooks/${bundle}"`;
}

/** Global-scope command: fully absolute paths */
export function globalHookCommand(bundle: string, nodeBin: string, hooksDir: string): string {
  return `"${nodeBin}" "${hooksDir}/${bundle}"`;
}

function buildGroup(spec: AirsHookSpec, commandFor: (bundle: string) => string): CodexHookMatcherGroup {
  return {
    ...(spec.matcher ? { matcher: spec.matcher } : {}),
    hooks: [
      {
        type: "command",
        command: commandFor(spec.bundle),
        timeout: AIRS_HOOK_TIMEOUT_S,
        statusMessage: spec.statusMessage,
      },
    ],
  };
}

/** True when a matcher group contains an AIRS handler for the given bundle */
function isAirsGroup(group: CodexHookMatcherGroup, bundle: string): boolean {
  return group.hooks?.some((h) => h.command?.includes(bundle)) ?? false;
}

/** Build a fresh hooks.json config containing only the AIRS registrations */
export function buildAirsHooks(commandFor: (bundle: string) => string): CodexHooksConfig {
  const hooks: CodexHooksConfig["hooks"] = {};
  for (const spec of AIRS_HOOK_SPECS) {
    hooks[spec.event] = [buildGroup(spec, commandFor)];
  }
  return { hooks };
}

/**
 * Merge AIRS registrations into an existing hooks.json config.
 * Foreign hooks are preserved; re-merging is idempotent (matched by bundle
 * filename in the handler command).
 */
export function mergeAirsHooks(
  existing: CodexHooksConfig | null,
  commandFor: (bundle: string) => string,
): CodexHooksConfig {
  if (!existing || typeof existing !== "object" || !existing.hooks) {
    return buildAirsHooks(commandFor);
  }

  const merged: CodexHooksConfig = {
    ...existing,
    hooks: { ...existing.hooks },
  };

  for (const spec of AIRS_HOOK_SPECS) {
    const groups = merged.hooks[spec.event] ?? [];
    if (!groups.some((g) => isAirsGroup(g, spec.bundle))) {
      merged.hooks[spec.event] = [...groups, buildGroup(spec, commandFor)];
    }
  }

  return merged;
}

/** Remove AIRS registrations, pruning events left empty. Returns removal count. */
export function removeAirsHooks(existing: CodexHooksConfig): {
  config: CodexHooksConfig;
  removed: number;
} {
  const config: CodexHooksConfig = { ...existing, hooks: { ...existing.hooks } };
  let removed = 0;

  for (const spec of AIRS_HOOK_SPECS) {
    const groups = config.hooks[spec.event];
    if (!groups) continue;

    const kept = groups.filter((g) => !isAirsGroup(g, spec.bundle));
    removed += groups.length - kept.length;

    if (kept.length === 0) {
      delete config.hooks[spec.event];
    } else {
      config.hooks[spec.event] = kept;
    }
  }

  return { config, removed };
}
