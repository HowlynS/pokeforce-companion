// Coverage for the retired Category "Metadata" tab (Visual Pass sub-slice
// 4): its one fact (Item count) was already shown by the Items tab's own
// count, and Timestamps duplicated General's own aside — so the tab and
// its route were removed rather than kept as a near-empty third
// destination. This suite proves the old route redirects safely to
// General instead of 404ing (preserving the active search query), and
// that the Metadata tab no longer appears anywhere in the tab strip.
//
// Runs in the chromium-admin project with the storage state saved by
// auth.setup.ts. Every temporary Category uses the test-e2e-category
// slug prefix.

import { expect, test, type Page } from "@playwright/test";
import {
  countE2eTestCategories,
  deleteE2eTestCategories,
  readFixtureCounts,
} from "./helpers/database-cleanup";

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

function tabNav(page: Page) {
  return page.getByRole("navigation", { name: "Category editor sections" });
}

async function createTemporaryCategory(
  page: Page,
  data: { name: string; slug: string }
) {
  await page.goto("/admin/categories/new");
  await page.getByLabel("Name", { exact: true }).fill(data.name);
  await page.getByLabel(/^Page address/).fill(data.slug);
  await page
    .getByRole("button", { name: "Create Category", exact: true })
    .click();
  await expect(page).toHaveURL("/admin/categories?success=created");
}

test("visiting the old Metadata route redirects to General, preserving the search query", async ({
  page,
}) => {
  const CATEGORY = {
    name: "Test E2E Category Metadata Redirect",
    slug: "test-e2e-category-metadata-redirect",
  };
  await createTemporaryCategory(page, CATEGORY);

  await page.goto(`/admin/categories/${CATEGORY.slug}/metadata?q=test`);
  await expect(page).toHaveURL(
    `/admin/categories/${CATEGORY.slug}/edit?q=test`
  );
  await expect(
    page.getByRole("heading", { level: 1, name: CATEGORY.name, exact: true })
  ).toBeVisible();
  await expect(
    tabNav(page).getByRole("link", { name: "General", exact: true })
  ).toHaveAttribute("aria-current", "page");
});

test("the tab strip no longer offers a Metadata destination anywhere", async ({
  page,
}) => {
  const CATEGORY = {
    name: "Test E2E Category Metadata Gone",
    slug: "test-e2e-category-metadata-gone",
  };
  await createTemporaryCategory(page, CATEGORY);

  await page.goto(`/admin/categories/${CATEGORY.slug}/edit`);
  await expect(tabNav(page).getByRole("link")).toHaveCount(2);
  await expect(
    tabNav(page).getByRole("link", { name: "Metadata" })
  ).toHaveCount(0);
});

test("an unknown category slug on the old metadata route still fails safely", async ({
  page,
}) => {
  const response = await page.goto(
    "/admin/categories/test-e2e-category-metadata-does-not-exist/metadata"
  );
  expect(response?.status()).toBe(404);
});

test("seeded fixtures are preserved and no test category remains", async () => {
  expect(await readFixtureCounts()).toEqual({
    categories: 5,
    professions: 10,
    items: 16,
    recipes: 8,
    recipeIngredients: 15,
  });
  expect(await countE2eTestCategories()).toBe(0);
});
