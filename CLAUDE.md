# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Codex CLI hooks integrating Prisma AIRS (AI Runtime Security) into the agentic workflow. Scans user prompts (UserPromptSubmit, **can block**), MCP tool inputs (PreToolUse `mcp__.*`, **can block**), MCP tool outputs (PostToolUse `mcp__.*`, **observe-only by policy**), and final assistant responses (Stop, **post-stream — terminates session on AIRS block verdict**) via Codex's hooks system against the Prisma AIRS Sync API for prompt injection, malicious code, DLP violations, and toxicity.

Local Bash commands and `apply_patch` file edits are **intentionally not scanned** (design decision — MCP-only tool coverage).

Published as `@cdot65/prisma-airs-codex-hooks` on npm.

## Tech Stack

- **Language:** TypeScript (strict mode, nodenext module resolution)
- **Runtime:** Node.js 18+ (native fetch, crypto.randomUUID)
- **Build:** esbuild → single-file minified `.mjs` bundles per hook (self-contained, SDK bundled); tsc for typecheck
- **Test framework:** vitest
- **Package manager:** npm
- **Docs:** MkDocs Material
- **CI:** GitHub Actions (typecheck, build, test, docs-build)
- **Publish:** npm OIDC via GitHub Actions on release

## Commands

```bash
# install deps
npm install

# run all tests
npm test

# run single test
npx vitest run test/airs-client.test.ts

# type check
npm run typecheck

# build bundled JS
npm run build

# validate AIRS connectivity
npm run validate-connection

# validate detection
npm run validate-detection

# install hooks globally
npm run install-hooks -- --global

# verify hooks
npm run verify-hooks

# scan stats
npm run stats
```

## Architecture

```
User prompt → UserPromptSubmit hook → AIRS Sync API (prompt scan) → allow / block ({"decision":"block"})
                                            ↓
                          Codex agent (if allowed)
                                            ↓
MCP tool call → PreToolUse hook (matcher mcp__.*) → AIRS (tool_event scan) → allow / deny (hookSpecificOutput.permissionDecision)
                                            ↓
MCP tool output → PostToolUse hook (matcher mcp__.*) → AIRS scan → log/warn (observe-only by policy)
                                            ↓
Final response → Stop hook → code extractor → AIRS (response + code_response scan) → continue:true / continue:false on AIRS action:block
```

### Hook Contracts (Codex)

Every hook receives one JSON object on stdin with common fields: `session_id`, `transcript_path`, `cwd`, `hook_event_name`, `permission_mode`, `model`; turn-scoped events add `turn_id`.

- **UserPromptSubmit** (can block): stdin adds `prompt`. Block: stdout `{"decision":"block","reason":"..."}`. Allow: exit 0, no blocking output.
- **PreToolUse** (can block): stdin adds `tool_name`, `tool_use_id`, `tool_input`. Deny: `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"..."}}`. NEVER emit `continue`/`stopReason`/`suppressOutput` — Codex marks the hook run failed.
- **PostToolUse** (can block; we run observe-only): stdin adds `tool_response`. Observe-only: log violations to stderr/log file, exit 0.
- **Stop** (post-stream): stdin adds `stop_hook_active`, `last_assistant_message`. Stdout MUST be JSON (plain text invalid). Terminate on AIRS `action:"block"`: `{"continue":false,"stopReason":"..."}`; else `{"continue":true}`. Skip scan when `stop_hook_active` is true (loop guard).

MCP tool names use `mcp__server__tool` format.

### Core Modules

