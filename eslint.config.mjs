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
    // Reference / vendored projects — not part of the blog codebase.
    // The NapCatQQ directory name contains full-width Chinese parentheses,
    // so we use a prefix glob to match it regardless of the suffix.
    "NapCatQQ-main*/**",
    "docs/**",
    "Slider*/**",
  ]),
]);

export default eslintConfig;
