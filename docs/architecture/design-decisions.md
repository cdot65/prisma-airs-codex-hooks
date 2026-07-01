# Design Decisions

## Configurable Fail Mode (Open by Default)

`fail_mode` in `airs-config.json` controls what happens when scanning itself fails (config missing, AIRS unreachable, timeout, circuit open):

- **`"open"` (default)** — every error path resolves to allowing the prompt/tool call through. Blocking a developer's workflow due to infrastructure issues is unacceptable; security scanning is a guardrail, not a gate.
- **`"closed"`** — config and API errors block prompts (`UserPromptSubmit`) and MCP tool calls (`PreToolUse`). For environments where an unscanned prompt is worse than a stalled workflow.

The `Stop` hook is **always fail-open** regardless of `fail_mode`: the response has already been displayed, so blocking on error accomplishes nothing. stdin parse errors also always allow — malformed hook input is a bug, not a security event. The fail-closed intent survives config validation errors via a best-effort `readFailMode()` that reads only the `fail_mode` key.

## MCP-Only Tool Scanning

`PreToolUse` and `PostToolUse` register with the `mcp__.*` matcher — **local `Bash` commands and `apply_patch` file edits are intentionally not scanned**. MCP tools bring external, untrusted content (files from remote repos, API responses, web content) into the agent loop, which is where prompt injection and data exfiltration risk concentrates. Local shell and edit activity is the developer's own machine at work; scanning it adds an AIRS round-trip of latency to every command for little security signal. The hook entry points also skip non-MCP tool names internally as defense-in-depth.

## PostToolUse Is Observe-Only by Policy

Codex **can** block at `PostToolUse` (it replaces the tool result with hook feedback and can stop processing with `continue: false`). This project chooses not to: the tool already executed, side effects can't be undone, and replacing results mid-turn is disruptive. Violations in MCP tool outputs are logged to the audit trail and warned on stderr instead. The blocking hooks — `UserPromptSubmit` and `PreToolUse` — are the enforcement gates.

- **Prompt scanning** (`UserPromptSubmit`) is a **gate** — prevents violations from reaching the agent
- **MCP input scanning** (`PreToolUse`) is a **gate** — denies malicious tool invocations before execution
- **MCP output scanning** (`PostToolUse`) is an **audit trail** — compliance evidence and alerting
- **Response scanning** (`Stop`) is **audit + termination** — see below

## Stop Terminates on Block Verdict

Codex has no streaming interception hook — the final response is fully displayed before `Stop` fires. When AIRS returns an `action: "block"` verdict for the response scan (in `enforce` mode), the hook returns `{ "continue": false, "stopReason": "..." }`: the displayed text can't be retracted, but the turn is terminated so the session doesn't keep building on flagged content. A `stop_hook_active` loop guard skips scanning when the turn was already continued by a Stop hook.

## Codex Hook Contracts Differ Per Event

Each Codex event has its own stdout contract, encoded in `src/adapters/codex-adapter.ts`:

- `UserPromptSubmit` (**can block**): `{ "decision": "block", "reason": "..." }`; allow with `{ "continue": true }`
- `PreToolUse` (**can deny**): `hookSpecificOutput.permissionDecision: "deny"` — it must **not** emit `continue`/`stopReason`/`suppressOutput` or Codex marks the hook run failed and lets the tool call proceed; allow is a silent exit 0
- `PostToolUse` (**can block; we don't**): observe-only means no stdout at all
- `Stop`: stdout **must** be JSON (plain text is invalid for this event) — `{ "continue": true }` or `{ "continue": false, "stopReason": "..." }`

MCP tool names use Codex's `mcp__server__tool` format, parsed by `src/tool-name-parser.ts`.

## Self-Contained Bundles

Each hook builds to a single minified ESM file (~125KB, esbuild, SDK bundled in) that runs with plain `node` from any directory — no `node_modules`, no dependency on this repository. The installer copies bundles into `.codex/hooks/` (project) or `~/.codex/hooks/` (global). Hooks run as fresh processes on every event, so cold-start time matters; a bundle eliminates module resolution and keeps startup fast.

## Hook Trust Flow

Codex requires non-managed hooks to be reviewed and trusted (via `/hooks` in the CLI) before they run, with trust recorded against the hook definition's hash. The installer prints a reminder after every install: re-running it after changes requires re-trusting. Project-level hooks additionally only load when the project's `.codex` layer is trusted.

## Tool Event Scanning

MCP tool calls are scanned using the `tool_event` AIRS content type with `metadata.method: "tools/call"` plus the parsed server and tool names. This routes to a security profile tuned for tool-call patterns (function names, parameter values, injection attempts via tool arguments). `PreToolUse` sends the input; `PostToolUse` sends input and response together.

## AIRS Correlation

AIRS `session_id` is set to the Codex `session_id`, so every scan from one Codex session groups together. AIRS `tr_id` identifies the scan unit: `turn_id:tool_use_id` for tool scans, `turn_id` for prompt and stop scans, with fallbacks when Codex omits fields.

## Configurable Content Limits

Large inputs (multi-file MCP reads, huge responses) can exceed what the AIRS API can meaningfully scan. Two thresholds are configurable in `content_limits`:

- `max_scan_bytes` (default 50KB): inputs larger than this are **skipped** entirely (fail-open)
- `truncate_bytes` (default 20KB): inputs between `truncate_bytes` and `max_scan_bytes` are **truncated** before scanning

This prevents excessive latency and API errors while ensuring most real-world inputs are fully scanned.

## Three-Mode System

- **Observe**: Deploy first to audit what AIRS detects without disrupting developers
- **Enforce**: Enable blocking once you've tuned your AIRS profiles and reviewed false positives in the scan logs
- **Bypass**: Disable scanning without uninstalling hooks (debugging, incidents)

## Per-Service Enforcement

Each AIRS detection service (prompt injection, DLP, toxicity, malicious code, URL categorization, custom topics) can be configured with independent enforcement actions. This enables:

- Block prompt injection but only log toxicity
- Mask DLP findings instead of blocking
- Allow URL categorization findings through while blocking everything else

## Global Config Fallback

Config search walks up from the working directory looking for `.codex/hooks/airs-config.json` (Codex may start hooks from a repo subdirectory), then falls back to `~/.codex/hooks/airs-config.json`. This enables global hook installation with a single config file that works across all Codex sessions.

## SDK Integration

Built on `@cdot65/prisma-airs-sdk` rather than raw HTTP. This inherits:

- HMAC payload signing
- Retry with exponential backoff
- Response type safety
- Auth header management
