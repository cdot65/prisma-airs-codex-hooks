# Installation

## Prerequisites

- **Node.js 18+** (native fetch, crypto.randomUUID)
- **Codex CLI** with hooks support (hooks are enabled by default in current versions)
- **Prisma AIRS API key** (`x-pan-token`)
- **AIRS security profile** configured in Strata Cloud Manager

## Install

=== "npm (recommended)"

    ```bash
    npm install -g @cdot65/prisma-airs-codex-hooks
    ```

    This installs the CLI globally and makes the `prisma-airs-codex-hooks` command available system-wide.

=== "From source"

    ```bash
    git clone https://github.com/cdot65/prisma-airs-codex-hooks.git
    cd prisma-airs-codex-hooks
    npm install
    npm run build
    ```

## Environment Variables

Add to your shell profile (`~/.zshrc`, `~/.bashrc`, or `~/.zsh.d/`):

```bash
export PRISMA_AIRS_API_KEY=<your-x-pan-token>                         # required
export PRISMA_AIRS_PROFILE_NAME="Codex CLI - Hooks"                    # recommended
export PRISMA_AIRS_API_ENDPOINT=https://service.api.aisecurity.paloaltonetworks.com  # optional
```

!!! info "Only `PRISMA_AIRS_API_KEY` is required"
    The endpoint defaults to the US region. `PRISMA_AIRS_PROFILE_NAME` sets the AIRS security profile for all scan directions. If you need different profiles per direction, use `PRISMA_AIRS_PROMPT_PROFILE`, `PRISMA_AIRS_RESPONSE_PROFILE`, and `PRISMA_AIRS_TOOL_PROFILE` as overrides.

### Regional Endpoints

| Region | Endpoint |
|--------|----------|
| US (default) | `https://service.api.aisecurity.paloaltonetworks.com` |
| EU | `https://service-de.api.aisecurity.paloaltonetworks.com` |
| India | `https://service-in.api.aisecurity.paloaltonetworks.com` |
| Singapore | `https://service-sg.api.aisecurity.paloaltonetworks.com` |

## Validate Connectivity

=== "npm global install"

    ```bash
    prisma-airs-codex-hooks validate-connection
    prisma-airs-codex-hooks validate-detection
    ```

=== "From source"

    ```bash
    npm run validate-connection
    npm run validate-detection
    ```

## Register Hooks in Codex

=== "npm global install"

    ```bash
    prisma-airs-codex-hooks install --global
    ```

=== "From source"

    ```bash
    npm run install-hooks -- --global
    ```

This copies the self-contained hook bundles (`*.mjs`) and `airs-config.json` into `~/.codex/hooks/`, then writes the hook registrations to `~/.codex/hooks.json`. The bundles run with plain `node` — no repository or `node_modules` dependency.

Without `--global`, the installer targets the current repository instead: bundles go to `<git-root>/.codex/hooks/` and registrations to `<git-root>/.codex/hooks.json`, with commands resolved via `$(git rev-parse --show-toplevel)` so hooks work when Codex starts from a subdirectory.

!!! tip "Global installation recommended"
    Use `--global` to install hooks at `~/.codex/hooks.json` so they apply across all sessions without per-project setup. Project-level hooks only load when the project's `.codex` layer is trusted.

## Trust the Hooks in Codex

Codex requires you to review and trust non-managed hooks before they run:

1. Open Codex and run `/hooks`.
2. Review the Prisma AIRS hook definitions and trust them.

!!! warning "Trust is hash-based"
    Codex records trust against each hook definition's hash. Re-running the installer after any change to the hook commands marks them for review again — re-trust via `/hooks`.

!!! info "Older Codex versions"
    Hooks are enabled by default in current Codex. Older versions need this in `~/.codex/config.toml`:

    ```toml
    [features]
    hooks = true
    ```

    (`codex_hooks` still works as a deprecated alias.)

## Verify

=== "npm global install"

    ```bash
    prisma-airs-codex-hooks verify --global
    ```

=== "From source"

    ```bash
    npm run verify-hooks -- --global
    ```

## Uninstall

=== "npm global install"

    ```bash
    prisma-airs-codex-hooks uninstall --global
    ```

=== "From source"

    ```bash
    npm run uninstall-hooks -- --global
    ```

Removes AIRS entries from `hooks.json` while preserving other hooks. Hook bundles, config, and logs under `.codex/hooks/` are left in place.
