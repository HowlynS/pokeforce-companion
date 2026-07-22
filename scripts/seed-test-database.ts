// Guarded launcher for running the deterministic seed against the ISOLATED
// Supabase test project. Loads ONLY .env.test.local (override: true) and
// runs the existing fail-closed guard BEFORE prisma/seed.ts runs, so the
// seed can never be run against the normal development project by mistake —
// the same pattern as scripts/migrate-test-database.ts and
// scripts/start-test-server.ts. The validated test values are already
// present in this process's environment; prisma/seed.ts's own
// `import "dotenv/config"` never overrides existing values, so the test
// DATABASE_URL wins. Prints no secrets.

import { spawn } from "node:child_process";
import { loadTestEnvironment } from "../src/lib/testing/load-test-environment";

// Throws with a readable, secret-free message if the environment is not the
// isolated Supabase test project; the seed below then never runs.
loadTestEnvironment();

// One fixed command string through the shell: pnpm/tsx are .cmd shims on
// Windows and need a shell to resolve. Nothing in the command is
// user-controlled.
const child = spawn("pnpm exec tsx prisma/seed.ts", {
  stdio: "inherit",
  env: process.env,
  shell: true,
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
