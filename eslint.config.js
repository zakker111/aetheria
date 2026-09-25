import globals from "globals";
import js from "@eslint/js";

export default [
  { ignores: ["node_modules/**", "tests/legacy/**"] },
  js.configs.recommended,
  {
    files: ["**/*.js", "**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      // Pragmatic settings for a large simulation codebase: errors gate CI,
      // stylistic things stay off.
      "no-unused-vars": ["warn", { args: "none", varsIgnorePattern: "^[A-Z_]" }],
      "no-constant-condition": ["error", { checkLoops: false }],
      "no-empty": ["warn", { allowEmptyCatch: true }],
      eqeqeq: "off",
      "no-case-declarations": "off",
    },
  },
];
