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

// Admin Visual/UX Correction pass (Part 10): the release-date field is now
// the shared unambiguous DateField, entered and displayed as "DD MMM YYYY"
// — never the browser-locale-dependent native date input's numeric format.
// Since entry text and display text are the identical convention here, one
// value serves both what this suite TYPES and what it expects to read back
// in the table.
const CREATED = {
  name: "test-e2e-gv-alpha",
  releaseDate: "01 Jul 2026",
} as const;

const EDITED = {
  name: "test-e2e-gv-alpha-updated",
  releaseDate: "15 Jul 2026",
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
    const releaseDateField = page.getByLabel(/^Release date/);
    await releaseDateField.fill(data.releaseDate);
    // Blurring the field BEFORE clicking Submit matters here: DateField
    // shows its own client-side error paragraph on blur for malformed
    // text, which shifts the submit button down. Blurring first (Tab)
    // lets that shift finish settling before Playwright computes the
    // submit button's click coordinates, rather than racing a shift
    // caused by the click's own mousedown-triggered blur — the second
    // ordering can miss the button entirely.
    await page.keyboard.press("Tab");
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

  // The confirmation dialog reports the reference and disables the delete
  // action (visible, never hidden).
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
  ).toBeDisabled();

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
  // AdminSelect (Massive Admin Interaction Completion Pass, Phase 1)
  // replaced the native <select> here — the trigger's own displayed text
  // shows the placeholder directly; there is no native "value" attribute
  // or <option:checked> to query anymore.
  const picker = page.getByLabel("Verify this record for");
  await expect(picker).toBeVisible();
  await expect(picker).toHaveText("Select a game version…");
});

// --- Admin Visual/UX Correction pass: table structure, Back to Admin
// removal, and unambiguous date display/entry -----------------------------

