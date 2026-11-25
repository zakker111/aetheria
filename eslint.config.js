import globals from "globals";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  { ignores: ["node_modules/**", "dist/**", "tests/legacy/**"] },
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
  ...tseslint.configs.recommended.map((cfg) => ({
    ...cfg,
    files: ["**/*.ts", "**/*.tsx"],
  })),
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^[A-Z_]" },
      ],
      "no-empty": ["warn", { allowEmptyCatch: true }],
    },
  },
];
