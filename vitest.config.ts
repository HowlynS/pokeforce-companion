import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Mirrors the "@/*" path alias in tsconfig.json without adding a
      // resolver dependency.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Integration tests hit the real isolated test database and belong to
    // vitest.integration.config.ts only — the unit suite must never collect
    // them. Vitest's default excludes are kept alongside the extra pattern.
    exclude: [...configDefaults.exclude, "**/*.integration.test.ts"],
  },
});
