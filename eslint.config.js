import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import jsxA11yPlugin from "eslint-plugin-jsx-a11y";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
        ecmaFeatures: { jsx: true },
      },
      // Browser + Web Platform globals (fetch, window, document, console, AbortController…)
      globals: globals.browser,
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
      "jsx-a11y": jsxA11yPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      // TypeScript (via the project's tsconfig) already checks undefined vars;
      // no-undef false-positives on type-only references (React.ReactNode,
      // ambient const __APP_VERSION__, import.meta.env, …)
      "no-undef": "off",
      // Newer plugin versions flag patterns this codebase deliberately uses:
      // setState during effects (initializing derived state), JSON.stringify with
      // useMemo/useCallback, and a jsx-a11y rule whose plugin isn't installed.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/use-memo": "off",
      "jsx-a11y/no-autofocus": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
    },
    settings: {
      react: { version: "detect" },
    },
  },
];
