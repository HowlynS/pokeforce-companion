// Guarded launcher for applying committed migrations to the ISOLATED
// Supabase test project. Loads ONLY .env.test.local (override: true) and
// runs the existing fail-closed guard BEFORE `prisma migrate deploy` runs,
// so migrations can never be "deployed" to the normal development project
// by mistake — the same pattern as scripts/start-test-server.ts. The
// validated test values are already present in this process's environment;
// prisma.config.ts's own `import "dotenv/config"` never overrides existing
// values, so the test DATABASE_URL wins. Prints no secrets.

import { spawn } from "node:child_process";
import { loadTestEnvironment } from "../src/lib/testing/load-test-environment";

// Throws with a readable, secret-free message if the environment is not the
// isolated Supabase test project; the deploy below then never runs.
loadTestEnvironment();

// One fixed command string through the shell: pnpm is a .cmd shim on
// Windows and needs a shell to resolve. Nothing in the command is
// user-controlled, and `migrate deploy` only ever applies the committed
// migrations in prisma/migrations — it never generates or edits SQL.
const child = spawn("pnpm exec prisma migrate deploy", {
  stdio: "inherit",
  env: process.env,
  shell: true,
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
