// Authenticated coverage for the Item "Metadata" tab (Slice 9B.8): the
// fourth and final real Item tab, showing restrained, read-only
// administrative information — created/updated dates and verification
// status/version/date — with no form, picker, checkbox, submit button,
// delete action, or image control anywhere in the main content region.
// The Game Version verification rules themselves (stamping,
// current-version resolution, tampered-id rejection) are exhaustively
// covered by admin-items.spec.ts's own verification test and the Game
// Version service tests; this suite only proves the Metadata tab
// DISPLAYS that state correctly and never exposes internal ids.
//
// Runs in the chromium-admin project with the storage state saved by
// auth.setup.ts. Every temporary Item uses the test-e2e-item slug
// prefix; verification is stamped against the persistent, always-current
// test-gv-current fixture — no additional Game Version is created, so no
// extra cleanup surface is introduced beyond the existing Item helpers.

import { expect, test, type Page } from "@playwright/test";
import {
  E2E_CURRENT_GAME_VERSION_NAME,
  countE2eTestItemRecords,
  deleteE2eTestItemRecords,
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
  await deleteE2eTestItemRecords();
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

test.beforeAll(async () => {
  await deleteE2eTestItemRecords();
  expect(await countE2eTestItemRecords()).toBe(0);
});

test.afterAll(async () => {
  const remaining = await deleteE2eTestItemRecords();
  expect(remaining).toBe(0);
});

// One row of the shared Item record list, located by its exact primary
// text inside the list's navigation landmark.
function recordRow(page: Page, name: string) {
  return page
    .getByRole("navigation", { name: "Items records" })
    .getByRole("link")
    .filter({ has: page.getByText(name, { exact: true }) });
}

function tabNav(page: Page) {
  return page.getByRole("navigation", { name: "Item editor sections" });
}

// The Metadata tab's own content, excluding the record list and header —
// the record list's search form is expected to stay on-screen (Slice
// 9B.8 requires it), so "no form/mutation control" assertions must be
// scoped to this region rather than the whole page.
function mainContent(page: Page) {
  return page.locator(".admin-workspace-main");
}

// One of the shared panels' rows (Verification or Timestamps), located
// by its label (dt) text — scoped to the panel by heading so identical
// row labels in different panels can never collide. The row's dt/dd text
// is concatenated with no separator, so the filter is anchored to the
// START of the row's text — otherwise a label like "Current version"
// would also match the unrelated "Verified — current version" status
// badge's own "admin-panel-row" wrapper (case-insensitive substring).
function panelRow(page: Page, panelTitle: string, label: string) {
  return page
    .locator(".admin-panel")
    .filter({
      has: page.getByRole("heading", { level: 2, name: panelTitle, exact: true }),
    })
    .locator(".admin-panel-row")
    .filter({ hasText: new RegExp(`^${label}`) });
}

async function createTemporaryItem(
  page: Page,
  data: { name: string; slug: string }
) {
  await page.goto("/admin/items/new");
  await page.getByLabel("Name", { exact: true }).fill(data.name);
  await page.getByLabel(/^Slug/).fill(data.slug);
  await page.getByRole("button", { name: "Create item", exact: true }).click();
  await expect(page).toHaveURL("/admin/items?success=created");
}

test("opening the Metadata tab directly shows created/updated dates and Unverified status inside the Item workspace", async ({
  page,
}) => {
  const ITEM = {
    name: "Test E2E Item Metadata Tab",
    slug: "test-e2e-item-metadata-tab",
  };
  await createTemporaryItem(page, ITEM);

  await page.goto(`/admin/items/${ITEM.slug}/metadata`);

  // One h1: the item's own name; the record list stays visible with this
  // item selected; the Metadata tab is marked active.
  await expect(
    page.getByRole("heading", { level: 1, name: ITEM.name, exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Items records" })
  ).toBeVisible();
  await expect(recordRow(page, ITEM.name)).toHaveAttribute(
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

  // No placeholder dash anywhere in the panels.
  await expect(page.locator(".admin-panel").getByText("—", { exact: true })).toHaveCount(
    0
  );

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

test("a verified item shows the verified version and verification date on the Metadata tab", async ({
  page,
}) => {
  const ITEM = {
    name: "Test E2E Item Metadata Verified",
    slug: "test-e2e-item-metadata-verified",
  };
  await createTemporaryItem(page, ITEM);

  // Verify through the real General edit form's shared VerificationPanel
  // (unchanged behavior) — the picker defaults to the current version.
  await page.goto(`/admin/items/${ITEM.slug}/edit`);
  await page.getByLabel(VERIFICATION_CHECKBOX_LABEL).check();
  await page.getByRole("button", { name: "Save item", exact: true }).click();
  await expect(page).toHaveURL("/admin/items?success=updated");

  await page.goto(`/admin/items/${ITEM.slug}/metadata`);
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

test("switching items while on the Metadata tab preserves the tab and q", async ({
  page,
}) => {
  const ITEM_A = {
    name: "Test E2E Item Metadata Switch A",
    slug: "test-e2e-item-metadata-switch-a",
  };
  const ITEM_B = {
    name: "Test E2E Item Metadata Switch B",
    slug: "test-e2e-item-metadata-switch-b",
  };
  await createTemporaryItem(page, ITEM_A);
  await createTemporaryItem(page, ITEM_B);

  // A shared, distinguishing query so only these two temporary items match.
  await page.goto("/admin/items");
  await page
    .getByRole("searchbox", { name: "Search items" })
    .fill("test e2e item metadata switch");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(recordRow(page, ITEM_A.name)).toBeVisible();
  await expect(recordRow(page, ITEM_B.name)).toBeVisible();

  await recordRow(page, ITEM_A.name).click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/items/${ITEM_A.slug}/edit\\?q=`)
  );

  await tabNav(page).getByRole("link", { name: "Metadata", exact: true }).click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/items/${ITEM_A.slug}/metadata\\?q=`)
  );
  await expect(recordRow(page, ITEM_A.name)).toHaveAttribute(
    "aria-current",
    "page"
  );

  // Switching records while ON the Metadata tab opens the OTHER item's
  // Metadata tab — not its General tab — with q intact.
  await recordRow(page, ITEM_B.name).click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/items/${ITEM_B.slug}/metadata\\?q=`)
  );
  await expect(
    page.getByRole("heading", { level: 1, name: ITEM_B.name, exact: true })
  ).toBeVisible();
  await expect(
    tabNav(page).getByRole("link", { name: "Metadata", exact: true })
  ).toHaveAttribute("aria-current", "page");
  await expect(recordRow(page, ITEM_B.name)).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(recordRow(page, ITEM_A.name)).not.toHaveAttribute(
    "aria-current",
    "page"
  );
});

test("General, Acquisition Sources, and Used in Recipes remain real links from the Metadata tab, and no Item tab is disabled", async ({
  page,
}) => {
  const ITEM = {
    name: "Test E2E Item Metadata Nav",
    slug: "test-e2e-item-metadata-nav",
  };
  await createTemporaryItem(page, ITEM);

  await page.goto(`/admin/items/${ITEM.slug}/metadata`);
  await expect(
    tabNav(page).getByRole("link", { name: "Metadata", exact: true })
  ).toHaveAttribute("aria-current", "page");
  await expect(tabNav(page).locator('[aria-current="page"]')).toHaveCount(1);
  await expect(tabNav(page).locator('[aria-disabled="true"]')).toHaveCount(0);

  await tabNav(page).getByRole("link", { name: "General", exact: true }).click();
  await expect(page).toHaveURL(`/admin/items/${ITEM.slug}/edit`);
  await expect(
    tabNav(page).getByRole("link", { name: "General", exact: true })
  ).toHaveAttribute("aria-current", "page");

  await tabNav(page)
    .getByRole("link", { name: "Acquisition Sources", exact: true })
    .click();
  await expect(page).toHaveURL(`/admin/items/${ITEM.slug}/sources`);
  await expect(
    tabNav(page).getByRole("link", { name: "Acquisition Sources", exact: true })
  ).toHaveAttribute("aria-current", "page");

  await tabNav(page)
    .getByRole("link", { name: "Used in Recipes", exact: true })
    .click();
  await expect(page).toHaveURL(`/admin/items/${ITEM.slug}/recipes`);
  await expect(
    tabNav(page).getByRole("link", { name: "Used in Recipes", exact: true })
  ).toHaveAttribute("aria-current", "page");

  await tabNav(page).getByRole("link", { name: "Metadata", exact: true }).click();
  await expect(page).toHaveURL(`/admin/items/${ITEM.slug}/metadata`);
  await expect(
    tabNav(page).getByRole("link", { name: "Metadata", exact: true })
  ).toHaveAttribute("aria-current", "page");
});

test("an unknown item slug fails safely on the metadata route", async ({
  page,
}) => {
  const response = await page.goto(
    "/admin/items/test-e2e-item-metadata-does-not-exist/metadata"
  );
  expect(response?.status()).toBe(404);
});

test("seeded fixtures are preserved and no test item remains", async () => {
  expect(await readFixtureCounts()).toEqual({
    categories: 5,
    professions: 10,
    items: 16,
    recipes: 8,
    recipeIngredients: 15,
  });
  expect(await countE2eTestItemRecords()).toBe(0);
});
