// Guarded launcher for the Playwright test web server. Loads ONLY
// .env.test.local (override: true) and runs the existing fail-closed guard
// BEFORE the Next.js dev server starts, so the browser app can never run
// against the normal development .env — the validated test values are
// already present in this process's environment and take precedence over
// anything Next.js would load on its own. Creates no Prisma, Supabase,
// Auth, or Storage client and prints no secrets.

import { spawn } from "node:child_process";
import { loadTestEnvironment } from "../src/lib/testing/load-test-environment";

// Throws with a readable, secret-free message if the environment is not the
// isolated Supabase test project; the server below then never starts.
loadTestEnvironment();

// Fixed test port, distinct from the normal dev server's 3000 so a running
// development instance can never be mistaken for the test server.
const PORT = "3100";

// One fixed command string through the shell: pnpm is a .cmd shim on
// Windows and needs a shell to resolve, and a single string avoids Node's
// warning about combining an args array with the shell option. Nothing in
// the command is user-controlled.
const child = spawn(`pnpm exec next dev --port ${PORT}`, {
  stdio: "inherit",
  env: process.env,
  shell: true,
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    child.kill(signal);
  });
}
