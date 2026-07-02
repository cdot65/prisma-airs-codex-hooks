import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/", "coverage/", "docs-site/", ".codex/", ".claude/", "node_modules/"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.mjs"],
    languageOptions: {
      globals: { console: "readonly", process: "readonly" },
    },
  },
  {
    rules: {
      // hooks normalize unknown stdin payloads; explicit any stays usable in tests
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
);
