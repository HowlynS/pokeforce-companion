// Authenticated coverage for the Category "Metadata" tab (Slice 9E.4):
// the third and final real Category tab, completing the Category
// workspace, showing restrained, read-only administrative information —
// created/updated dates and an Item count — with no form, checkbox,
// submit button, delete action, image control, verification control, or
// Item-relationship control anywhere in the main content region.
// Categories carry no image or gameplay-verification behavior, so this
// tab is deliberately leaner than the Item/Recipe/Profession Metadata
// tabs it mirrors: no picker, no verification status, no verified-date
// row exists anywhere. Mirrors admin-profession-metadata.spec.ts's
// (Slice 9D.4) structure exactly, minus every verification-specific
// assertion.
//
// Runs in the chromium-admin project with the storage state saved by
// auth.setup.ts. Every temporary Category uses the test-e2e-category
// slug prefix; the one nonzero-Item-count test reuses the existing
// test-e2e-category-relation- DB helper (Slice 9E.3), so cleanup
// (deleteE2eTestCategories) is already guard-first and exhaustive — no
// new cleanup surface is introduced.

import { expect, test, type Page } from "@playwright/test";
import {
  countE2eTestCategories,
  createTemporaryItemForCategoryItemsTab,
  deleteE2eTestCategories,
  readFixtureCounts,
} from "./helpers/database-cleanup";

// Browser error hygiene: any uncaught page error fails the test. Serial
// single-worker execution makes this module-level state safe.
let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(async () => {
  await deleteE2eTestCategories();
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

test.beforeAll(async () => {
  await deleteE2eTestCategories();
  expect(await countE2eTestCategories()).toBe(0);
});

test.afterAll(async () => {
  const remaining = await deleteE2eTestCategories();
  expect(remaining).toBe(0);
});

// One row of the shared Category record list, located by its exact
// primary text inside the list's navigation landmark.
function recordRow(page: Page, name: string) {
  return page
    .getByRole("navigation", { name: "Categories records" })
    .getByRole("link")
    .filter({ has: page.getByText(name, { exact: true }) });
}

function tabNav(page: Page) {
  return page.getByRole("navigation", { name: "Category editor sections" });
}

// The Metadata tab's own content, excluding the record list and header —
// the record list's search form is expected to stay on-screen, so "no
// form/mutation control" assertions must be scoped to this region rather
// than the whole page.
function mainContent(page: Page) {
  return page.locator(".admin-workspace-main");
}

// One of the shared panels' rows (Category or Timestamps), located by
// its label (dt) text — scoped to the panel by heading so identical row
// labels in different panels can never collide. The row's dt/dd text is
// concatenated with no separator, so the filter is anchored to the START
// of the row's text.
function panelRow(page: Page, panelTitle: string, label: string) {
  return page
    .locator(".admin-panel")
    .filter({
      has: page.getByRole("heading", { level: 2, name: panelTitle, exact: true }),
    })
    .locator(".admin-panel-row")
    .filter({ hasText: new RegExp(`^${label}`) });
}

async function createTemporaryCategory(
  page: Page,
  data: { name: string; slug: string }
) {
  await page.goto("/admin/categories/new");
  await page.getByLabel("Name", { exact: true }).fill(data.name);
  await page.getByLabel(/^Slug/).fill(data.slug);
  await page
    .getByRole("button", { name: "Create Category", exact: true })
    .click();
  await expect(page).toHaveURL("/admin/categories?success=created");
}

test("opening the Metadata tab directly shows created/updated dates and a zero Item count inside the Category workspace", async ({
  page,
}) => {
  const CATEGORY = {
    name: "Test E2E Category Metadata Tab",
    slug: "test-e2e-category-metadata-tab",
  };
  await createTemporaryCategory(page, CATEGORY);

  await page.goto(`/admin/categories/${CATEGORY.slug}/metadata`);

  // One h1: the category's own name; the record list stays visible with
  // this category selected; the Metadata tab is marked active.
  await expect(
    page.getByRole("heading", { level: 1, name: CATEGORY.name, exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Categories records" })
  ).toBeVisible();
  await expect(recordRow(page, CATEGORY.name)).toHaveAttribute(
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

  // Zero linked items is itself meaningful administrative context, so it
  // still renders as a real row (never omitted).
  await expect(panelRow(page, "Category", "Items")).toContainText("0");

  // No placeholder dash anywhere in the panels.
  await expect(
    page.locator(".admin-panel").getByText("—", { exact: true })
  ).toHaveCount(0);

  // No verification content exists at all — Categories carry no
  // verification stamp.
  await expect(page.locator(".admin-status-badge")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 2, name: "Verification", exact: true })
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 2, name: "Image", exact: true })
  ).toHaveCount(0);

  // Strictly read-only: no form, checkbox, submit button, file input, or
  // delete action anywhere in the main content region (the record list's
  // own search form is outside this region and stays visible, as
  // required).
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

test("the Item count on the Metadata tab reflects linked items accurately", async ({
  page,
}) => {
  const CATEGORY = {
    name: "Test E2E Category Metadata Item Count",
    slug: "test-e2e-category-metadata-item-count",
  };
  await createTemporaryCategory(page, CATEGORY);
  await createTemporaryItemForCategoryItemsTab(CATEGORY.slug, {
    suffix: "metadata-count",
    itemName: "Test E2E Category Metadata Item Count Item",
  });

  await page.goto(`/admin/categories/${CATEGORY.slug}/metadata`);
  await expect(panelRow(page, "Category", "Items")).toContainText("1");

  // No Item-relationship control (create/unlink/edit) exists here — the
  // Items tab is the dedicated place for that content.
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /edit$/i })).toHaveCount(0);
});

