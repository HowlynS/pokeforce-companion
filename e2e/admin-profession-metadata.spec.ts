// Authenticated coverage for the Profession "Metadata" tab (Slice 9D.4):
// the third and final real Profession tab, completing the Profession
// workspace, showing restrained, read-only administrative information —
// created/updated dates, verification status/version/date, and a Recipe
// count — with no form, picker, checkbox, submit button, delete action,
// or Recipe-relationship control anywhere in the main content region.
// The Game Version verification rules themselves (stamping,
// current-version resolution, tampered-id rejection) are exhaustively
// covered by admin-professions.spec.ts's own verification test and the
// Game Version service tests; this suite only proves the Metadata tab
// DISPLAYS that state correctly and never exposes internal ids. Mirrors
// admin-item-metadata.spec.ts's (Slice 9B.8) structure exactly.
//
// Runs in the chromium-admin project with the storage state saved by
// auth.setup.ts. Every temporary Profession uses the test-e2e-profession
// slug prefix; the one nonzero-Recipe-count test reuses the existing
// test-e2e-profession-relation- DB helper (Slice 9D.3), so cleanup
// (deleteE2eTestProfessionRecords) is already guard-first and exhaustive —
// no new cleanup surface is introduced.

import { expect, test, type Page } from "@playwright/test";
import {
  E2E_CURRENT_GAME_VERSION_NAME,
  countE2eTestProfessionRecords,
  createTemporaryRecipeForProfessionsTab,
  deleteE2eTestProfessionRecords,
  readFixtureCounts,
} from "./helpers/database-cleanup";

const VERIFICATION_CHECKBOX_LABEL =
  "Mark gameplay data as verified for the selected game version.";

