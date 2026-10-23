// ESLint looks for real problems in the code (unused variables, missing awaits, ...)
// Prettier handles the layout, so every style rule that would fight it is off
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  { ignores: ["node_modules/", "coverage/"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
    },
    rules: {
      // a "_" at the start says "unused on purpose" (like _req or _doc)
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      // too noisy for now: res.locals and error objects are often untyped
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    // jest.config.js is CommonJS, so it may use module.exports
    files: ["**/*.js"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  prettier,
);
