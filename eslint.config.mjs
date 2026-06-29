import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated/vendor assets copied from @mediapipe/tasks-vision.
    "public/mediapipe-wasm/**",
  ]),
  {
    rules: {
      // Existing app code intentionally syncs local UI state from props/fetches in effects.
      // The React 19 compiler rule is too broad for this codebase right now.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react/no-unescaped-entities": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: [
      "**/*.js",
      "mobile/**/*.{js,ts,tsx}",
      "mobile/plugins/**/*.js",
      "mobile/scripts/**/*.js",
      "mobile/metro.config.js",
    ],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);

export default eslintConfig;
