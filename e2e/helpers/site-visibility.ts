// The single owner of `SiteAccessSettings` mutation across the E2E suite.
//
// Why this exists: site visibility is a database SINGLETON (one row, id
// "site"), so any spec that changes it changes the world for every spec that
// runs afterwards. Before this helper, access-gate.spec.ts set PRIVATE_BETA
// and deliberately left it that way, which silently redirected every later
// public spec to /login — failures that looked like public-page regressions
// but were really suite-order artifacts.
//
// The rule is now: a spec that depends on a visibility mode must ESTABLISH
// that mode itself, and must restore the baseline afterwards. No spec may
// assume what the previous spec left behind.
//
// Baseline: PUBLIC. This is not a new invention — it is the baseline the
// public E2E suite already required and that public-design-contracts.spec.ts
// already documents in prose ("Under PUBLIC site visibility (the baseline the
// rest of this public E2E suite requires)"). The overwhelming majority of
// browser specs exercise anonymous public browsing, which is only reachable
// under PUBLIC. Note this is deliberately NOT the production default:
// resolveSiteVisibility() fails closed to PRIVATE_BETA when the row is absent,
// and bootstrap-owner seeds PRIVATE_BETA. Production behavior is unchanged by
// anything here; this is purely the test database's documented resting state.
//
// Restoration strategy: restore-to-baseline, not restore-to-whatever-was-there
// -before. Capturing and replaying the prior value would faithfully propagate a
// leak from an earlier spec, which is exactly the order dependence being
// removed. Restoring a fixed, documented baseline makes the end state of a run
// deterministic regardless of which specs ran, or in what order.
//
// Concurrency: playwright.config.ts runs `workers: 1` with
// `fullyParallel: false`, so no two specs — in the same file or different
// files, same project or different projects — can mutate this singleton
// concurrently today. No lock is therefore needed, and none is added. If
// workers are ever raised above 1, visibility-mutating specs would need to be
// confined to a single worker (e.g. a dedicated project, or a shared advisory
// lock held for a whole spec file); a per-call lock would NOT be sufficient,
// because the hazard is one spec's assertions racing another spec's mutation,
// not two writes racing each other.

import { test } from "@playwright/test";
import {
  TEST_SITE_VISIBILITY_BASELINE,
  type TestSiteVisibility,
} from "../../src/lib/testing/site-visibility-baseline";
import { withVerifiedDatabase } from "./database-cleanup";

export type E2eSiteVisibility = TestSiteVisibility;

/**
 * The documented resting state of the isolated test database. Re-exported
 * from src/lib/testing so the Vitest integration suite — which mutates the
 * same singleton but cannot import @playwright/test — shares one definition
 * rather than hardcoding a second, divergable copy.
 */
export const E2E_SITE_VISIBILITY_BASELINE: E2eSiteVisibility =
  TEST_SITE_VISIBILITY_BASELINE;

/** The singleton row id, mirroring SITE_ACCESS_SETTINGS_ID in production. */
const SITE_ACCESS_SETTINGS_ID = "site";

/** Reads the current stored visibility, or null when no row exists yet. */
export async function readSiteVisibility(): Promise<E2eSiteVisibility | null> {
  return withVerifiedDatabase(async (client) => {
    const result = await client.query<{ visibility: E2eSiteVisibility }>(
      `SELECT "visibility" FROM "SiteAccessSettings" WHERE "id" = $1`,
      [SITE_ACCESS_SETTINGS_ID]
    );
    return result.rows[0]?.visibility ?? null;
  });
}

/**
 * Sets the stored visibility. Writes the row directly rather than going
 * through changeSiteVisibility(), deliberately: that service requires an
 * actor with the visibility.change permission and emits an audit event, and
 * these tests are arranging preconditions, not exercising the admin flow.
 */
export async function setSiteVisibility(
  visibility: E2eSiteVisibility
): Promise<void> {
  await withVerifiedDatabase(async (client) => {
    await client.query(
      `INSERT INTO "SiteAccessSettings" ("id", "visibility", "createdAt", "updatedAt")
       VALUES ($1, $2::"SiteVisibility", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT ("id") DO UPDATE
       SET "visibility" = EXCLUDED."visibility", "updatedAt" = CURRENT_TIMESTAMP`,
      [SITE_ACCESS_SETTINGS_ID, visibility]
    );
  });
}

/** Returns the test database to its documented resting state. */
export async function restoreSiteVisibilityBaseline(): Promise<void> {
  await setSiteVisibility(E2E_SITE_VISIBILITY_BASELINE);
}

/**
 * Declares, at file or `describe` scope, the visibility a group of tests
 * requires — and guarantees the baseline is restored afterwards.
 *
 * `afterAll` runs even when a test in the group fails, so a failing assertion
 * can no longer strand the database in the wrong mode. (Playwright does not
 * guarantee hooks run if the worker process is hard-killed; nothing in-process
 * can defend against that, which is why the baseline is also re-established by
 * every group's own `beforeAll` rather than assumed.)
 *
 * Pass `perTest` when the group's own tests mutate visibility mid-test, so
 * each test starts from the declared mode instead of inheriting whatever the
 * previous test in the group left behind.
 */
export function requireSiteVisibility(
  visibility: E2eSiteVisibility,
  options: { perTest?: boolean } = {}
): void {
  test.beforeAll(async () => {
    await setSiteVisibility(visibility);
  });

  if (options.perTest) {
    test.beforeEach(async () => {
      await setSiteVisibility(visibility);
    });
  }

  test.afterAll(async () => {
    await restoreSiteVisibilityBaseline();
  });
}
