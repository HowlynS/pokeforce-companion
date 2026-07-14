import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Separate Vitest configuration for integration tests that talk to the real
// isolated Supabase TEST database. Kept apart from vitest.config.ts so that
// `pnpm test:unit` stays fast and database-free while
// `pnpm test:integration` runs the guarded database suite.
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
    include: ["src/**/*.integration.test.ts"],
    // The integration tests share one database and one seeded fixture set,
    // so files and workers must never run in parallel.
    fileParallelism: false,
    maxWorkers: 1,
    // Real network round-trips to the test database are slower than unit
    // tests; allow for a cold pooled connection.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
