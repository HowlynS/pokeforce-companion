// Non-destructive verification of the isolated test environment: loads
// .env.test.local, runs the fail-closed guard, and reports the outcome.
// Creates no Prisma, Supabase, Auth, or Storage client and prints no
// secret values.

import { loadTestEnvironment } from "../src/lib/testing/load-test-environment";

try {
  loadTestEnvironment();
  console.log(
    "Test environment verified: .env.test.local points at the isolated Supabase test project."
  );
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Test environment check failed."
  );
  process.exitCode = 1;
}
