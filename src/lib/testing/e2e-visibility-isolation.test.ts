// Guards the E2E suite's site-visibility isolation contract.
//
// Site visibility is a database singleton, so a spec that mutates it changes
// the world for every spec that runs afterwards. That is exactly how the
// suite previously broke: access-gate.spec.ts wrote PRIVATE_BETA directly and
// deliberately left it there, silently redirecting later public specs to
// /login. These tests assert the CONTRACT that prevents a recurrence — that
// mutation goes through the shared helper, and that anything declaring a
// non-baseline mode also restores the baseline — rather than asserting the
// helper's internals.

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TEST_SITE_VISIBILITY_BASELINE } from "@/lib/testing/site-visibility-baseline";

const E2E_DIRECTORY = path.join(process.cwd(), "e2e");
const HELPER_RELATIVE_PATH = path.join("helpers", "site-visibility.ts");
const AUDIT_SUITE = "audit-history.integration.test.ts";

function readE2eFile(relativePath: string): string {
  return readFileSync(path.join(E2E_DIRECTORY, relativePath), "utf8");
}

function listSpecFiles(): string[] {
  return readdirSync(E2E_DIRECTORY).filter((entry) => entry.endsWith(".spec.ts"));
}

describe("E2E site-visibility isolation", () => {
  it("routes every SiteAccessSettings mutation through the shared helper", () => {
    const offenders = listSpecFiles().filter((file) =>
      /"SiteAccessSettings"/.test(readE2eFile(file)),
    );

    expect(
      offenders,
      "spec files must call setSiteVisibility()/requireSiteVisibility() from " +
        "e2e/helpers/site-visibility.ts instead of writing the " +
        "SiteAccessSettings singleton directly — a raw write has no " +
        "restore step and leaks into every spec that runs afterwards",
    ).toEqual([]);
  });

  it("restores the baseline in any spec that declares a non-baseline mode", () => {
    const offenders = listSpecFiles().filter((file) => {
      const source = readE2eFile(file);
      if (!source.includes("PRIVATE_BETA")) return false;
      // requireSiteVisibility() installs the restoring afterAll itself; a spec
      // that reaches for the raw setter must arrange restoration some other
      // way, which is the case worth flagging.
      return !source.includes("requireSiteVisibility(");
    });

    expect(
      offenders,
      "a spec that puts the site into PRIVATE_BETA must use " +
        "requireSiteVisibility(), whose afterAll returns the database to the " +
        "PUBLIC baseline even when a test fails",
    ).toEqual([]);
  });

  it("documents PUBLIC as the baseline the helper restores", () => {
    const helper = readE2eFile(HELPER_RELATIVE_PATH);

    expect(TEST_SITE_VISIBILITY_BASELINE).toBe("PUBLIC");
    // The restore path must target the baseline constant, not a captured
    // "previous" value — replaying a prior value would faithfully propagate
    // an earlier spec's leak instead of ending the run in a known state.
    expect(helper).toMatch(
      /restoreSiteVisibilityBaseline[\s\S]*setSiteVisibility\(\s*E2E_SITE_VISIBILITY_BASELINE\s*\)/,
    );
  });

  it("leaves the baseline behind in the integration suite that mutates visibility", () => {
    // The Vitest integration suite shares the same singleton but runs in a
    // different runtime, so it cannot use the Playwright helper. It must
    // still hand the database back at the baseline rather than holding its
    // own PRIVATE_BETA precondition.
    const source = readFileSync(
      path.join(process.cwd(), "src", "lib", "testing", AUDIT_SUITE),
      "utf8",
    );

    expect(source).toContain("TEST_SITE_VISIBILITY_BASELINE");
    expect(
      source.includes("visibility: TEST_SITE_VISIBILITY_BASELINE"),
      `${AUDIT_SUITE} must restore the shared baseline in afterAll instead ` +
        "of finishing in PRIVATE_BETA",
    ).toBe(true);
  });
});
