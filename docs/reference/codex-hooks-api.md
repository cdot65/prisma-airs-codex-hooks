# Codex Hooks API

Reference for how [Codex CLI hooks](https://developers.openai.com/codex/hooks) work and the JSON contracts used by this project.

## hooks.json

Codex discovers hooks next to active config layers (all matching hooks run):

| Scope | Path |
|-------|------|
| Project | `<repo>/.codex/hooks.json` (loads only when the project layer is trusted) |
| User | `~/.codex/hooks.json` |
| Managed | `requirements.toml` `[hooks]` (enterprise) |

### Format

The installer writes this shape (timeout is in **seconds**):

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"$(git rev-parse --show-toplevel)/.codex/hooks/user-prompt-submit.mjs\"",
            "timeout": 15,
            "statusMessage": "Prisma AIRS prompt scan"
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "mcp__.*",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$(git rev-parse --show-toplevel)/.codex/hooks/pre-tool-use.mjs\"",
            "timeout": 15,
            "statusMessage": "Prisma AIRS MCP input scan"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "mcp__.*",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$(git rev-parse --show-toplevel)/.codex/hooks/post-tool-use.mjs\"",
            "timeout": 15,
            "statusMessage": "Prisma AIRS MCP output audit"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"$(git rev-parse --show-toplevel)/.codex/hooks/stop.mjs\"",
            "timeout": 15,
            "statusMessage": "Prisma AIRS response scan"
          }
        ]
      }
    ]
  }
}
```

| Field | Description |
|-------|-------------|
| `matcher` | Regex applied per event (tool name for `PreToolUse`/`PostToolUse`). Omit to match all. |
| `type` | Only `"command"` handlers run today |
| `command` | Shell command to execute |
| `timeout` | Max execution time in **seconds** (Codex default: 600) |
| `statusMessage` | Optional status text shown while the hook runs |

!!! warning "Hooks must be trusted"
    Codex requires you to review and trust non-managed hooks via `/hooks` before they run. Trust is recorded against each definition's hash — any change requires re-trusting.

## Hook Input (stdin)

Every hook receives one JSON object on stdin with common base fields:

```json
{
  "session_id": "...",
  "transcript_path": "...",
  "cwd": "...",
  "hook_event_name": "UserPromptSubmit",
  "permission_mode": "default",
  "model": "...",
  "turn_id": "..."
}
```

### UserPromptSubmit

Additional fields:

| Field | Type | Description |
|-------|------|-------------|
| `prompt` | `string` | The user's prompt text |

### PreToolUse

Additional fields:

| Field | Type | Description |
|-------|------|-------------|
| `tool_name` | `string` | Canonical tool name — MCP tools use `mcp__server__tool` |
| `tool_use_id` | `string` | Tool-call id for this invocation |
| `tool_input` | `JSON value` | Tool-specific input; MCP tools send all arguments |

### PostToolUse

Additional fields:

| Field | Type | Description |
|-------|------|-------------|
| `tool_name` | `string` | Canonical tool name (`mcp__server__tool`) |
| `tool_use_id` | `string` | Tool-call id for this invocation |
| `tool_input` | `JSON value` | Tool-specific input |
| `tool_response` | `JSON value` | Tool output — for MCP tools, the MCP call result |

### Stop

Additional fields:

| Field | Type | Description |
|-------|------|-------------|
| `stop_hook_active` | `boolean` | Whether this turn was already continued by a `Stop` hook |
| `last_assistant_message` | `string \| null` | Latest assistant message text, if available |

## Hook Output (stdout)

### UserPromptSubmit

Allow:

```json
{ "continue": true }
```

Block:

```json
{
  "decision": "block",
  "reason": "Prisma AIRS blocked this prompt: ..."
}
```

### PreToolUse

Allow: **exit 0 with no output.**

Deny:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Prisma AIRS blocked MCP tool call: ..."
  }
}
```

!!! danger "Never emit `continue` / `stopReason` / `suppressOutput` from PreToolUse"
    Codex does not support those fields for `PreToolUse`. If a hook returns them, Codex marks the hook run as **failed** and lets the tool call proceed — the opposite of blocking.

### PostToolUse (observe-only by policy)

This project emits **nothing** (exit 0). Violations are logged to the scan log and warned on stderr.

!!! note "Codex could block here — we choose not to"
    Codex supports `{"decision": "block", "reason": "..."}` for `PostToolUse` (it replaces the tool result with your feedback). This project runs PostToolUse observe-only by design; the tool has already executed and side effects cannot be undone.

### Stop

`Stop` expects JSON on stdout when it exits 0 — **plain text is invalid** for this event.

Continue:

```json
{ "continue": true }
```

Terminate the turn (AIRS returned `action: "block"`):

```json
{
  "continue": false,
  "stopReason": "Prisma AIRS blocked this response: ..."
}
```

The hook skips scanning when `stop_hook_active` is `true` (loop guard) and always fails open on errors.

## Exit Codes

| Code | Hook | Meaning |
|------|------|---------|
| 0 | All | Success — output (if any) is parsed as JSON |
| 2 | `UserPromptSubmit` | Block, with reason from stderr (alternative to JSON; not used by this project) |
| 2 | `PreToolUse` | Deny, with reason from stderr (alternative to JSON; not used by this project) |
| Other | All | Hook error — Codex continues (hooks are not enforcement boundaries) |

## Codex Limitation: No Streaming Interception

Codex has no hook that runs while the response streams. `Stop` fires only after the final assistant message is already visible.

| Hook | What it gates |
|------|---------------|
| `UserPromptSubmit` | User prompt → agent (can block) |
| `PreToolUse` | Bash, `apply_patch`, and MCP tool calls (can deny) |
| `PermissionRequest` | Approval prompts (can allow/deny) |
| `PostToolUse` | Tool results before the agent processes them (can block the result, not the side effects) |
| `Stop` | Turn completion (can terminate, not retract) |

No hook intercepts the assistant's text before display. Practical guidance:

- **Lean on prompt-side blocking** — if AIRS catches a DLP pattern going in, the agent never sees it to echo back
- **Use `Stop` for containment** — a block verdict terminates the turn so the session doesn't keep building on flagged content
- **Use response scanning for audit** — violations are logged for compliance evidence and security team alerting

## Scope Notes

- **MCP-only tool scanning:** this project registers `mcp__.*` matchers only. Bash commands and `apply_patch` file edits are intentionally not scanned.
- **Non-shell, non-MCP tools** (e.g. web search) are not interceptable by current Codex hooks; final responses are still scanned by `Stop`.
- Full wire format: see the [Codex hooks reference](https://developers.openai.com/codex/hooks) and the generated schemas in the [Codex repository](https://github.com/openai/codex/tree/main/codex-rs/hooks/schema/generated).
