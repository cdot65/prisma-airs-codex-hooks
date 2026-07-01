---
"@cdot65/prisma-airs-codex-hooks": minor
---

Initial Codex CLI release, ported from prisma-airs-cursor-hooks. Adds Prisma AIRS scanning hooks for Codex: UserPromptSubmit prompt blocking, PreToolUse MCP input blocking, PostToolUse MCP output auditing (observe-only), and Stop response scanning that terminates the turn on an AIRS block verdict. Includes configurable fail_mode (open/closed), self-contained esbuild hook bundles, a .codex/hooks.json installer with trust-flow guidance, and AIRS session/transaction correlation from Codex IDs.