| Module | Purpose |
|---|---|
| `src/config.ts` | Load/validate airs-config.json (project `.codex/hooks/` → `~/.codex/hooks/` fallback); `fail_mode` open/closed |
| `src/airs-client.ts` | SDK wrapper with circuit breaker |
| `src/logger.ts` | Structured JSON Lines logging with rotation |
| `src/types.ts` | Codex hook I/O + shared TypeScript interfaces |
| `src/hooks/user-prompt-submit.ts` | Codex UserPromptSubmit entry point (can block) |
| `src/hooks/pre-tool-use.ts` | Codex PreToolUse entry point, MCP-only (can block) |
| `src/hooks/post-tool-use.ts` | Codex PostToolUse entry point, MCP-only (observe-only) |
| `src/hooks/stop.ts` | Codex Stop entry point (post-stream; terminates on block verdict) |
| `src/code-extractor.ts` | Separates fenced/indented code blocks from natural language |
| `src/scanner.ts` | Orchestrates prompt vs response scanning + DLP masking |
| `src/tool-name-parser.ts` | Parse `mcp__server__tool` format |
| `src/content-limits.ts` | Configurable skip/truncate before scanning |
| `src/circuit-breaker.ts` | Failure tracking with cooldown bypass |
| `src/cli.ts` | CLI entry point (`prisma-airs-codex-hooks` command) |

### Key Design Decisions

- **Configurable fail mode**: `fail_mode: "open"` (default — never block developer if AIRS unreachable) or `"closed"` (block on config/API errors) for prompt + pre-tool hooks. Stop hook is always fail-open (response already displayed).
- **Three modes**: `observe` (log only), `enforce` (block on detection), `bypass` (skip)
- **MCP-only tool scanning**: Bash and `apply_patch` are not hooked — matchers register only `mcp__.*`
- **PostToolUse observe-only by policy**: Codex can block tool results, but default config only logs
- **Stop terminates on AIRS block verdict**: `continue:false` + `stopReason` when scan returns `action:"block"`; detection is post-display (cannot hide content)
- **Separate AIRS profiles**: `profiles.prompt`, `profiles.response`, `profiles.tool`
- **Response scanning splits content**: natural language in `response` field, extracted code in `code_response`
- **Tool scanning uses `tool_event`**: MCP inputs/outputs as `tool_event` content with `method: "tools/call"`
- **AIRS correlation**: AIRS `session_id` = Codex `session_id`; `transaction_id` = `turn_id:tool_use_id` for tools, `turn_id` for prompt/stop
- **Configurable content limits**: `content_limits.max_scan_bytes` (skip threshold, default 50KB), `content_limits.truncate_bytes` (default 20KB)
- **Self-contained bundles**: esbuild minified `.mjs` per hook — no node_modules needed at runtime, fast startup
- **Circuit breaker**: after N consecutive failures, temporarily bypass with periodic retry
- **Trust flow**: Codex requires reviewing/trusting non-managed hooks via `/hooks`; trust is hash-based — users must re-trust after hooks.json definition changes

### AIRS API

- **Endpoint:** `POST https://service.api.aisecurity.paloaltonetworks.com/v1/scan/sync/request`
- **Auth:** `x-pan-token` header from `PRISMA_AIRS_API_KEY` env var
- **Prompt scan content:** `{ "prompt": "<text>" }`
- **Response scan content:** `{ "response": "<natural-lang>", "code_response": "<code>" }`
- **Tool scan content:** `{ "tool_event": "<tool-input-or-output>" }`

### Configuration

Hooks register in `.codex/hooks.json` (project) or `~/.codex/hooks.json` (global). AIRS config lives at `.codex/hooks/airs-config.json` or `~/.codex/hooks/airs-config.json`. Environment variables:
- `PRISMA_AIRS_API_KEY` — x-pan-token for AIRS API (required)
- `PRISMA_AIRS_PROFILE_NAME` — AIRS security profile for all directions (recommended)
- `PRISMA_AIRS_API_ENDPOINT` — regional API base URL (optional, defaults to US)
- `PRISMA_AIRS_PROMPT_PROFILE` — override profile for prompt scanning (optional)
- `PRISMA_AIRS_RESPONSE_PROFILE` — override profile for response scanning (optional)
- `PRISMA_AIRS_TOOL_PROFILE` — override profile for tool/MCP scanning (optional)

Codex hooks are enabled by default in current Codex; older versions need `[features] hooks = true` (deprecated alias `codex_hooks`) in `~/.codex/config.toml`.

## Workflow

- Every change: GitHub issue → branch `cdot65/<type>/<slug>` → TDD → quality gates → docs → PR → CI → squash merge. Use `gh` CLI.
- Never commit as Claude; use repo git config user.
