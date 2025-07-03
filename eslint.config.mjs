import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import globals from "globals";

export default defineConfig([
  // Node.js for all JS files
  {
    files: ["**/*.{js,mjs,cjs}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  // Jest for test files
  {
    files: ["**/__tests__/**/*.js", "**/*.test.js"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
  },
]);
