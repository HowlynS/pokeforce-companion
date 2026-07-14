import { defineConfig, devices } from "@playwright/test";

// Chromium-only browser tests against the isolated Supabase TEST project.
// The web server is started through scripts/start-test-server.ts, which
// loads .env.test.local and runs the fail-closed environment guard before
// Next.js boots — a misconfigured environment fails the whole run instead
// of silently testing against development data.
export default defineConfig({
  testDir: "./e2e",
  // One worker, no parallelism: the tests share one seeded database and one
  // dev server, and serial runs keep database load predictable.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  // Dev-server compilation on first visit to each route is slow; give every
  // test generous room without hiding real hangs.
  timeout: 60_000,
  use: {
    // "localhost", not 127.0.0.1: Next.js dev treats other hosts as
    // cross-origin and blocks its own dev resources, which breaks hydration
    // (the built-in not-found page renders client-side and would stay blank).
    baseURL: "http://localhost:3100",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm exec tsx scripts/start-test-server.ts",
    url: "http://localhost:3100",
    // Never reuse an already-running server: it could be the normal dev
    // server running against development values.
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
