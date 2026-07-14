// Explicit loader for the isolated test environment. Deliberately NOT
// `import "dotenv/config"` — that would silently load the normal
// development `.env`. Only `.env.test.local` is ever loaded here, its
// values override anything already present, and the fail-closed guard runs
// before a caller could create any Prisma, Auth, or Storage client. There
// is no fallback: if the file is missing or the guard rejects the values,
// this throws with a readable, secret-free message.

import { config } from "dotenv";
import { assertIsolatedTestEnvironment } from "./test-environment";

export function loadTestEnvironment(): void {
  const result = config({
    path: ".env.test.local",
    override: true,
    quiet: true,
  });

  if (result.error) {
    throw new Error(
      "Refusing to run against an unverified test environment. Could not load .env.test.local. Copy .env.test.example to .env.test.local and fill in the isolated Supabase test project's values."
    );
  }

  assertIsolatedTestEnvironment(process.env);
}
