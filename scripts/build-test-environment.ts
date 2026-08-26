// Guarded production-build launcher for connected validation. Next.js does
// not load the repository's custom .env.test.local filename by itself, so a
// bare `pnpm build` would fall back to an unconfigured local PostgreSQL
// connection. Load and verify only the isolated test environment first, then
// pass those values to the unchanged production build without printing them.

import { spawn } from "node:child_process";
import { loadTestEnvironment } from "../src/lib/testing/load-test-environment";

loadTestEnvironment();

const child = spawn("pnpm build", {
  stdio: "inherit",
  env: process.env,
  shell: true,
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
