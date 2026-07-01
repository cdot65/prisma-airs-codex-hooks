# Quick Start

Get Prisma AIRS scanning in Codex in under 5 minutes.

## 1. Install

=== "npm (recommended)"

    ```bash
    npm install -g @cdot65/prisma-airs-codex-hooks
    ```

=== "From source"

    ```bash
    git clone https://github.com/cdot65/prisma-airs-codex-hooks.git
    cd prisma-airs-codex-hooks
    npm install && npm run build
    ```

## 2. Set Your API Key

```bash
export PRISMA_AIRS_API_KEY=<your-x-pan-token>
export PRISMA_AIRS_PROFILE_NAME="Codex CLI - Hooks"
```

## 3. Validate Connectivity

=== "npm global install"

    ```bash
    prisma-airs-codex-hooks validate-connection
    ```

=== "From source"

    ```bash
    npm run validate-connection
    ```

You should see a successful scan result confirming your API key and endpoint work.

## 4. Install Hooks Globally

=== "npm global install"

    ```bash
    prisma-airs-codex-hooks install --global
    ```

=== "From source"

    ```bash
    npm run install-hooks -- --global
    ```

## 5. Trust the Hooks

Open Codex and run `/hooks`. Review and trust the four Prisma AIRS hook definitions:

- `UserPromptSubmit` → prompt scanning (can block)
- `PreToolUse` (matcher `mcp__.*`) → MCP input scanning (can deny)
- `PostToolUse` (matcher `mcp__.*`) → MCP output audit (observe-only)
- `Stop` → final response scanning (terminates turn on block verdict)

!!! warning "Hooks are skipped until trusted"
    Codex will not run non-managed hooks until you review and trust them via `/hooks`. Re-trust after any installer re-run that changes the definitions.

## 6. Test It

Send a prompt in a Codex session — the `UserPromptSubmit` hook fires with the status message "Prisma AIRS prompt scan".

To test blocking, try a prompt that triggers a detection (e.g., a prompt-injection test string). If your AIRS profile is set to block, Codex refuses the prompt with a detailed message explaining what was detected and why.

## 7. Review Scan Logs

=== "npm global install"

    ```bash
    prisma-airs-codex-hooks stats
    ```

=== "From source"

    ```bash
    npm run stats
    ```

Shows scan totals, block rates, latency percentiles, and detection breakdowns.

## What's Next?

- [Configuration](configuration.md) -- tune modes, fail mode, enforcement, and profiles
- [Detection Services](../features/detection-services.md) -- what AIRS scans for
- [Architecture](../architecture/overview.md) -- how the hooks work internally
