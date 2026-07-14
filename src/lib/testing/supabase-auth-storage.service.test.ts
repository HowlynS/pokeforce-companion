// Service-level tests against the REAL isolated Supabase test project's
// Auth and Storage. Every client is created through the guard-first helper,
// so the fail-closed environment check runs before the Supabase package is
// even imported. Only the anon key is used; the dedicated test admin signs
// in with real email/password credentials from .env.test.local.
//
// Secrets never reach test output: anything derived from credentials or
// tokens is asserted through boolean comparisons, so a failure prints only
// `true`/`false` — never the underlying value.
//
// Storage objects live under the production path-guard folders (items/,
// professions/, recipes/) with the test-service- name prefix, use tiny
// in-memory PNG byte fixtures, and are removed by prefix-scoped cleanup
// after every test.

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SERVICE_TEST_BUCKET,
  SERVICE_TEST_FOLDERS,
  SERVICE_TEST_OBJECT_PREFIX,
  countServiceTestObjects,
  createAnonymousServiceClient,
  createSignedInAdminClient,
  deleteServiceTestObjects,
  getConfiguredAdminEmail,
  signOutServiceClient,
} from "./supabase-service";

// Two distinct, genuinely valid 1x1-pixel PNGs as byte literals — no binary
// files on disk, and both are far below the bucket's 5 MB limit.
const PNG_FIXTURE_ORIGINAL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);
const PNG_FIXTURE_REPLACEMENT = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

// Interrupted earlier runs may have stranded objects, so every object name
// gets a per-run unique suffix and cleanup always sweeps by prefix.
const RUN_SUFFIX = `${Date.now().toString(36)}${Math.floor(
  Math.random() * 36 ** 4
).toString(36)}`;

function testObjectPath(
  folder: (typeof SERVICE_TEST_FOLDERS)[number],
  label: string
): string {
  return `${folder}/${SERVICE_TEST_OBJECT_PREFIX}${label}-${RUN_SUFFIX}.png`;
}

