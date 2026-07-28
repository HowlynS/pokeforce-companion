// Authenticated Player Class admin CRUD and validation coverage against the
// REAL application and the isolated Supabase test project. Runs in the
// chromium-admin project with the storage state saved by auth.setup.ts.
// All temporary Player Class rows use the test-e2e-player-class slug
// prefix, the temporary Item/Recipe rows for the relation-blocked test use
// the separate test-e2e-player-class-relation- prefix, and everything is
// removed by guard-first, prefix-scoped cleanup in
// beforeAll/afterEach/afterAll — a mid-test failure can never strand a
// row. Seeded fixtures (the 5 foundational classes) are read but never
// modified. No image file is ever provided: the optional image input stays
// empty, so no Storage object is written or deleted — image lifecycle
// coverage mirrors the established Item/Profession/Recipe image spec
// pattern and is deliberately deferred to a focused follow-up rather than
// duplicated here.
//
// This is a deliberately consolidated single spec (unlike Profession's own
// five-file split into CRUD/images/metadata/recipes/unsaved-changes) —
// every code path the milestone introduces is exercised at least once,
// but per-facet exhaustive splitting was left as optional future polish
// given this milestone's overall scope.

import { expect, test, type Page } from "@playwright/test";
import { selectAdminOption } from "./helpers/admin-select";
import {
  E2E_CURRENT_GAME_VERSION_NAME,
  countE2eTestPlayerClassRecords,
  createE2eTestGameVersion,
  createTemporaryRecipeForPlayerClass,
  deleteE2eTestGameVersionRecords,
  deleteE2eTestPlayerClassRecords,
  removeTemporaryRecipeForPlayerClass,
} from "./helpers/database-cleanup";

const INITIAL = {
  name: "Test E2E Player Class",
  slug: "test-e2e-player-class",
  description: "Created by the authenticated Player Class browser test.",
} as const;

const EDITED = {
  name: "Test E2E Player Class Updated",
  slug: "test-e2e-player-class-updated",
  description: "Updated by the authenticated Player Class browser test.",
} as const;

// A separate temporary Player Class for the relation-blocked deletion
// test, so that test never depends on the lifecycle test's data.
const BLOCKED = {
  name: "Test E2E Player Class Blocked",
  slug: "test-e2e-player-class-blocked",
  description: "Created to verify the relation-blocked deletion rule.",
} as const;

const CURRENT_VERSION_NAME = E2E_CURRENT_GAME_VERSION_NAME;
const HISTORICAL_VERSION_NAME = "test-e2e-gv-player-classes-historical";
const VERIFICATION_CHECKBOX_LABEL = /^Mark as verified for/;

let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(async () => {
  await deleteE2eTestPlayerClassRecords();
  await deleteE2eTestGameVersionRecords();
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

test.beforeAll(async () => {
  await deleteE2eTestPlayerClassRecords();
  await deleteE2eTestGameVersionRecords();
  expect(await countE2eTestPlayerClassRecords()).toBe(0);
});

test.afterAll(async () => {
  const remaining =
    (await deleteE2eTestPlayerClassRecords()) +
    (await deleteE2eTestGameVersionRecords());
  expect(remaining).toBe(0);
});

// One row of the shared Player Class record list, located by its exact
// primary text inside the list's navigation landmark.
function recordRow(page: Page, name: string) {
  return page
    .getByRole("navigation", { name: "Classes records" })
    .getByRole("link")
    .filter({ has: page.getByText(name, { exact: true }) });
}

// One of the shared panels' rows (Verification or Timestamps) in the
// editor's aside, located by its label (dt) text — anchored to the START
// of the row's text so "Current version" can never match the unrelated
// "Verified — current version" status badge.
function panelRow(page: Page, panelTitle: string, label: string) {
  return page
    .locator(".admin-panel")
    .filter({
      has: page.getByRole("heading", { level: 2, name: panelTitle, exact: true }),
    })
    .locator(".admin-panel-row")
    .filter({ hasText: new RegExp(`^${label}`) });
}

async function createPlayerClassThroughForm(
  page: Page,
  data: { name: string; slug: string; description: string }
) {
  await page.getByLabel("Name", { exact: true }).fill(data.name);
  await page.getByLabel(/^Page address/).fill(data.slug);
  await page.getByLabel(/^Description/).fill(data.description);
  await page.getByRole("button", { name: "Create Class", exact: true }).click();

  await expect(page).toHaveURL(`/admin/classes/${data.slug}/edit`);
  await expect(page.getByRole("status")).toHaveText("Class created");
  await expect(recordRow(page, data.name)).toBeVisible();
}

test("authenticated class admin access uses the saved storage state, and the sidebar carries the Classes destination", async ({
  page,
}) => {
  await page.goto("/admin/classes");

  await expect(page).toHaveURL("/admin/classes");
  await expect(
    page.getByRole("heading", { level: 1, name: "Class Management" })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "+ New", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create Class", exact: true })
  ).toHaveCount(0);

  // The 5 foundational seeded classes appear as record-list rows.
  await expect(recordRow(page, "Trainer")).toBeVisible();
  await expect(recordRow(page, "Artisan")).toBeVisible();
  await expect(recordRow(page, "Rancher")).toBeVisible();
  await expect(recordRow(page, "Ranger")).toBeVisible();
  await expect(recordRow(page, "Farmhand")).toBeVisible();

  const nav = page.getByRole("navigation", { name: "Admin navigation" });
  await expect(
    nav.getByRole("link", { name: "Classes", exact: true })
  ).toHaveAttribute("href", "/admin/classes");
});

test("Create class opens the dedicated creation route with only a General tab", async ({
  page,
}) => {
  await page.goto("/admin/classes");
  await page.getByRole("link", { name: "+ New", exact: true }).click();

  await expect(page).toHaveURL("/admin/classes/new");
  await expect(
    page.getByRole("heading", { level: 1, name: "Create Class" })
  ).toBeVisible();
  const createTabNav = page.getByRole("navigation", {
    name: "Class editor sections",
  });
  await expect(
    createTabNav.getByRole("link", { name: "General", exact: true })
  ).toHaveAttribute("aria-current", "page");
  await expect(createTabNav.getByText("Recipes")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 2, name: "Timestamps", exact: true })
  ).toHaveCount(0);
});

