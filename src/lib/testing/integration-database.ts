// Guard-first access to the Prisma client for integration tests.
//
// src/lib/db.ts creates its PrismaClient at module scope, reading
// process.env.DATABASE_URL the moment the module is imported. A static
// `import { prisma } from "@/lib/db"` in a test file would therefore create
// a client BEFORE any environment check could run. This helper enforces the
// safe order instead:
//
//   1. loadTestEnvironment() loads .env.test.local (override: true) and runs
//      the fail-closed guard from test-environment.ts;
//   2. only after the guard passes is "@/lib/db" imported dynamically, so
//      the shared client is created with the verified test DATABASE_URL.
//
// If the guard throws, the import never happens, no PrismaClient exists in
// this process, and nothing can connect to the development database. This
// module never logs — DATABASE_URL and other secrets stay out of output.

import { loadTestEnvironment } from "./load-test-environment";

type TestPrismaClient = (typeof import("@/lib/db"))["prisma"];

// Every row an integration test creates must carry this slug prefix, and
// cleanup only ever deletes rows carrying it, so seeded fixtures can never
// be touched by mistake.
export const INTEGRATION_TEST_SLUG_PREFIX = "test-integration-";

// Memoized as a promise: the first caller triggers guard + import exactly
// once, and a guard failure stays failed for every later caller instead of
// silently retrying against a bad environment.
let prismaPromise: Promise<TestPrismaClient> | null = null;

export function getVerifiedTestPrisma(): Promise<TestPrismaClient> {
  if (!prismaPromise) {
    prismaPromise = (async () => {
      loadTestEnvironment();
      const db = await import("@/lib/db");
      return db.prisma;
    })();
  }
  return prismaPromise;
}

/**
 * Deletes ONLY Category rows whose slug starts with the integration-test
 * prefix. Returns how many rows were removed. Throws (failing the calling
 * test or hook loudly) if the database rejects the delete.
 */
export async function deleteIntegrationTestCategories(): Promise<number> {
  // Defense in depth: a broad deleteMany must be impossible even if the
  // prefix constant is ever edited carelessly.
  if (INTEGRATION_TEST_SLUG_PREFIX.length < 5) {
    throw new Error(
      "Refusing prefix-scoped cleanup: the integration-test slug prefix is suspiciously short."
    );
  }

  const prisma = await getVerifiedTestPrisma();
  const result = await prisma.category.deleteMany({
    where: { slug: { startsWith: INTEGRATION_TEST_SLUG_PREFIX } },
  });
  return result.count;
}

/**
 * Closes the verified client's connections after a suite. Safe to call when
 * the guard failed or the client was never requested.
 */
export async function disconnectTestPrisma(): Promise<void> {
  if (!prismaPromise) {
    return;
  }
  const prisma = await prismaPromise.catch(() => null);
  if (prisma) {
    await prisma.$disconnect();
  }
}
