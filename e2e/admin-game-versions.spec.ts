// Authenticated Game Version settings lifecycle against the REAL
// application and the isolated Supabase test project: list, create, edit,
// mark current (safely demoting the previous current version), delete an
// unused version, and blocked deletion while a verification stamp still
// references the version. Runs in the chromium-admin project with the
// storage state saved by auth.setup.ts.
//
// Every Game Version this suite creates carries the test-e2e-gv- NAME
// prefix (GameVersion has no slug) and the one temporary stamped Item the
// blocked-deletion test needs carries the test-e2e-gv-item slug prefix;
// both are removed by guard-first, prefix-scoped cleanup in
// beforeAll/afterEach/afterAll. The persistent fixture version
// ("test-gv-current", made current by auth.setup.ts) is deliberately NOT
// covered by that prefix; because this suite moves the current flag, both
// beforeAll and afterAll re-run ensureCurrentGameVersionFixture() so every
// other spec — and the next run — still starts with the fixture current.

import { expect, test, type Page } from "@playwright/test";
import {
  E2E_CURRENT_GAME_VERSION_NAME,
  countE2eTestGameVersionRecords,
  createVerifiedItemReferencingVersion,
  deleteE2eTestGameVersionRecords,
  ensureCurrentGameVersionFixture,
  removeVerifiedItemsReferencingVersions,
} from "./helpers/database-cleanup";

const CREATED = {
  name: "test-e2e-gv-alpha",
  releaseDate: "2026-07-01",
} as const;

const EDITED = {
  name: "test-e2e-gv-alpha-updated",
  releaseDate: "2026-07-15",
} as const;

const DELETABLE_NAME = "test-e2e-gv-deletable";
const BLOCKED_NAME = "test-e2e-gv-blocked";

// Browser error hygiene: any uncaught page error fails the test. Serial
// single-worker execution makes this module-level state safe.
let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(async () => {
  // Defensive prefix-scoped cleanup even when a test failed mid-lifecycle
  // (stamped Items first — their verification stamps RESTRICT-reference
  // the versions), then restore the fixture as the only current version.
  await deleteE2eTestGameVersionRecords();
  await ensureCurrentGameVersionFixture();
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

test.beforeAll(async () => {
  // Remove stale rows from interrupted earlier runs; the guard inside the
  // helper throws here if the environment is not the verified test project.
  await deleteE2eTestGameVersionRecords();
  await ensureCurrentGameVersionFixture();
  expect(await countE2eTestGameVersionRecords()).toBe(0);
});

test.afterAll(async () => {
  const remaining = await deleteE2eTestGameVersionRecords();
  await ensureCurrentGameVersionFixture();
  // afterEach should already have removed everything — fail loudly if not.
  expect(remaining).toBe(0);
});

// The settings table row for a version, located by its exact Name cell.
function versionRow(page: Page, name: string) {
  return page
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name, exact: true }) });
}

async function createVersionThroughForm(
  page: Page,
  data: { name: string; releaseDate?: string }
) {
  await page.getByLabel("Name", { exact: true }).fill(data.name);
  if (data.releaseDate) {
    await page.getByLabel(/^Release date/).fill(data.releaseDate);
  }
  await page
    .getByRole("button", { name: "Create Game Version", exact: true })
    .click();
}

