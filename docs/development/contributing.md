# Contributing

## Setup

```bash
git clone https://github.com/cdot65/prisma-airs-codex-hooks.git
cd prisma-airs-codex-hooks
npm install
```

## Development Workflow

### Source Changes

Edit TypeScript in `src/`. After changes:

```bash
npm run build      # compile to dist/ + bundle dist/hooks/*.mjs
npm test           # run all tests
npm run typecheck  # type check
```

`npm run build` runs `tsc` and then esbuild, producing self-contained minified bundles in `dist/hooks/*.mjs` — these are the artifacts the installer copies into `.codex/hooks/`.

### Development Mode Hooks

For rapid iteration, point `.codex/hooks.json` at TypeScript source (no rebuild needed):

```json
{
  "type": "command",
  "command": "npx tsx \"/path/to/src/hooks/user-prompt-submit.ts\"",
  "timeout": 30
}
```

This adds ~1.5s per invocation. Switch back to the bundles for production:

```bash
npm run build
npm run install-hooks -- --global
```

!!! note "Re-trust after changes"
    Codex records hook trust against the definition's hash. After editing `hooks.json` (including switching between dev and production commands), open Codex and run `/hooks` to re-trust the changed definitions.

### Running Tests

```bash
npm test              # all tests once
npm run test:watch    # watch mode
```

Tests include:

- **Unit tests**: config, scanner, code-extractor, circuit-breaker, DLP masking, logger, log rotation, tool-name parser, codex adapter, hooks-config
- **Integration tests**: end-to-end hook execution via `npx tsx`, compiled `node dist/`, and standalone bundle runs with piped JSON

### Adding a Test

Tests live in `test/` and use vitest. Each module has a corresponding test file:

```
src/scanner.ts     → test/scanner.test.ts
src/config.ts      → test/config.test.ts
```

## Project Structure

```
src/                    TypeScript source
  hooks/                Hook entry points (stdin → scan → stdout)
  adapters/             Codex stdout payload builders
dist/                   Compiled JS + bundled .mjs hooks (git-ignored)
scripts/                CLI utilities (install, validate, stats, bundling)
test/                   Vitest test suites
docs/                   MkDocs documentation
```

## Pull Request Guidelines

- Branch from `main`
- Ensure `npm test` and `npm run typecheck` pass
- Include tests for new functionality
- Run `npm run build` to verify compilation and bundling