// Public-URL fetch with a unique cache-busting query value so the CDN can
// never serve a stale copy after an update or delete. The URL itself is
// never logged.
async function fetchPublicObject(client: SupabaseClient, objectPath: string) {
  const { data } = client.storage
    .from(SERVICE_TEST_BUCKET)
    .getPublicUrl(objectPath);
  const response = await fetch(`${data.publicUrl}?cb=${crypto.randomUUID()}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  return {
    ok: response.ok,
    status: response.status,
    contentType: response.headers.get("content-type"),
    bytes,
  };
}

function isClientErrorStatus(value: unknown): boolean {
  const numeric =
    typeof value === "number" ? value : Number.parseInt(String(value), 10);
  return Number.isInteger(numeric) && numeric >= 400 && numeric < 500;
}

describe("supabase auth and storage (service)", () => {
  // One long-lived admin client dedicated to cleanup and verification, so
  // per-test clients stay order-independent and sign-in traffic stays low.
  let cleanupAdmin: SupabaseClient;

  beforeAll(async () => {
    // First Supabase contact of the run: the guard inside the helper throws
    // here if the environment is not the verified test project. Also sweeps
    // any prefix-scoped leftovers from an interrupted earlier run.
    cleanupAdmin = await createSignedInAdminClient();
    await deleteServiceTestObjects(cleanupAdmin);
  });

  // Backstop cleanup after every test: even a failing test cannot leave a
  // prefixed object behind. Only prefix-scoped objects are removed.
  afterEach(async () => {
    await deleteServiceTestObjects(cleanupAdmin);
  });

  afterAll(async () => {
    const remaining = await deleteServiceTestObjects(cleanupAdmin);
    await signOutServiceClient(cleanupAdmin);
    // Fail loudly if cleanup was still needed at the very end — afterEach
    // should already have removed everything.
    expect(remaining).toBe(0);
  });

  describe("environment and anonymous client", () => {
    it("creates an anonymous client after the guard passes, with no session", async () => {
      const anonymous = await createAnonymousServiceClient();
      expect(anonymous).toBeTruthy();

      const { data, error } = await anonymous.auth.getSession();
      expect(error).toBeNull();
      expect(data.session).toBeNull();
    });
  });

  describe("real admin authentication", () => {
    it("signs the test admin in with email/password and signs out cleanly", async () => {
      const adminEmail = await getConfiguredAdminEmail();
      const client = await createAnonymousServiceClient();

      try {
        const { data, error } = await client.auth.signInWithPassword({
          email: adminEmail,
          password: process.env.TEST_ADMIN_PASSWORD as string,
        });

        // Boolean-only assertions: a failure prints true/false, never the
        // email, token, or error payload.
        expect(error === null).toBe(true);
        expect(data.session !== null).toBe(true);
        expect(data.user !== null).toBe(true);
        expect(
          data.user?.email?.toLowerCase() === adminEmail.toLowerCase()
        ).toBe(true);
        expect(
          typeof data.session?.access_token === "string" &&
            data.session.access_token.length > 0
        ).toBe(true);
      } finally {
        await signOutServiceClient(client);
      }

      const { data: after } = await client.auth.getSession();
      expect(after.session).toBeNull();
    });
  });

  describe("wrong-password rejection", () => {
    it("rejects the test admin email with an incorrect password", async () => {
      const adminEmail = await getConfiguredAdminEmail();
      const client = await createAnonymousServiceClient();

      // One deliberate failed attempt per suite — enough to prove the
      // rejection without hammering Auth rate limits.
      const { data, error } = await client.auth.signInWithPassword({
        email: adminEmail,
        password: `definitely-not-the-password-${RUN_SUFFIX}`,
      });

      expect(error !== null).toBe(true);
      expect(isClientErrorStatus(error?.status)).toBe(true);
      expect(data.session).toBeNull();
      expect(data.user).toBeNull();
    });
  });

  describe("anonymous storage write rejection", () => {
    it("denies an anonymous upload and creates no object", async () => {
      const anonymous = await createAnonymousServiceClient();
      const objectPath = testObjectPath("items", "anon-denied");

      const { data, error } = await anonymous.storage
        .from(SERVICE_TEST_BUCKET)
        .upload(objectPath, PNG_FIXTURE_ORIGINAL, {
          contentType: "image/png",
          upsert: false,
        });

      // The INSERT policy admits only the authenticated test admin, so the
      // anonymous request must fail with a client/authorization error.
      expect(data).toBeNull();
      expect(error !== null).toBe(true);
      expect(
        isClientErrorStatus(
          (error as { statusCode?: string | number } | null)?.statusCode
        )
      ).toBe(true);

      // Defensive proof that nothing was created, via the verified admin.
      expect(await countServiceTestObjects(cleanupAdmin)).toBe(0);
    });
  });

  describe("authenticated upload and public read", () => {
    it("uploads a PNG as the admin and serves it publicly", async () => {
      const admin = await createSignedInAdminClient();
      const objectPath = testObjectPath("items", "lifecycle");

      try {
        const { error } = await admin.storage
          .from(SERVICE_TEST_BUCKET)
          .upload(objectPath, PNG_FIXTURE_ORIGINAL, {
            contentType: "image/png",
            upsert: false,
            cacheControl: "0",
          });
        expect(error).toBeNull();

        // The bucket is public: the object must be readable with no
        // authentication at all, byte-for-byte identical to the fixture.
        const anonymous = await createAnonymousServiceClient();
        const fetched = await fetchPublicObject(anonymous, objectPath);
        expect(fetched.ok).toBe(true);
        expect(fetched.contentType ?? "").toContain("image/png");
        expect(Buffer.compare(fetched.bytes, PNG_FIXTURE_ORIGINAL)).toBe(0);
      } finally {
        await signOutServiceClient(admin);
      }
    });
  });

  describe("replacement/update behavior", () => {
    it("updates the object in place and serves the replacement bytes", async () => {
      const admin = await createSignedInAdminClient();
      const objectPath = testObjectPath("items", "update");
      const objectName = objectPath.split("/")[1];

      try {
        const { error: uploadError } = await admin.storage
          .from(SERVICE_TEST_BUCKET)
          .upload(objectPath, PNG_FIXTURE_ORIGINAL, {
            contentType: "image/png",
            upsert: false,
            cacheControl: "0",
          });
        expect(uploadError).toBeNull();

        // Production never overwrites in place (it uploads a new unique
        // path and deletes the old one), so this exercises the Storage
        // UPDATE policy itself via the real update() API.
        const { error: updateError } = await admin.storage
          .from(SERVICE_TEST_BUCKET)
          .update(objectPath, PNG_FIXTURE_REPLACEMENT, {
            contentType: "image/png",
            cacheControl: "0",
          });
        expect(updateError).toBeNull();

        const anonymous = await createAnonymousServiceClient();
        const fetched = await fetchPublicObject(anonymous, objectPath);
        expect(fetched.ok).toBe(true);
        expect(Buffer.compare(fetched.bytes, PNG_FIXTURE_REPLACEMENT)).toBe(0);
        expect(Buffer.compare(fetched.bytes, PNG_FIXTURE_ORIGINAL)).not.toBe(0);

        // Exactly one object exists at that path — the update replaced it
        // rather than creating a sibling.
        const { data: listed, error: listError } = await admin.storage
          .from(SERVICE_TEST_BUCKET)
          .list("items", { limit: 1000, search: objectName });
        expect(listError).toBeNull();
        expect(
          (listed ?? []).filter((object) => object.name === objectName)
        ).toHaveLength(1);
      } finally {
        await signOutServiceClient(admin);
      }
    });
  });

  describe("authenticated deletion", () => {
    it("deletes the object and stops serving it publicly", async () => {
      const admin = await createSignedInAdminClient();
      const objectPath = testObjectPath("items", "delete");

      try {
        const { error: uploadError } = await admin.storage
          .from(SERVICE_TEST_BUCKET)
          .upload(objectPath, PNG_FIXTURE_ORIGINAL, {
            contentType: "image/png",
            upsert: false,
            cacheControl: "0",
          });
        expect(uploadError).toBeNull();

        const { error: removeError } = await admin.storage
          .from(SERVICE_TEST_BUCKET)
          .remove([objectPath]);
        expect(removeError).toBeNull();

        const anonymous = await createAnonymousServiceClient();
        const fetched = await fetchPublicObject(anonymous, objectPath);
        expect(fetched.ok).toBe(false);
        expect(isClientErrorStatus(fetched.status)).toBe(true);

        // The only test object of this run was just removed.
        expect(await countServiceTestObjects(cleanupAdmin)).toBe(0);
      } finally {
        await signOutServiceClient(admin);
      }
    });
  });

  describe("policy coverage across resource folders", () => {
    it("accepts admin writes under items/, professions/, and recipes/", async () => {
      const admin = await createSignedInAdminClient();

      try {
        for (const folder of SERVICE_TEST_FOLDERS) {
          const objectPath = testObjectPath(folder, "folder-coverage");

          const { error: uploadError } = await admin.storage
            .from(SERVICE_TEST_BUCKET)
            .upload(objectPath, PNG_FIXTURE_ORIGINAL, {
              contentType: "image/png",
              upsert: false,
              cacheControl: "0",
            });
          expect(uploadError, `upload under ${folder}/ must succeed`).toBeNull();

          const { error: removeError } = await admin.storage
            .from(SERVICE_TEST_BUCKET)
            .remove([objectPath]);
          expect(removeError, `removal under ${folder}/ must succeed`).toBeNull();
        }
      } finally {
        await signOutServiceClient(admin);
      }
    });
  });

  describe("final cleanup and preservation", () => {
    it("leaves zero test-service objects in any resource folder", async () => {
      expect(await countServiceTestObjects(cleanupAdmin)).toBe(0);
    });
  });
});