test("game version lifecycle: reachable from the dashboard settings link, create, edit, mark current, delete", async ({
  page,
}) => {
  // --- Reachable from both the dashboard's own Game Versions module (the
  // standalone "Game Version" panel was folded into the six-module grid
  // by the Visual Pass II dashboard restructuring — this now checks the
  // module's own h3 and its summary link, matching every other resource
  // module's shape) and the primary sidebar ------------------------------
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { level: 3, name: "Game Versions", exact: true })
  ).toBeVisible();
  await page
    .locator('a.admin-dashboard-card-summary[href="/admin/settings/game-versions"]')
    .click();
  await expect(page).toHaveURL("/admin/settings/game-versions");
  await expect(
    page.getByRole("heading", { level: 1, name: "Game Versions" })
  ).toBeVisible();

  // The persistent fixture is listed and current.
  const fixtureRow = versionRow(page, E2E_CURRENT_GAME_VERSION_NAME);
  await expect(fixtureRow.getByText("Current", { exact: true })).toBeVisible();

  // --- Create (with release date); a later version is NOT auto-current --
  await createVersionThroughForm(page, CREATED);
  await expect(page).toHaveURL(
    "/admin/settings/game-versions?success=created"
  );
  await expect(page.getByText("Game Version created.")).toBeVisible();

  const createdRow = versionRow(page, CREATED.name);
  await expect(createdRow).toBeVisible();
  await expect(
    createdRow.getByRole("cell", { name: CREATED.releaseDate, exact: true })
  ).toBeVisible();
  await expect(createdRow.getByText("Current", { exact: true })).toHaveCount(0);

  // --- Duplicate name (case-insensitive) rejected server-side -----------
  await createVersionThroughForm(page, {
    name: CREATED.name.toUpperCase(),
  });
  await expect(page).toHaveURL(
    "/admin/settings/game-versions?error=duplicate_name"
  );
  await expect(
    page.getByText("A Game Version with that name already exists.")
  ).toBeVisible();

  // --- Edit name and release date ----------------------------------------
  await versionRow(page, CREATED.name)
    .getByRole("link", { name: "Edit", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Edit Game Version" })
  ).toBeVisible();
  await page.getByLabel("Name", { exact: true }).fill(EDITED.name);
  await page.getByLabel(/^Release date/).fill(EDITED.releaseDate);
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(page).toHaveURL(
    "/admin/settings/game-versions?success=updated"
  );

  const editedRow = versionRow(page, EDITED.name);
  await expect(editedRow).toBeVisible();
  await expect(
    editedRow.getByRole("cell", { name: EDITED.releaseDate, exact: true })
  ).toBeVisible();
  await expect(versionRow(page, CREATED.name)).toHaveCount(0);

  // --- Mark current: the fixture is safely demoted, exactly one current --
  await editedRow
    .getByRole("button", { name: "Mark as current", exact: true })
    .click();
  await expect(page).toHaveURL(
    "/admin/settings/game-versions?success=marked_current"
  );
  await expect(
    versionRow(page, EDITED.name).getByText("Current", { exact: true })
  ).toBeVisible();
  // The previous current version remains listed as selectable history,
  // offering "Mark as current" again rather than a Current badge.
  const demotedFixtureRow = versionRow(page, E2E_CURRENT_GAME_VERSION_NAME);
  await expect(demotedFixtureRow.getByText("Current", { exact: true })).toHaveCount(0);
  await expect(
    demotedFixtureRow.getByRole("button", { name: "Mark as current", exact: true })
  ).toBeVisible();
  // Exactly one CURRENT cell in the whole table (the header is a
  // columnheader, not a cell, so it never matches).
  await expect(
    page.getByRole("cell", { name: "Current", exact: true })
  ).toHaveCount(1);

  // --- Switch back: the fixture becomes current again --------------------
  await demotedFixtureRow
    .getByRole("button", { name: "Mark as current", exact: true })
    .click();
  await expect(page).toHaveURL(
    "/admin/settings/game-versions?success=marked_current"
  );
  await expect(
    versionRow(page, E2E_CURRENT_GAME_VERSION_NAME).getByText("Current", {
      exact: true,
    })
  ).toBeVisible();

  // --- Delete the (now historical, unused) version ------------------------
  await versionRow(page, EDITED.name)
    .getByRole("link", { name: "Delete", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Delete Game Version" })
  ).toBeVisible();
  await expect(
    page.getByText("Verified gameplay records referencing this version: 0")
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Delete Permanently", exact: true })
    .click();
  await expect(page).toHaveURL(
    "/admin/settings/game-versions?success=deleted"
  );
  await expect(versionRow(page, EDITED.name)).toHaveCount(0);
});

test("deleting a referenced game version is blocked with clear feedback until the reference is removed", async ({
  page,
}) => {
  // Create the version through the real form.
  await page.goto("/admin/settings/game-versions");
  await createVersionThroughForm(page, { name: BLOCKED_NAME });
  await expect(page).toHaveURL(
    "/admin/settings/game-versions?success=created"
  );

  // Stamp one temporary Item against it (database helper — Item admin
  // workflows are out of scope for this suite).
  await createVerifiedItemReferencingVersion(BLOCKED_NAME);

  // The confirmation page reports the reference and offers no delete
  // button at all.
  await versionRow(page, BLOCKED_NAME)
    .getByRole("link", { name: "Delete", exact: true })
    .click();
  await expect(
    page.getByText("Verified gameplay records referencing this version: 1")
  ).toBeVisible();
  await expect(
    page.getByText(/cannot be deleted because 1 verified gameplay record/)
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Delete Permanently", exact: true })
  ).toHaveCount(0);

  // Once the referencing record is gone, the same flow deletes cleanly.
  await removeVerifiedItemsReferencingVersions();
  await page.reload();
  await expect(
    page.getByText("Verified gameplay records referencing this version: 0")
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Delete Permanently", exact: true })
    .click();
  await expect(page).toHaveURL(
    "/admin/settings/game-versions?success=deleted"
  );
  await expect(versionRow(page, BLOCKED_NAME)).toHaveCount(0);
});

test("a deletable current version warns that no version will remain current", async ({
  page,
}) => {
  await page.goto("/admin/settings/game-versions");
  await createVersionThroughForm(page, { name: DELETABLE_NAME });
  await versionRow(page, DELETABLE_NAME)
    .getByRole("button", { name: "Mark as current", exact: true })
    .click();
  await expect(page).toHaveURL(
    "/admin/settings/game-versions?success=marked_current"
  );

  await versionRow(page, DELETABLE_NAME)
    .getByRole("link", { name: "Delete", exact: true })
    .click();
  await expect(
    page.getByText(/This is the current game version\./)
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Delete Permanently", exact: true })
    .click();
  await expect(page).toHaveURL(
    "/admin/settings/game-versions?success=deleted"
  );

  // No version is current now; afterEach restores the fixture as current
  // for the rest of the run.
  await expect(
    page.getByRole("cell", { name: "Current", exact: true })
  ).toHaveCount(0);

  // With versions existing but NONE current, the verification picker on a
  // gameplay form renders safely with its explicit unselected placeholder
  // — a historical version is never silently preselected. (The item
  // creation form lives on /admin/items/new since Slice 9B.4.)
  await page.goto("/admin/items/new");
  const picker = page.getByLabel("Verify this record for");
  await expect(picker).toBeVisible();
  await expect(picker).toHaveValue("");
  await expect(picker.locator("option:checked")).toHaveText(
    "Select a game version…"
  );
});