test("switching categories while on the Metadata tab preserves the tab and q", async ({
  page,
}) => {
  const CATEGORY_A = {
    name: "Test E2E Category Metadata Switch A",
    slug: "test-e2e-category-metadata-switch-a",
  };
  const CATEGORY_B = {
    name: "Test E2E Category Metadata Switch B",
    slug: "test-e2e-category-metadata-switch-b",
  };
  await createTemporaryCategory(page, CATEGORY_A);
  await createTemporaryCategory(page, CATEGORY_B);

  // A shared, distinguishing query so only these two temporary
  // categories match.
  await page.goto("/admin/categories");
  await page
    .getByRole("searchbox", { name: "Search categories" })
    .fill("test e2e category metadata switch");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(recordRow(page, CATEGORY_A.name)).toBeVisible();
  await expect(recordRow(page, CATEGORY_B.name)).toBeVisible();

  await recordRow(page, CATEGORY_A.name).click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/categories/${CATEGORY_A.slug}/edit\\?q=`)
  );

  await tabNav(page)
    .getByRole("link", { name: "Metadata", exact: true })
    .click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/categories/${CATEGORY_A.slug}/metadata\\?q=`)
  );
  await expect(recordRow(page, CATEGORY_A.name)).toHaveAttribute(
    "aria-current",
    "page"
  );

  // Switching records while ON the Metadata tab opens the OTHER
  // category's Metadata tab — not its General tab — with q intact.
  await recordRow(page, CATEGORY_B.name).click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/categories/${CATEGORY_B.slug}/metadata\\?q=`)
  );
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: CATEGORY_B.name,
      exact: true,
    })
  ).toBeVisible();
  await expect(
    tabNav(page).getByRole("link", { name: "Metadata", exact: true })
  ).toHaveAttribute("aria-current", "page");
  await expect(recordRow(page, CATEGORY_B.name)).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(recordRow(page, CATEGORY_A.name)).not.toHaveAttribute(
    "aria-current",
    "page"
  );
});

test("General and Items remain real links from the Metadata tab, and no Category tab is disabled", async ({
  page,
}) => {
  const CATEGORY = {
    name: "Test E2E Category Metadata Nav",
    slug: "test-e2e-category-metadata-nav",
  };
  await createTemporaryCategory(page, CATEGORY);

  await page.goto(`/admin/categories/${CATEGORY.slug}/metadata`);
  await expect(
    tabNav(page).getByRole("link", { name: "Metadata", exact: true })
  ).toHaveAttribute("aria-current", "page");
  await expect(tabNav(page).locator('[aria-current="page"]')).toHaveCount(1);
  await expect(tabNav(page).locator('[aria-disabled="true"]')).toHaveCount(0);

  await tabNav(page)
    .getByRole("link", { name: "General", exact: true })
    .click();
  await expect(page).toHaveURL(`/admin/categories/${CATEGORY.slug}/edit`);
  await expect(
    tabNav(page).getByRole("link", { name: "General", exact: true })
  ).toHaveAttribute("aria-current", "page");

  await tabNav(page)
    .getByRole("link", { name: "Items", exact: true })
    .click();
  await expect(page).toHaveURL(`/admin/categories/${CATEGORY.slug}/items`);
  await expect(
    tabNav(page).getByRole("link", { name: "Items", exact: true })
  ).toHaveAttribute("aria-current", "page");

  await tabNav(page)
    .getByRole("link", { name: "Metadata", exact: true })
    .click();
  await expect(page).toHaveURL(`/admin/categories/${CATEGORY.slug}/metadata`);
  await expect(
    tabNav(page).getByRole("link", { name: "Metadata", exact: true })
  ).toHaveAttribute("aria-current", "page");
});

test("an unknown category slug fails safely on the metadata route", async ({
  page,
}) => {
  const response = await page.goto(
    "/admin/categories/test-e2e-category-metadata-does-not-exist/metadata"
  );
  expect(response?.status()).toBe(404);
});

test("seeded fixtures are preserved and no test category or relation record remains", async () => {
  expect(await readFixtureCounts()).toEqual({
    categories: 5,
    professions: 10,
    items: 16,
    recipes: 8,
    recipeIngredients: 15,
  });
  expect(await countE2eTestCategories()).toBe(0);
});
