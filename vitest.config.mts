import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    // Node environment by default — our pure utilities (utils, sanitize SSR
    // branch, rate-limit) do not need a DOM. Per-file overrides can switch
    // to jsdom via a `// @vitest-environment jsdom` docblock when needed.
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      reporter: ["text", "html"],
      include: ["src/lib/**/*.ts"],
    },
  },
});
