import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/.next/**",
      "**/dist/**",
      "**/next-env.d.ts",
      "**/coverage/**",
      "playwright-report/**",
      "test-results/**",
      "packages/database/src/generated/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
);
