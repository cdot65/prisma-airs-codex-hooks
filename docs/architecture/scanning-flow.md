# Scanning Flow

## Prompt Scanning

```mermaid
sequenceDiagram
    participant C as Codex CLI
    participant H as UserPromptSubmit Hook
    participant S as Scanner
    participant CB as Circuit Breaker
    participant A as AIRS Sync API

    C->>H: stdin JSON { prompt, session_id, turn_id, ... }
    H->>S: scanPrompt(config, prompt, logger, correlation)
    S->>CB: shouldAllow()
    alt Circuit Open
        CB-->>S: false (bypass)
        S-->>H: { action: "pass" }
    else Circuit Closed/Half-Open
        CB-->>S: true
        S->>A: POST /v1/scan/sync/request { prompt }
        A-->>S: { action, prompt_detected }
        S->>CB: recordSuccess() / recordFailure()
        alt Enforce + Block Verdict
            S-->>H: { action: "block", message }
            H-->>C: { decision: "block", reason }
        else Allow / Observe
            S-->>H: { action: "pass" }
            H-->>C: { continue: true }
        end
    end
```

## Response Scanning (Stop — post-stream)

!!! warning "Post-stream detection"
    The `Stop` hook fires **after** the response streamed to the user — Codex has no streaming interception hook. On an AIRS block verdict the hook returns `continue: false` with a `stopReason`, terminating the turn so the session does not build on flagged content. The displayed text cannot be retracted. The Stop hook is always fail-open: config or API errors never terminate the turn.

```mermaid
sequenceDiagram
    participant C as Codex CLI
    participant U as User
    participant H as Stop Hook
    participant X as Code Extractor
    participant S as Scanner
    participant A as AIRS Sync API

    C->>U: Response streamed (already visible)
    C->>H: stdin JSON { last_assistant_message, stop_hook_active, ... }
    alt stop_hook_active
        H-->>C: { continue: true } (loop guard, no scan)
    else
        H->>S: scanResponse(config, text, logger, correlation)
        S->>X: extractCode(text)
        X-->>S: { naturalLanguage, codeBlocks[] }
        S->>A: POST /v1/scan/sync/request { response, code_response }
        A-->>S: { action, response_detected }
        alt Enforce + Block Verdict
            S-->>H: { action: "block", message }
            H-->>C: { continue: false, stopReason }
        else Allow / Observe / Error
            S-->>H: { action: "pass" }
            H-->>C: { continue: true }
        end
    end
```

## Code Extraction Strategy

The code extractor processes final responses using three strategies in priority order:

1. **Fenced code blocks** -- ` ```language ... ``` ` with language detection
2. **Indented code blocks** -- 4+ leading spaces
3. **Heuristic fallback** -- content matching code indicators (imports, function definitions, braces) above a character threshold

Extracted code is joined with `\n\n---\n\n` separators and sent in the `code_response` field, which triggers WildFire/ATP malicious code scanning on the AIRS side.

## MCP Tool Scanning (PreToolUse — can deny)

```mermaid
sequenceDiagram
    participant C as Codex CLI
    participant H as PreToolUse Hook (matcher mcp__.*)
    participant CL as Content Limits
    participant S as Scanner
    participant CB as Circuit Breaker
    participant A as AIRS Sync API

    C->>H: stdin JSON { tool_name, tool_use_id, tool_input, ... }
    alt Non-MCP tool name
        H-->>C: exit 0, no output (not scanned by design)
    else mcp__server__tool
        H->>CL: checkLimits(tool_input)
        alt Exceeds max_scan_bytes
            CL-->>H: skip (fail-open)
            H-->>C: exit 0, no output (allow)
        else Within limits
            H->>S: scanToolEvent(config, tool_input, logger, correlation)
            S->>CB: shouldAllow()
            alt Circuit Open
                CB-->>S: false (bypass)
                S-->>H: { action: "pass" }
            else Circuit Closed/Half-Open
                CB-->>S: true
                S->>A: POST /v1/scan/sync/request { tool_event }
                A-->>S: { action, prompt_detected }
                S->>CB: recordSuccess() / recordFailure()
                alt Enforce + Block Verdict
                    S-->>H: { action: "block", message }
                    H-->>C: hookSpecificOutput.permissionDecision: "deny"
                else Allow / Observe
                    S-->>H: { action: "pass" }
                    H-->>C: exit 0, no output (allow)
                end
            end
        end
    end
```

## Tool Output Scanning (PostToolUse — observe-only by policy)

!!! warning "Observe-only by policy"
    Codex **can** block tool results in `PostToolUse` (replacing the result with hook feedback), but this project runs the hook observe-only: the completed tool call's side effects can't be undone anyway, so violations are logged and warned for audit. Local Bash output and `apply_patch` edits are not scanned at all — only MCP tools match.

```mermaid
sequenceDiagram
    participant C as Codex CLI
    participant H as PostToolUse Hook (matcher mcp__.*)
    participant S as Scanner
    participant A as AIRS Sync API

    C->>H: stdin JSON { tool_name, tool_input, tool_response, ... }
    alt Non-MCP tool name
        H-->>C: exit 0, no output (not scanned by design)
    else mcp__server__tool
        H->>S: scanToolEvent(input + response)
        S->>A: POST { tool_event }
        A-->>S: { action, detected }
        alt Violation
            S-->>H: { action: "block", message }
            H-->>C: Log violation + stderr warning (no blocking output)
        else Clean
            S-->>H: { action: "pass" }
            H-->>C: exit 0, no output
        end
    end
```

## Content Splitting

| AIRS Field | Content | Detections |
|-----------|---------|------------|
| `prompt` | User's prompt text | Prompt injection, DLP, toxicity, custom topics |
| `response` | Natural language from the final response | DLP, toxicity, URL categorization |
| `code_response` | Extracted code blocks from the final response | Malicious code (WildFire/ATP) |
| `tool_event` | MCP tool inputs and outputs (`metadata.method: "tools/call"`) | Prompt injection, DLP, malicious parameters |

!!! info "Why split content?"
    Sending code separately in `code_response` enables dedicated malicious code detection engines (WildFire, ATP) that don't run on natural language content. This catches things like reverse shells, credential stealers, and obfuscated payloads in generated code. Similarly, `tool_event` is routed to a security profile tuned for tool-call patterns.

## AIRS Correlation

Every scan carries correlation IDs so all activity from one Codex session groups together in AIRS:

| Hook | AIRS `session_id` | AIRS `tr_id` |
|------|-------------------|--------------|
| `UserPromptSubmit` | Codex `session_id` | Codex `turn_id` |
| `PreToolUse` / `PostToolUse` | Codex `session_id` | Codex `turn_id:tool_use_id` |
| `Stop` | Codex `session_id` | Codex `turn_id` |

When Codex omits fields, the transaction ID falls back through `turn_id` → `tool_use_id` → `session_id`, and the AIRS session ID falls back to `app-user:date`.
