import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Separate Vitest configuration for service-level tests that talk to the
// real isolated Supabase test project's Auth and Storage over the network.
// Kept apart from the unit and database-integration configs so each suite
// stays independently runnable: `pnpm test:service` runs only these files.
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
    include: ["src/**/*.service.test.ts"],
    // The service tests share one Auth admin and one Storage bucket, so
    // files and workers must never run in parallel.
    fileParallelism: false,
    maxWorkers: 1,
    // Real Auth and Storage round-trips (sign-in, upload, public fetch)
    // are slower than unit tests; allow for cold connections.
    testTimeout: 45_000,
    hookTimeout: 45_000,
  },
});
