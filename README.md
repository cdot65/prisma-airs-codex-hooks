# Prisma AIRS Codex Hooks

Security hooks for [Codex CLI](https://developers.openai.com/codex) that scan prompts, MCP tool calls, and assistant responses through [Prisma AIRS](https://pan.dev/prisma-airs/) (AI Runtime Security) — detecting prompt injection, malicious code, DLP violations, and toxic content in the agentic loop.

Built on the [`@cdot65/prisma-airs-sdk`](https://github.com/cdot65/prisma-airs-sdk). Published as [`@cdot65/prisma-airs-codex-hooks`](https://www.npmjs.com/package/@cdot65/prisma-airs-codex-hooks) · Docs: <https://cdot65.github.io/prisma-airs-codex-hooks/>

## Coverage

| Prompt | Response | Streaming | Pre-tool (MCP) | Post-tool (MCP) | Bash / apply_patch |
|:------:|:--------:|:---------:|:--------------:|:---------------:|:------------------:|
| ✅ blocks | ⚠️ post-stream | ❌ | ✅ blocks | 👁 observe | — by design |

- **Prompt** — `UserPromptSubmit` scans prompts before Codex processes them; blocks with `{"decision":"block"}`.
- **Pre-tool** — `PreToolUse` (matcher `mcp__.*`) scans MCP tool inputs; denies via `hookSpecificOutput.permissionDecision`.
- **Post-tool** — `PostToolUse` (matcher `mcp__.*`) scans MCP tool outputs for audit; observe-only by policy.
- **Response** — `Stop` scans the final assistant message after it streamed; on an AIRS block verdict it terminates the turn (`continue:false`) but cannot retract displayed content (Codex has no streaming interception hook).
- **Bash / apply_patch** — intentionally not scanned; tool coverage is MCP-only.

## Architecture

```
User prompt ──▶ UserPromptSubmit ──▶ AIRS prompt scan ──▶ allow / block
                                       │
                          Codex agent (if allowed)
                                       │
MCP tool call ──▶ PreToolUse (mcp__.*) ──▶ AIRS tool_event scan ──▶ allow / deny
                                       │
MCP tool output ──▶ PostToolUse (mcp__.*) ──▶ AIRS scan ──▶ log / warn (observe)
                                       │
Final response ──▶ Stop ──▶ AIRS response + code_response scan ──▶ continue / terminate
```

Hooks ship as self-contained minified bundles (~125 KB each, esbuild) that run with plain `node` — no `node_modules` needed at runtime.

## Quick start

```bash
# 1. Install (pnpm workspace — corepack picks up the pinned pnpm version)
git clone https://github.com/cdot65/prisma-airs-codex-hooks.git
cd prisma-airs-codex-hooks
pnpm install && pnpm build

# 2. Configure environment (shell profile)
export PRISMA_AIRS_API_KEY="your-x-pan-token"
export PRISMA_AIRS_PROFILE_NAME="your-security-profile"

# 3. Install hooks
pnpm install-hooks              # project-level (<git-root>/.codex/)
pnpm install-hooks --global     # or user-level (~/.codex/)

# 4. Trust the hooks
#    Open Codex and run /hooks to review + trust the new hook definitions.

# 5. Validate
pnpm validate-connection
pnpm verify-hooks
```

Codex hooks are enabled by default in current Codex versions. Older versions need:

```toml
# ~/.codex/config.toml
[features]
hooks = true
```

## Configuration

`airs-config.json` lives at `.codex/hooks/airs-config.json` (project, found via parent-directory walk-up) or `~/.codex/hooks/airs-config.json` (global).

| Key | Default | Description |
|-----|---------|-------------|
| `mode` | `enforce` | `observe` (log only) / `enforce` (block on detection) / `bypass` (skip) |
| `fail_mode` | `open` | `open`: never block when AIRS is unreachable; `closed`: block prompt/tool scans on config/API errors (Stop always fails open) |
| `profiles.prompt/response/tool` | env vars | Per-direction AIRS security profiles |
| `content_limits.max_scan_bytes` | 51200 | Skip scanning above this size |
| `content_limits.truncate_bytes` | 20000 | Truncate content before scanning |
| `circuit_breaker` | enabled, 5 failures / 60s | Temporary bypass after consecutive AIRS failures |

Environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `PRISMA_AIRS_API_KEY` | Yes | x-pan-token for the AIRS API |
| `PRISMA_AIRS_PROFILE_NAME` | Recommended | Security profile for all directions |
| `PRISMA_AIRS_API_ENDPOINT` | No | Regional base URL (defaults to US) |
| `PRISMA_AIRS_PROMPT_PROFILE` / `_RESPONSE_PROFILE` / `_TOOL_PROFILE` | No | Per-direction profile overrides |

## AIRS correlation

All scans from one Codex session share an AIRS `session_id` (the Codex `session_id`); `tr_id` identifies the scan unit — `turn_id:tool_use_id` for tool scans, `turn_id` for prompt/response scans. Use the logged `scan_id`/`report_id` with the AIRS `/v1/scan/reports` endpoint for detection breakdowns.

## Commands

```bash
pnpm test                    # vitest suite
pnpm typecheck               # tsc --noEmit
pnpm build                   # tsc + esbuild bundles
pnpm install-hooks           # [--global]
pnpm uninstall-hooks         # [--global]
pnpm verify-hooks            # tamper detection
pnpm validate-connection     # AIRS connectivity
pnpm validate-detection      # detection smoke test
pnpm stats                   # scan statistics from the JSONL log
pnpm docs:serve              # Docusaurus dev server (docs-site/)
```

## Limitations

- **No streaming interception.** `Stop` fires after the response is displayed; it terminates the turn on a block verdict but cannot hide content.
- **Post-tool blocking is off by policy.** `PostToolUse` observes and logs; it never replaces tool results.
- **Bash and `apply_patch` are not scanned.** MCP-only tool coverage by design.
- **Trust flow.** Codex skips non-managed hooks until reviewed via `/hooks`; trust is hash-based, so hook definition changes require re-trusting.

## Resources

- [Codex hooks reference](https://developers.openai.com/codex/hooks)
- [Prisma AIRS API reference](https://pan.dev/airs/)
- [Prisma AIRS detection categories](https://pan.dev/prisma-airs/api/airuntimesecurity/usecases/)

## License

MIT — see [LICENSE](LICENSE).
