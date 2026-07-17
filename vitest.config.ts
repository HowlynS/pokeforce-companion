import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Mirrors the "@/*" path alias in tsconfig.json without adding a
      // resolver dependency.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Next.js aliases "server-only" to a no-op when bundling server code;
      // Vitest has no equivalent step, so the real package's throwing
      // implementation would fail every unit test that imports a module
      // guarded by it. Stubbed here, for the unit suite only.
      "server-only": fileURLToPath(
        new URL("./vitest.server-only-stub.ts", import.meta.url)
      ),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Integration and service tests hit the real isolated test project and
    // belong to vitest.integration.config.ts / vitest.service.config.ts
    // only — the unit suite must never collect them. Vitest's default
    // excludes are kept alongside the extra patterns.
    exclude: [
      ...configDefaults.exclude,
      "**/*.integration.test.ts",
      "**/*.service.test.ts",
    ],
  },
});