test("class create/edit/delete lifecycle through the real admin UI", async ({
  page,
}) => {
  // --- Create (with the optional image input left empty) ---------------
  await page.goto("/admin/classes/new");
  await createPlayerClassThroughForm(page, INITIAL);

  // Edit page shows both real tabs, no disabled placeholders.
  const editTabNav = page.getByRole("navigation", {
    name: "Class editor sections",
  });
  await expect(
    editTabNav.getByRole("link", { name: "Recipes", exact: true })
  ).toBeVisible();
  await expect(editTabNav.getByRole("link")).toHaveCount(2);
  await expect(editTabNav.locator('[aria-disabled="true"]')).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 2, name: "Timestamps", exact: true })
  ).toBeVisible();

  // --- Edit (name, slug, and description; image untouched) -------------
  await page.goto("/admin/classes");
  await recordRow(page, INITIAL.name).click();
  await expect(page).toHaveURL(`/admin/classes/${INITIAL.slug}/edit`);
  await expect(recordRow(page, INITIAL.name)).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(
    page.getByRole("heading", { level: 1, name: INITIAL.name, exact: true })
  ).toBeVisible();
  await expect(page.getByText(INITIAL.slug, { exact: true })).toBeVisible();

  await page.getByLabel("Name", { exact: true }).fill(EDITED.name);
  await page.getByLabel("Page address", { exact: true }).fill(EDITED.slug);
  await page.getByLabel(/^Description/).fill(EDITED.description);
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();

  // The redirect follows the NEW slug (this save also renamed the class).
  await expect(page).toHaveURL(`/admin/classes/${EDITED.slug}/edit`);
  await expect(page.getByRole("status")).toHaveText("Class saved");
  await expect(recordRow(page, EDITED.name)).toBeVisible();

  // --- Delete -------------------------------------------------------------
  await page.goto("/admin/classes");
  await recordRow(page, EDITED.name).click();
  await expect(page).toHaveURL(`/admin/classes/${EDITED.slug}/edit`);
  await page.getByRole("button", { name: "Delete Class", exact: true }).click();
  await expect(page).toHaveURL(`/admin/classes/${EDITED.slug}/edit`);
  await expect(
    page.getByRole("heading", { level: 2, name: "Delete Class" })
  ).toBeVisible();
  await expect(page.getByText(`(${EDITED.slug})`)).toBeVisible();
  await expect(page.getByText("Recipes requiring this class: 0")).toBeVisible();

  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete Permanently", exact: true })
    .click();

  await expect(page).toHaveURL("/admin/classes");
  await expect(page.getByRole("status")).toHaveText("Class deleted");
  await expect(recordRow(page, EDITED.name)).toHaveCount(0);
});

test("creating a class with a seeded name is rejected server-side", async ({
  page,
}) => {
  await page.goto("/admin/classes/new");

  await page.getByLabel("Name", { exact: true }).fill("  tRaInEr  ");
  await page
    .getByLabel(/^Page address/)
    .fill("test-e2e-player-class-duplicate");
  await page.getByRole("button", { name: "Create Class", exact: true }).click();

  await expect(page).toHaveURL("/admin/classes/new?error=duplicate_name");
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "A class with that name already exists." })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create Class", exact: true })
  ).toBeVisible();
  expect(await countE2eTestPlayerClassRecords()).toBe(0);
});