test("Game Versions table: Set current has its own column, Actions holds only Edit/Delete, and Back to Admin is gone", async ({
  page,
}) => {
  await page.goto("/admin/settings/game-versions");

  // Part 7: exactly the five columns, in this order.
  const headers = page.getByRole("columnheader");
  await expect(headers).toHaveText([
    "Name",
    "Release date",
    "Current",
    "Set current",
    "Actions",
  ]);

  // The persistent fixture is current: its own row shows "Current" (not
  // "No") in the Current column and an em dash — never a disabled
  // "Mark as current" button — in the Set current column (the fourth
  // <td>: Name, Release date, Current, Set current, Actions — targeted
  // by position since the fixture's own Release date cell can ALSO
  // legitimately read "—" when it has no release date set).
  const fixtureRow = versionRow(page, E2E_CURRENT_GAME_VERSION_NAME);
  await expect(fixtureRow.getByText("Current", { exact: true })).toBeVisible();
  await expect(
    fixtureRow.getByRole("button", { name: "Mark as current" })
  ).toHaveCount(0);
  await expect(fixtureRow.getByRole("cell").nth(3)).toHaveText("—");

  // A non-current version shows "No" in Current, a real "Mark as
  // current" button in Set current, and Edit/Delete only in Actions.
  await createVersionThroughForm(page, { name: DELETABLE_NAME });
  const createdRow = versionRow(page, DELETABLE_NAME);
  await expect(createdRow.getByText("No", { exact: true })).toBeVisible();
  await expect(
    createdRow.getByRole("button", { name: "Mark as current", exact: true })
  ).toBeVisible();
  await expect(
    createdRow.getByRole("link", { name: "Edit", exact: true })
  ).toBeVisible();
  await expect(
    createdRow.getByRole("link", { name: "Delete", exact: true })
  ).toBeVisible();

  // Part 8: the redundant "Back to Admin" link is gone — the sidebar
  // already covers top-level admin navigation. The unrelated,
  // resource-specific "Back to Game Versions" links on the edit/delete
  // pages are untouched (checked separately below).
  await expect(
    page.getByRole("link", { name: "Back to Admin" })
  ).toHaveCount(0);
  // The top-right jump link was removed once the 70/30 overview layout
  // put the inline Create Game Version form permanently on-screen beside
  // the table — there is no longer anything for it to jump to.
  await expect(
    page.getByRole("link", { name: "+ New game version" })
  ).toHaveCount(0);

  await createdRow.getByRole("link", { name: "Delete", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete Permanently", exact: true })
    .click();
  await expect(page).toHaveURL(
    "/admin/settings/game-versions?success=deleted"
  );
});

test("resource-specific Back to Game Versions links remain on the edit and delete pages", async ({
  page,
}) => {
  await page.goto("/admin/settings/game-versions");
  await versionRow(page, E2E_CURRENT_GAME_VERSION_NAME)
    .getByRole("link", { name: "Edit", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Back to Game Versions" })
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to Game Versions" }).click();
  await expect(page).toHaveURL("/admin/settings/game-versions");
});

test("release date displays as DD MMM YYYY and the date-entry field is unambiguous (no locale-dependent native date input)", async ({
  page,
}) => {
  await page.goto("/admin/settings/game-versions");

  // No native <input type="date"> exists anywhere on this page — its
  // visible numeric ordering depends on the browser's own locale, which
  // is exactly what Part 10 replaces.
  await expect(page.locator('input[type="date"]')).toHaveCount(0);

  const releaseDateField = page.getByLabel(/^Release date/);
  await expect(releaseDateField).toHaveAttribute("placeholder", "DD MMM YYYY");
  await expect(page.getByText("Format: DD MMM YYYY")).toBeVisible();

  await createVersionThroughForm(page, {
    name: DELETABLE_NAME,
    releaseDate: CREATED.releaseDate,
  });
  await expect(page).toHaveURL(
    "/admin/settings/game-versions?success=created"
  );

  // Displays exactly the unambiguous DD MMM YYYY text — never a raw ISO
  // string and never a locale-numeric one.
  const row = versionRow(page, DELETABLE_NAME);
  await expect(
    row.getByRole("cell", { name: CREATED.releaseDate, exact: true })
  ).toBeVisible();
  await expect(page.getByText("2026-07-01")).toHaveCount(0);

  // Editing shows the persisted date back in the same unambiguous format.
  await row.getByRole("link", { name: "Edit", exact: true }).click();
  await expect(page.getByLabel(/^Release date/)).toHaveValue(
    CREATED.releaseDate
  );
});

test("the date-entry field rejects malformed text and keeps the optional field genuinely optional", async ({
  page,
}) => {
  await page.goto("/admin/settings/game-versions");

  // A blank optional field creates cleanly with no release date.
  await createVersionThroughForm(page, { name: DELETABLE_NAME });
  await expect(page).toHaveURL(
    "/admin/settings/game-versions?success=created"
  );
  await expect(
    versionRow(page, DELETABLE_NAME).getByRole("cell", {
      name: "—",
      exact: true,
    })
  ).toBeVisible();

  // Malformed text is rejected server-side with the existing error —
  // never silently coerced into "no date".
  await createVersionThroughForm(page, {
    name: "test-e2e-gv-malformed-date",
    releaseDate: "not a real date",
  });
  await expect(page).toHaveURL(
    "/admin/settings/game-versions?error=invalid_release_date"
  );
  await expect(
    page.getByText("Enter the release date as a valid calendar date.")
  ).toBeVisible();
});

// --- Game Version description (action-strip fix + optional description) --

test("the inline Create Game Version form has no description field", async ({
  page,
}) => {
  await page.goto("/admin/settings/game-versions");
  await expect(page.getByLabel("Description (optional)")).toHaveCount(0);
});

test("Edit Game Version: description persists with line breaks, clears to empty, never appears on the overview, and the action area is no longer nested inside the card", async ({
  page,
}) => {
  await page.goto("/admin/settings/game-versions");
  await createVersionThroughForm(page, { name: DELETABLE_NAME });

  await versionRow(page, DELETABLE_NAME)
    .getByRole("link", { name: "Edit", exact: true })
    .click();

  // Action-strip structural fix: EditorActions no longer renders INSIDE
  // the Game Version card (.admin-editor-section) — it now sits beside
  // it in the shared .admin-editor-surface wrapper, exactly like every
  // other resource's editor, so its own background matches the surface
  // it actually sits on instead of reading as a separate darker block.
  // Asserted structurally, not by color/pixel.
  await expect(
    page.locator(".admin-editor-section .admin-editor-actions")
  ).toHaveCount(0);
  await expect(
    page.locator(".admin-editor-surface > form > .admin-editor-actions")
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Save Changes", exact: true })
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Cancel", exact: true })).toBeVisible();

  const descriptionField = page.getByLabel("Description (optional)");
  await expect(descriptionField).toHaveValue("");

  const multilineDescription =
    "Adds new crafting recipes.\n\nFixes a rare duplication bug.";
  await descriptionField.fill(multilineDescription);
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(page).toHaveURL(
    "/admin/settings/game-versions?success=updated"
  );

  // The overview page never displays the description anywhere — table,
  // Create card, or otherwise.
  await expect(page.getByText("Adds new crafting recipes.")).toHaveCount(0);
  await expect(page.getByLabel("Description (optional)")).toHaveCount(0);

  // Reopening Edit shows the persisted description back, line breaks
  // intact.
  await versionRow(page, DELETABLE_NAME)
    .getByRole("link", { name: "Edit", exact: true })
    .click();
  await expect(page.getByLabel("Description (optional)")).toHaveValue(
    multilineDescription
  );

  // Clearing it and saving persists an empty value.
  await page.getByLabel("Description (optional)").fill("");
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(page).toHaveURL(
    "/admin/settings/game-versions?success=updated"
  );

  await versionRow(page, DELETABLE_NAME)
    .getByRole("link", { name: "Edit", exact: true })
    .click();
  await expect(page.getByLabel("Description (optional)")).toHaveValue("");
});
