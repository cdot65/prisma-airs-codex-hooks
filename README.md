# Prisma AIRS Codex Hooks

[Codex CLI](https://developers.openai.com/codex) hooks that scan prompts, MCP tool calls, and assistant responses through [Prisma AIRS](https://pan.dev/prisma-airs/) — blocking prompt injection, malicious code, DLP violations, and toxic content inside the agentic loop.

**Docs: <https://cdot65.github.io/prisma-airs-codex-hooks/>** — architecture, configuration reference, hook contracts, and development guides all live there.

## Coverage

|  Prompt   |         Response         | Pre-tool (MCP) | Post-tool (MCP) | Bash / apply_patch |
| :-------: | :----------------------: | :------------: | :-------------: | :----------------: |
| ✅ blocks | ⚠️ post-stream terminate |   ✅ blocks    |    👁 observe    |    — by design     |

## Setup

```bash
git clone https://github.com/cdot65/prisma-airs-codex-hooks.git
cd prisma-airs-codex-hooks
pnpm install && pnpm build

export PRISMA_AIRS_API_KEY="your-x-pan-token"
export PRISMA_AIRS_PROFILE_NAME="your-security-profile"

pnpm install-hooks              # project-level (<git-root>/.codex/)
pnpm install-hooks --global     # or user-level (~/.codex/)
```

Then open Codex, run `/hooks`, and trust the new hook definitions (required — trust is hash-based; re-trust after any reinstall).

Verify:

```bash
pnpm validate-connection
pnpm verify-hooks
```

## Everything else

[Installation options](https://cdot65.github.io/prisma-airs-codex-hooks/getting-started/installation) · [Configuration](https://cdot65.github.io/prisma-airs-codex-hooks/getting-started/configuration) (`mode`, `fail_mode`, profiles, content limits) · [Hook contracts](https://cdot65.github.io/prisma-airs-codex-hooks/reference/codex-hooks-api) · [CLI commands](https://cdot65.github.io/prisma-airs-codex-hooks/reference/cli-commands) · [Architecture](https://cdot65.github.io/prisma-airs-codex-hooks/architecture/overview) · [Contributing](https://cdot65.github.io/prisma-airs-codex-hooks/development/contributing)

MIT — see [LICENSE](LICENSE).