// Browser error hygiene: any uncaught page error fails the test. Serial
// single-worker execution makes this module-level state safe.
let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(async () => {
  await deleteE2eTestProfessionRecords();
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

test.beforeAll(async () => {
  await deleteE2eTestProfessionRecords();
  expect(await countE2eTestProfessionRecords()).toBe(0);
});

test.afterAll(async () => {
  const remaining = await deleteE2eTestProfessionRecords();
  expect(remaining).toBe(0);
});

// One row of the shared Profession record list, located by its exact
// primary text inside the list's navigation landmark.
function recordRow(page: Page, name: string) {
  return page
    .getByRole("navigation", { name: "Professions records" })
    .getByRole("link")
    .filter({ has: page.getByText(name, { exact: true }) });
}

function tabNav(page: Page) {
  return page.getByRole("navigation", { name: "Profession editor sections" });
}

// The Metadata tab's own content, excluding the record list and header —
// the record list's search form is expected to stay on-screen, so "no
// form/mutation control" assertions must be scoped to this region rather
// than the whole page.
function mainContent(page: Page) {
  return page.locator(".admin-workspace-main");
}

// One of the shared panels' rows (Profession, Verification, or
// Timestamps), located by its label (dt) text — scoped to the panel by
// heading so identical row labels in different panels can never collide.
// The row's dt/dd text is concatenated with no separator, so the filter
// is anchored to the START of the row's text — otherwise a label like
// "Current version" would also match the unrelated "Verified — current
// version" status badge's own "admin-panel-row" wrapper (case-insensitive
// substring).
function panelRow(page: Page, panelTitle: string, label: string) {
  return page
    .locator(".admin-panel")
    .filter({
      has: page.getByRole("heading", { level: 2, name: panelTitle, exact: true }),
    })
    .locator(".admin-panel-row")
    .filter({ hasText: new RegExp(`^${label}`) });
}

async function createTemporaryProfession(
  page: Page,
  data: { name: string; slug: string }
) {
  await page.goto("/admin/professions/new");
  await page.getByLabel("Name", { exact: true }).fill(data.name);
  await page.getByLabel(/^Slug/).fill(data.slug);
  await page
    .getByRole("button", { name: "Create Profession", exact: true })
    .click();
  await expect(page).toHaveURL("/admin/professions?success=created");
}

test("opening the Metadata tab directly shows created/updated dates, Unverified status, and a zero Recipe count inside the Profession workspace", async ({
  page,
}) => {
  const PROFESSION = {
    name: "Test E2E Profession Metadata Tab",
    slug: "test-e2e-profession-metadata-tab",
  };
  await createTemporaryProfession(page, PROFESSION);

  await page.goto(`/admin/professions/${PROFESSION.slug}/metadata`);

  // One h1: the profession's own name; the record list stays visible with
  // this profession selected; the Metadata tab is marked active.
  await expect(
    page.getByRole("heading", { level: 1, name: PROFESSION.name, exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Professions records" })
  ).toBeVisible();
  await expect(recordRow(page, PROFESSION.name)).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(
    tabNav(page).getByRole("link", { name: "Metadata", exact: true })
  ).toHaveAttribute("aria-current", "page");
  await expect(tabNav(page).locator('[aria-disabled="true"]')).toHaveCount(0);

  // Created/updated dates render (stable YYYY-MM-DD).
  await expect(panelRow(page, "Timestamps", "Created")).toBeVisible();
  await expect(panelRow(page, "Timestamps", "Updated")).toBeVisible();
  await expect(panelRow(page, "Timestamps", "Verified")).toHaveCount(0);

  // Unverified status, with no fabricated verified-version/date rows —
  // but the current Game Version still renders regardless of
  // verification state.
  await expect(
    page.locator(".admin-status-badge", { hasText: "Unverified" })
  ).toBeVisible();
  await expect(panelRow(page, "Verification", "Verified against")).toHaveCount(
    0
  );
  await expect(panelRow(page, "Verification", "Verified on")).toHaveCount(0);
  await expect(panelRow(page, "Verification", "Current version")).toContainText(
    E2E_CURRENT_GAME_VERSION_NAME
  );

  // Zero linked recipes is itself meaningful administrative context, so
  // it still renders as a real row (never omitted).
  await expect(panelRow(page, "Profession", "Recipes")).toContainText("0");

  // No placeholder dash anywhere in the panels.
  await expect(
    page.locator(".admin-panel").getByText("—", { exact: true })
  ).toHaveCount(0);

  // Strictly read-only: no form, picker, checkbox, submit button, file
  // input, or delete action anywhere in the main content region (the
  // record list's own search form is outside this region and stays
  // visible, as required).
  const main = mainContent(page);
  await expect(main.locator("form")).toHaveCount(0);
  await expect(main.locator("select")).toHaveCount(0);
  await expect(main.locator('input[type="checkbox"]')).toHaveCount(0);
  await expect(main.locator('input[type="file"]')).toHaveCount(0);
  await expect(main.locator('button[type="submit"]')).toHaveCount(0);
  await expect(main.getByRole("button", { name: /save/i })).toHaveCount(0);
  await expect(main.getByRole("link", { name: /delete/i })).toHaveCount(0);
  // No raw database id, foreign key, or storage path field.
  await expect(main.locator('input[name="id"]')).toHaveCount(0);
  await expect(main.locator('input[type="hidden"]')).toHaveCount(0);
});

test("a verified profession shows the verified version and verification date on the Metadata tab", async ({
  page,
}) => {
  const PROFESSION = {
    name: "Test E2E Profession Metadata Verified",
    slug: "test-e2e-profession-metadata-verified",
  };
  await createTemporaryProfession(page, PROFESSION);

  // Verify through the real General edit form's shared VerificationPanel
  // (unchanged behavior) — the picker defaults to the current version.
  await page.goto(`/admin/professions/${PROFESSION.slug}/edit`);
  await page.getByLabel(VERIFICATION_CHECKBOX_LABEL).check();
  await page
    .getByRole("button", { name: "Save Changes", exact: true })
    .click();
  await expect(page).toHaveURL("/admin/professions?success=updated");

  await page.goto(`/admin/professions/${PROFESSION.slug}/metadata`);
  await expect(
    page.locator(".admin-status-badge", {
      hasText: "Verified — current version",
    })
  ).toBeVisible();
  await expect(
    panelRow(page, "Verification", "Verified against")
  ).toContainText(E2E_CURRENT_GAME_VERSION_NAME);
  await expect(panelRow(page, "Verification", "Verified on")).toBeVisible();
  await expect(panelRow(page, "Timestamps", "Verified")).toBeVisible();
  await expect(
    panelRow(page, "Verification", "Current version")
  ).toContainText(E2E_CURRENT_GAME_VERSION_NAME);

  // Still no mutation control of any kind.
  const main = mainContent(page);
  await expect(main.locator("form")).toHaveCount(0);
  await expect(main.locator("select")).toHaveCount(0);
  await expect(main.locator('input[type="checkbox"]')).toHaveCount(0);
});

test("the Recipe count on the Metadata tab reflects linked recipes accurately", async ({
  page,
}) => {
  const PROFESSION = {
    name: "Test E2E Profession Metadata Recipe Count",
    slug: "test-e2e-profession-metadata-recipe-count",
  };
  await createTemporaryProfession(page, PROFESSION);
  await createTemporaryRecipeForProfessionsTab(PROFESSION.slug, {
    suffix: "metadata-count",
    recipeName: "Test E2E Profession Metadata Recipe Count Recipe",
  });

  await page.goto(`/admin/professions/${PROFESSION.slug}/metadata`);
  await expect(panelRow(page, "Profession", "Recipes")).toContainText("1");

  // No Recipe-relationship control (create/unlink/edit) exists here — the
  // Recipes tab is the dedicated place for that content.
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /edit$/i })).toHaveCount(0);
});

test("switching professions while on the Metadata tab preserves the tab and q", async ({
  page,
}) => {
  const PROFESSION_A = {
    name: "Test E2E Profession Metadata Switch A",
    slug: "test-e2e-profession-metadata-switch-a",
  };
  const PROFESSION_B = {
    name: "Test E2E Profession Metadata Switch B",
    slug: "test-e2e-profession-metadata-switch-b",
  };
  await createTemporaryProfession(page, PROFESSION_A);
  await createTemporaryProfession(page, PROFESSION_B);

  // A shared, distinguishing query so only these two temporary
  // professions match.
  await page.goto("/admin/professions");
  await page
    .getByRole("searchbox", { name: "Search professions" })
    .fill("test e2e profession metadata switch");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(recordRow(page, PROFESSION_A.name)).toBeVisible();
  await expect(recordRow(page, PROFESSION_B.name)).toBeVisible();

  await recordRow(page, PROFESSION_A.name).click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/professions/${PROFESSION_A.slug}/edit\\?q=`)
  );

  await tabNav(page)
    .getByRole("link", { name: "Metadata", exact: true })
    .click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/professions/${PROFESSION_A.slug}/metadata\\?q=`)
  );
  await expect(recordRow(page, PROFESSION_A.name)).toHaveAttribute(
    "aria-current",
    "page"
  );

  // Switching records while ON the Metadata tab opens the OTHER
  // profession's Metadata tab — not its General tab — with q intact.
  await recordRow(page, PROFESSION_B.name).click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/professions/${PROFESSION_B.slug}/metadata\\?q=`)
  );
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: PROFESSION_B.name,
      exact: true,
    })
  ).toBeVisible();
  await expect(
    tabNav(page).getByRole("link", { name: "Metadata", exact: true })
  ).toHaveAttribute("aria-current", "page");
  await expect(recordRow(page, PROFESSION_B.name)).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(recordRow(page, PROFESSION_A.name)).not.toHaveAttribute(
    "aria-current",
    "page"
  );
});

test("General and Recipes remain real links from the Metadata tab, and no Profession tab is disabled", async ({
  page,
}) => {
  const PROFESSION = {
    name: "Test E2E Profession Metadata Nav",
    slug: "test-e2e-profession-metadata-nav",
  };
  await createTemporaryProfession(page, PROFESSION);

  await page.goto(`/admin/professions/${PROFESSION.slug}/metadata`);
  await expect(
    tabNav(page).getByRole("link", { name: "Metadata", exact: true })
  ).toHaveAttribute("aria-current", "page");
  await expect(tabNav(page).locator('[aria-current="page"]')).toHaveCount(1);
  await expect(tabNav(page).locator('[aria-disabled="true"]')).toHaveCount(0);

  await tabNav(page)
    .getByRole("link", { name: "General", exact: true })
    .click();
  await expect(page).toHaveURL(`/admin/professions/${PROFESSION.slug}/edit`);
  await expect(
    tabNav(page).getByRole("link", { name: "General", exact: true })
  ).toHaveAttribute("aria-current", "page");

  await tabNav(page)
    .getByRole("link", { name: "Recipes", exact: true })
    .click();
  await expect(page).toHaveURL(`/admin/professions/${PROFESSION.slug}/recipes`);
  await expect(
    tabNav(page).getByRole("link", { name: "Recipes", exact: true })
  ).toHaveAttribute("aria-current", "page");

  await tabNav(page)
    .getByRole("link", { name: "Metadata", exact: true })
    .click();
  await expect(page).toHaveURL(`/admin/professions/${PROFESSION.slug}/metadata`);
  await expect(
    tabNav(page).getByRole("link", { name: "Metadata", exact: true })
  ).toHaveAttribute("aria-current", "page");
});

test("an unknown profession slug fails safely on the metadata route", async ({
  page,
}) => {
  const response = await page.goto(
    "/admin/professions/test-e2e-profession-metadata-does-not-exist/metadata"
  );
  expect(response?.status()).toBe(404);
});

test("seeded fixtures are preserved and no test profession or relation record remains", async () => {
  expect(await readFixtureCounts()).toEqual({
    categories: 5,
    professions: 10,
    items: 16,
    recipes: 8,
    recipeIngredients: 15,
  });
  expect(await countE2eTestProfessionRecords()).toBe(0);
});
