import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Unit tests live next to source as src/**/*.test.ts. Playwright owns
// tests/e2e/**/*.spec.ts — the include/exclude keep the two runners disjoint.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["tests/**", "node_modules/**", ".next/**"],
    environment: "node",
  },
});
