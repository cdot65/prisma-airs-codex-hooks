---
title: Home
---

<div class="hero" markdown>

![Prisma AIRS Codex Hooks](images/logo.svg){ .hero-logo }

# Prisma AIRS Codex Hooks

**Real-time AI security scanning for the Codex CLI**

[![npm](https://img.shields.io/npm/v/@cdot65/prisma-airs-codex-hooks.svg)](https://www.npmjs.com/package/@cdot65/prisma-airs-codex-hooks)
[![CI](https://github.com/cdot65/prisma-airs-codex-hooks/actions/workflows/ci.yml/badge.svg)](https://github.com/cdot65/prisma-airs-codex-hooks/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node 18+](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org/)

</div>

---

Prisma AIRS Codex Hooks scans prompts, MCP tool traffic, and final responses in the [Codex CLI](https://developers.openai.com/codex) in real-time via the [Prisma AI Runtime Security (AIRS)](https://www.paloaltonetworks.com/prisma/ai-runtime-security) Sync API. **Blocks** prompts and MCP tool calls before they execute, and **audits** tool outputs and final responses for prompt injections, malicious code, sensitive data leakage, toxic content, and policy violations.

---

## Install

```bash
npm install -g @cdot65/prisma-airs-codex-hooks
```

---

## How It Works

```mermaid
flowchart LR
    A[User Prompt] --> B[UserPromptSubmit Hook]
    B -->|AIRS Scan| C{Verdict}
    C -->|Allow| D[Codex Agent]
    C -->|Block| E[decision: block]
    D --> F[MCP Tool Call]
    F --> G[PreToolUse Hook<br/>matcher mcp__.*]
    G -->|AIRS Scan| H{Verdict}
    H -->|Allow| I[Tool Execution]
    H -->|Deny| J[permissionDecision: deny]
    I --> K[Tool Output]
    K --> L[PostToolUse Hook<br/>matcher mcp__.*]
    L -->|AIRS Scan| M[Log + Warn]
    D --> N[Final Response]
    N --> O[Streamed to User]
    O --> P[Stop Hook]
    P -->|AIRS Scan| Q{Verdict}
    Q -->|Clean| R[continue: true]
    Q -->|Block verdict| S[continue: false<br/>turn terminated]
```

!!! warning "PostToolUse and Stop fire after the fact"
    `PostToolUse` fires after the MCP tool already executed (this project runs it observe-only by policy), and `Stop` fires after the response has already streamed to the user. `Stop` terminates the turn on an AIRS block verdict so the session doesn't keep building on flagged content, but it cannot retract what was displayed. See [Codex Hooks API](reference/codex-hooks-api.md#codex-limitation-no-streaming-interception).

!!! note "Bash and file edits are not scanned"
    By design, this project scans **MCP tools only** (`mcp__.*` matchers). Local Bash commands and `apply_patch` file edits are not sent to AIRS.

---

## Capabilities

<div class="grid cards" markdown>

-   :material-shield-search:{ .lg .middle } **Prompt Scanning**

    ---

    Scans every prompt before Codex processes it. Detects prompt injection, DLP violations, toxicity, and custom topic policy violations.

    [:octicons-arrow-right-24: Detection Services](features/detection-services.md)

-   :material-code-braces:{ .lg .middle } **Response & Code Auditing**

    ---

    Parses the final assistant message to extract code blocks separately. Natural language and code are scanned independently; an AIRS block verdict terminates the turn (post-stream).

    [:octicons-arrow-right-24: Code Extraction](features/code-extraction.md)

-   :material-tools:{ .lg .middle } **MCP Tool Scanning**

    ---

    Scans MCP tool inputs before execution (`PreToolUse`, can deny) and tool outputs after execution (`PostToolUse`, observe-only by policy). Both sent to AIRS as `tool_event` content.

    [:octicons-arrow-right-24: Architecture](architecture/scanning-flow.md)

-   :material-shield-lock:{ .lg .middle } **Enforce or Observe**

    ---

    Three modes: `observe` (log only), `enforce` (block on detection), `bypass` (skip). Plus `fail_mode` to choose fail-open or fail-closed behavior on errors.

    [:octicons-arrow-right-24: Configuration](reference/configuration.md)

-   :material-lightning-bolt:{ .lg .middle } **Fail-Open by Default**

    ---

    Never blocks the developer on infrastructure failures unless you opt into `fail_mode: "closed"`. Circuit breaker pattern bypasses scanning after consecutive API failures with automatic recovery.

    [:octicons-arrow-right-24: Circuit Breaker](features/circuit-breaker.md)

-   :material-package-variant-closed:{ .lg .middle } **Self-Contained Bundles**

    ---

    Each hook ships as a single minified ~125KB `.mjs` bundle that runs with plain `node` — no `node_modules` at runtime, fast startup.

    [:octicons-arrow-right-24: Installation](getting-started/installation.md)

</div>

---

## Get Started

<div class="grid cards" markdown>

-   :material-download:{ .lg .middle } **Install**

    ---

    Install from npm, set environment variables, and register hooks in Codex.

    [:octicons-arrow-right-24: Installation](getting-started/installation.md)

-   :material-rocket-launch:{ .lg .middle } **Quick Start**

    ---

    Get scanning in under 5 minutes.

    [:octicons-arrow-right-24: Quick Start](getting-started/quick-start.md)

-   :material-cog:{ .lg .middle } **Configure**

    ---

    Modes, fail mode, enforcement actions, profiles, circuit breaker, and logging.

    [:octicons-arrow-right-24: Configuration](getting-started/configuration.md)

-   :material-book-open-variant:{ .lg .middle } **Architecture**

    ---

    Scanning flow, module design, and key decisions.

    [:octicons-arrow-right-24: Architecture](architecture/overview.md)

</div>