test("deletion is blocked while a recipe requires the class, then allowed once removed", async ({
  page,
}) => {
  await page.goto("/admin/classes/new");
  await createPlayerClassThroughForm(page, BLOCKED);

  await page.goto(`/admin/classes/${BLOCKED.slug}/delete`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Delete Class" })
  ).toBeVisible();
  await expect(page.getByText("Recipes requiring this class: 0")).toBeVisible();
  const deleteButton = page.getByRole("button", {
    name: "Delete Permanently",
    exact: true,
  });
  await expect(deleteButton).toBeVisible();

  // Link a temporary Recipe to the class AFTER the page loaded: the server
  // action re-checks the relation immediately before deleting.
  await createTemporaryRecipeForPlayerClass(BLOCKED.slug);
  await deleteButton.click();

  await expect(page).toHaveURL(
    `/admin/classes/${BLOCKED.slug}/delete?error=linked_recipes`
  );
  await expect(
    page.getByRole("alert").filter({
      hasText:
        "This class cannot be deleted because it is required by 1 recipe.",
    })
  ).toBeVisible();
  await expect(page.getByText("Recipes requiring this class: 1")).toBeVisible();
  await expect(
    page.getByText("Reassign or remove those recipes first.")
  ).toBeVisible();
  await expect(deleteButton).toBeDisabled();

  // The class survives; its Recipes tab lists the temporary recipe with
  // its EXP reward.
  await page.goto(`/admin/classes/${BLOCKED.slug}/recipes`);
  await expect(
    page.getByRole("cell", { name: "Test E2E Player Class Relation Recipe" })
  ).toBeVisible();
  await expect(page.getByText("10 EXP", { exact: true })).toBeVisible();

  expect(await removeTemporaryRecipeForPlayerClass()).toBe(2);

  await page.goto(`/admin/classes/${BLOCKED.slug}/delete`);
  await expect(page.getByText("Recipes requiring this class: 0")).toBeVisible();
  await page
    .getByRole("button", { name: "Delete Permanently", exact: true })
    .click();

  await expect(page).toHaveURL("/admin/classes");
  await expect(page.getByRole("status")).toHaveText("Class deleted");
  await expect(recordRow(page, BLOCKED.name)).toHaveCount(0);
});

test("gameplay verification stamps the selected game version and survives normal edits", async ({
  page,
}) => {
  await createE2eTestGameVersion(HISTORICAL_VERSION_NAME);

  await page.goto("/admin/classes/new");
  await createPlayerClassThroughForm(page, {
    name: "Test E2E Player Class Verify",
    slug: "test-e2e-player-class-verify",
    description: "Verifies the shared verification panel.",
  });

  await expect(
    page.locator(".admin-status-badge", { hasText: "Unverified" })
  ).toBeVisible();
  await expect(panelRow(page, "Verification", "Verified for")).toHaveCount(0);

  const picker = page.getByLabel("Verify this record for");
  await expect(picker, "the current version is preselected").toHaveText(
    `${CURRENT_VERSION_NAME} (current)`
  );

  const verifyCheckbox = page.getByLabel(VERIFICATION_CHECKBOX_LABEL);
  await expect(verifyCheckbox).not.toBeChecked();
  await verifyCheckbox.check();
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(page).toHaveURL(
    "/admin/classes/test-e2e-player-class-verify/edit"
  );
  // Guards against the isolated test database's brief read-after-write
  // consistency lag, matching the established Profession/Item spec pattern.
  await page.waitForTimeout(500);

  await expect(
    page.locator(".admin-status-badge", {
      hasText: "Verified — current version",
    })
  ).toBeVisible();
  await expect(
    panelRow(page, "Verification", "Verified for")
  ).toContainText(CURRENT_VERSION_NAME);

  // A NORMAL edit, even one that moves the picker, must not alter the
  // stamp while the checkbox stays unchecked.
  await expect(page.getByLabel(VERIFICATION_CHECKBOX_LABEL)).not.toBeChecked();
  await selectAdminOption(
    page.getByLabel("Verify this record for"),
    HISTORICAL_VERSION_NAME
  );
  await page
    .getByLabel(/^Description/)
    .fill("Verifies the shared verification panel (edited).");
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(page).toHaveURL(
    "/admin/classes/test-e2e-player-class-verify/edit"
  );
  await page.waitForTimeout(500);
  await expect(
    page.locator(".admin-status-badge", {
      hasText: "Verified — current version",
    })
  ).toBeVisible();
});

test("unsaved changes are protected by the discard-changes prompt", async ({
  page,
}) => {
  await page.goto("/admin/classes/new");
  await createPlayerClassThroughForm(page, {
    name: "Test E2E Player Class Unsaved",
    slug: "test-e2e-player-class-unsaved",
    description: "Verifies the shared unsaved-changes guard.",
  });

  await page
    .getByLabel(/^Description/)
    .fill("An edit that is never saved.");
  await expect(page.getByText("Unsaved changes")).toBeVisible();

  await page.getByRole("link", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Discard unsaved changes?" })
  ).toBeVisible();

  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Keep editing", exact: true })
    .click();
  await expect(page).toHaveURL(
    "/admin/classes/test-e2e-player-class-unsaved/edit"
  );
  await expect(
    page.getByLabel(/^Description/)
  ).toHaveValue("An edit that is never saved.");

  await page.getByRole("link", { name: "Cancel", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Discard changes", exact: true })
    .click();
  await expect(page).toHaveURL("/admin/classes");
});
