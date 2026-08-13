/**
 * The documented resting state of the isolated TEST database's
 * `SiteAccessSettings` singleton.
 *
 * Site visibility is a single row shared by every suite that touches the test
 * project, so "what state should the database be in when a suite finishes?"
 * has to have exactly one answer — otherwise each suite invents its own and
 * the last one to run wins. That is precisely how the browser suite broke:
 * access-gate.spec.ts left PRIVATE_BETA behind and silently redirected every
 * later public spec to /login.
 *
 * PUBLIC is chosen because the overwhelming majority of tests exercise
 * anonymous public browsing, which is only reachable under PUBLIC — and
 * because public-design-contracts.spec.ts already documented it in prose as
 * "the baseline the rest of this public E2E suite requires".
 *
 * This is deliberately NOT the production default: resolveSiteVisibility()
 * fails closed to PRIVATE_BETA when the row is absent, and bootstrap-owner
 * seeds PRIVATE_BETA. Nothing here changes production behavior; this constant
 * describes only the test database's resting state.
 *
 * Lives under src/lib/testing (not e2e/helpers) so BOTH runtimes can import
 * it: the Playwright helper (e2e/helpers/site-visibility.ts) and the Vitest
 * integration tests, which cannot import anything that pulls in
 * @playwright/test.
 */
export type TestSiteVisibility = "PRIVATE_BETA" | "PUBLIC";

export const TEST_SITE_VISIBILITY_BASELINE: TestSiteVisibility = "PUBLIC";
