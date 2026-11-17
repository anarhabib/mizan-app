import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/.next/**",
      "**/dist/**",
      "**/next-env.d.ts",
      "**/coverage/**",
      "packages/database/src/generated/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
);
