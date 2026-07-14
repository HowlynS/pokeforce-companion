// Guard-first access to Supabase Auth and Storage for service-level tests.
//
// The production client (src/lib/supabase/server.ts) depends on Next.js
// request cookies and cannot run in plain Node, so these tests use
// @supabase/supabase-js directly — but only AFTER loadTestEnvironment() has
// loaded .env.test.local (override: true) and the fail-closed guard has
// verified every value belongs to the isolated test project. If the guard
// throws, the Supabase package is never imported and no client exists in
// this process, so the development project cannot be contacted.
//
// Only the anon key is ever used — no service-role key exists in the test
// environment or in this code. Clients are created with persistSession,
// autoRefreshToken, and detectSessionInUrl disabled, so sessions live only
// in memory for the duration of a test and nothing is written to disk.
// This module never logs — URLs, keys, emails, passwords, and tokens stay
// out of output, and thrown errors carry only non-secret status codes.

import type { SupabaseClient } from "@supabase/supabase-js";
import { loadTestEnvironment } from "./load-test-environment";

// Mirrors IMAGE_BUCKET in src/lib/storage/images.ts, which cannot be
// imported here because it pulls in the cookie-based Next.js client.
export const SERVICE_TEST_BUCKET = "game-images";

// Every object a service test writes must live in one of the production
// path-guard folders and carry this name prefix; cleanup only ever removes
// objects carrying it.
export const SERVICE_TEST_OBJECT_PREFIX = "test-service-";
export const SERVICE_TEST_FOLDERS = ["items", "professions", "recipes"] as const;
export type ServiceTestFolder = (typeof SERVICE_TEST_FOLDERS)[number];

type VerifiedServiceEnvironment = {
  createClient: typeof import("@supabase/supabase-js").createClient;
  url: string;
  anonKey: string;
  adminEmail: string;
  adminPassword: string;
};

// Memoized as a promise: the first caller triggers guard + import exactly
// once, and a guard failure stays failed for every later caller instead of
// silently retrying against a bad environment.
let environmentPromise: Promise<VerifiedServiceEnvironment> | null = null;

function getVerifiedServiceEnvironment(): Promise<VerifiedServiceEnvironment> {
  if (!environmentPromise) {
    environmentPromise = (async () => {
      loadTestEnvironment();
      const { createClient } = await import("@supabase/supabase-js");
      return {
        createClient,
        url: process.env.NEXT_PUBLIC_SUPABASE_URL as string,
        anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
        adminEmail: process.env.ADMIN_EMAIL as string,
        adminPassword: process.env.TEST_ADMIN_PASSWORD as string,
      };
    })();
  }
  return environmentPromise;
}

/**
 * The configured test admin email, for equality comparisons inside boolean
 * assertions. Callers must never pass it to console output or non-boolean
 * expect() calls, where a failure would print it.
 */
export async function getConfiguredAdminEmail(): Promise<string> {
  const { adminEmail } = await getVerifiedServiceEnvironment();
  return adminEmail;
}

/**
 * A fresh unauthenticated client for the verified test project. In-memory
 * session store only; nothing persists and nothing auto-refreshes.
 */
export async function createAnonymousServiceClient(): Promise<SupabaseClient> {
  const { createClient, url, anonKey } = await getVerifiedServiceEnvironment();
  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

/**
 * A fresh client signed in as the dedicated test admin. Throws without
 * echoing credentials if authentication fails. Callers must sign out via
 * signOutServiceClient() in finally/afterEach.
 */
export async function createSignedInAdminClient(): Promise<SupabaseClient> {
  const { adminEmail, adminPassword } = await getVerifiedServiceEnvironment();
  const client = await createAnonymousServiceClient();

  const { data, error } = await client.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  });

  if (error || !data.session || !data.user) {
    throw new Error(
      `Test admin sign-in failed (credentials withheld; Supabase status ${
        error?.status ?? "unknown"
      }).`
    );
  }

  return client;
}

/**
 * Signs a client out locally (this client's in-memory session only, so an
 * independent cleanup client keeps working). Throws with a non-secret
 * status if sign-out fails.
 */
export async function signOutServiceClient(
  client: SupabaseClient
): Promise<void> {
  const { error } = await client.auth.signOut({ scope: "local" });
  if (error) {
    throw new Error(
      `Sign-out failed (Supabase status ${error.status ?? "unknown"}).`
    );
  }
}

/**
 * Counts objects whose names begin with the service-test prefix inside the
 * three approved resource folders. Requires an authenticated admin client
 * (the bucket's SELECT policy is admin-only for the list API).
 */
export async function countServiceTestObjects(
  admin: SupabaseClient
): Promise<number> {
  let found = 0;
  for (const folder of SERVICE_TEST_FOLDERS) {
    const { data, error } = await admin.storage
      .from(SERVICE_TEST_BUCKET)
      .list(folder, { limit: 1000, search: SERVICE_TEST_OBJECT_PREFIX });
    if (error) {
      throw new Error(
        `Could not list "${folder}" while counting test objects (status withheld from message: ${
          (error as { statusCode?: string }).statusCode ?? "unknown"
        }).`
      );
    }
    found += (data ?? []).filter((object) =>
      object.name.startsWith(SERVICE_TEST_OBJECT_PREFIX)
    ).length;
  }
  return found;
}

/**
 * Removes ONLY objects whose names begin with the service-test prefix, one
 * approved folder at a time — never a whole folder, never an unscoped path.
 * Returns how many objects were removed. Throws (failing the calling test
 * or hook loudly) if listing or removal fails.
 */
export async function deleteServiceTestObjects(
  admin: SupabaseClient
): Promise<number> {
  // Defense in depth: a broad removal must be impossible even if the
  // prefix constant is ever edited carelessly.
  if (SERVICE_TEST_OBJECT_PREFIX.length < 5) {
    throw new Error(
      "Refusing prefix-scoped cleanup: the service-test object prefix is suspiciously short."
    );
  }

  let removed = 0;
  for (const folder of SERVICE_TEST_FOLDERS) {
    const { data, error } = await admin.storage
      .from(SERVICE_TEST_BUCKET)
      .list(folder, { limit: 1000, search: SERVICE_TEST_OBJECT_PREFIX });
    if (error) {
      throw new Error(
        `Storage cleanup could not list "${folder}" (status ${
          (error as { statusCode?: string }).statusCode ?? "unknown"
        }).`
      );
    }

    const targets = (data ?? [])
      .filter((object) => object.name.startsWith(SERVICE_TEST_OBJECT_PREFIX))
      .map((object) => `${folder}/${object.name}`);

    if (targets.length > 0) {
      const { error: removeError } = await admin.storage
        .from(SERVICE_TEST_BUCKET)
        .remove(targets);
      if (removeError) {
        throw new Error(
          `Storage cleanup could not remove test objects in "${folder}" (status ${
            (removeError as { statusCode?: string }).statusCode ?? "unknown"
          }).`
        );
      }
      removed += targets.length;
    }
  }
  return removed;
}
