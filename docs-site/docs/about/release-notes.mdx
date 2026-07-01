# Release Notes

## 0.1.0

Initial release of `@cdot65/prisma-airs-codex-hooks` — Codex CLI hooks integrating Prisma AIRS (AI Runtime Security) into the agentic workflow. Ported from [`prisma-airs-cursor-hooks`](https://github.com/cdot65/prisma-airs-cursor-hooks).

### Features

- **Prompt scanning** via the `UserPromptSubmit` hook — blocks flagged prompts with `{"decision": "block"}`
- **MCP tool input scanning** via `PreToolUse` (matcher `mcp__.*`) — denies flagged tool calls with `hookSpecificOutput.permissionDecision: "deny"`
- **MCP tool output auditing** via `PostToolUse` (matcher `mcp__.*`) — observe-only by policy; violations logged and warned
- **Final response scanning** via the `Stop` hook — post-stream; terminates the turn (`continue: false`) on an AIRS block verdict, with a `stop_hook_active` loop guard
- **MCP-only tool coverage by design** — local `Bash` commands and `apply_patch` file edits are not scanned
- **Configurable fail mode** — `fail_mode: "open"` (default) never blocks on errors; `"closed"` blocks prompts and tool calls when scanning fails; `Stop` is always fail-open
- **Three modes**: observe, enforce, bypass
- **Six detection services**: prompt injection, DLP, toxicity, malicious code, URL categorization, custom topics
- **Per-service enforcement**: block, mask, or allow independently
- **Response content splitting**: natural language in `response`, extracted code in `code_response` (WildFire/ATP)
- **Tool scans as `tool_event`** with `metadata.method: "tools/call"`
- **AIRS correlation**: `session_id` = Codex session, `tr_id` = `turn_id:tool_use_id` (tools) / `turn_id` (prompt, stop)
- **Self-contained bundles**: esbuild-minified ~125KB `.mjs` per hook — no `node_modules` at runtime
- **Installer for Codex**: writes/merges `.codex/hooks.json` (project, git-root-resolved commands) or `~/.codex/hooks.json` (`--global`), copies bundles and config, prints the `/hooks` trust reminder
- **Circuit breaker**: automatic bypass after consecutive API failures
- **Configurable content limits**: skip at 50KB, truncate at 20KB (defaults)
- **Structured logging**: JSON Lines with automatic rotation at 10MB
- **Stats CLI**: scan totals, block rates, latency percentiles
- **144 tests** across 14 suites, including compiled-JS and standalone-bundle integration tests

### Built On

- [`@cdot65/prisma-airs-sdk`](https://github.com/cdot65/prisma-airs-sdk) for AIRS API communication
- TypeScript 5.x with strict mode
- Node.js 18+ (native fetch)
- esbuild for bundling, Vitest for testing
