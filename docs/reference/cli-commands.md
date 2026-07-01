# CLI Commands

## `prisma-airs-codex-hooks` CLI

After installing globally with `npm install -g @cdot65/prisma-airs-codex-hooks`:

| Command | Description |
|---------|-------------|
| `prisma-airs-codex-hooks install [--global]` | Register hooks in Codex's hooks.json and copy bundles |
| `prisma-airs-codex-hooks uninstall [--global]` | Remove AIRS entries from hooks.json |
| `prisma-airs-codex-hooks verify [--global]` | Check hooks registration, bundles, config, and env vars |
| `prisma-airs-codex-hooks validate-connection` | Test AIRS API connectivity with your credentials |
| `prisma-airs-codex-hooks validate-detection` | Send a test prompt injection and verify detection |
| `prisma-airs-codex-hooks stats [--since <duration>] [--json]` | Show scan statistics |

### Examples

```bash
# Install hooks for all Codex sessions
prisma-airs-codex-hooks install --global

# Check everything is working
prisma-airs-codex-hooks verify --global

# Stats for the last 7 days as JSON
prisma-airs-codex-hooks stats --since 7d --json

# Remove hooks
prisma-airs-codex-hooks uninstall --global
```

!!! warning "Trust after install"
    After `install`, open Codex and run `/hooks` to review and trust the new hook definitions — Codex skips untrusted hooks.

## npm run scripts (from source)

When working from a cloned repository:

### Build & Test

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript and bundle hooks to `dist/hooks/*.mjs` |
| `npm test` | Run all tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run typecheck` | TypeScript type checking (`tsc --noEmit`) |

### Hook Management

| Command | Description |
|---------|-------------|
| `npm run install-hooks` | Install hooks to `<git-root>/.codex/hooks.json` (project-level) |
| `npm run install-hooks -- --global` | Install hooks to `~/.codex/hooks.json` (all sessions) |
| `npm run uninstall-hooks` | Remove AIRS entries from project-level hooks.json |
| `npm run uninstall-hooks -- --global` | Remove AIRS entries from global hooks.json |
| `npm run verify-hooks` | Check hooks registration, bundles, config, and env vars |

### Validation

| Command | Description |
|---------|-------------|
| `npm run validate-connection` | Test AIRS API connectivity with your credentials |
| `npm run validate-detection` | Send a test prompt injection and verify detection |

### Statistics

| Command | Description |
|---------|-------------|
| `npm run stats` | Show scan statistics (last 24h) |
| `npm run stats -- --since 7d` | Stats for the last 7 days |
| `npm run stats -- --since 1d --json` | Stats as JSON output |

### Documentation

| Command | Description |
|---------|-------------|
| `mkdocs serve` | Local docs preview at `http://localhost:8000` |
| `mkdocs build` | Build static docs site to `site/` |
