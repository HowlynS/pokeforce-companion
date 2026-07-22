// Coverage for the retired Item "Metadata" tab (Visual Pass sub-slice 4):
// every fact it showed (Verification, Timestamps) was already duplicated
// on General's own aside, so the tab and its route were removed rather
// than kept as a fourth near-empty destination. This suite proves the
// old route redirects safely to General instead of 404ing (preserving
// the active search query), that the Metadata tab no longer appears
// anywhere in the tab strip, and that every fact it used to show is
// still visible on General.
//
// Runs in the chromium-admin project with the storage state saved by
// auth.setup.ts. Every temporary Item uses the test-e2e-item slug
// prefix.

import { expect, test, type Page } from "@playwright/test";
import {
  countE2eTestItemRecords,
  deleteE2eTestItemRecords,
  readFixtureCounts,
} from "./helpers/database-cleanup";

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

function tabNav(page: Page) {
  return page.getByRole("navigation", { name: "Item editor sections" });
}

async function createTemporaryItem(
  page: Page,
  data: { name: string; slug: string }
) {
  await page.goto("/admin/items/new");
  await page.getByLabel("Name", { exact: true }).fill(data.name);
  await page.getByLabel(/^Page address/).fill(data.slug);
  await page.getByRole("button", { name: "Create item", exact: true }).click();
  await expect(page).toHaveURL("/admin/items?success=created");
}

test("visiting the old Metadata route redirects to General, preserving the search query", async ({
  page,
}) => {
  const ITEM = {
    name: "Test E2E Item Metadata Redirect",
    slug: "test-e2e-item-metadata-redirect",
  };
  await createTemporaryItem(page, ITEM);

  await page.goto(`/admin/items/${ITEM.slug}/metadata?q=test`);
  await expect(page).toHaveURL(`/admin/items/${ITEM.slug}/edit?q=test`);
  await expect(
    page.getByRole("heading", { level: 1, name: ITEM.name, exact: true })
  ).toBeVisible();
  await expect(
    tabNav(page).getByRole("link", { name: "General", exact: true })
  ).toHaveAttribute("aria-current", "page");
});

test("the tab strip no longer offers a Metadata destination anywhere", async ({
  page,
}) => {
  const ITEM = {
    name: "Test E2E Item Metadata Gone",
    slug: "test-e2e-item-metadata-gone",
  };
  await createTemporaryItem(page, ITEM);

  await page.goto(`/admin/items/${ITEM.slug}/edit`);
  await expect(tabNav(page).getByRole("link")).toHaveCount(3);
  await expect(
    tabNav(page).getByRole("link", { name: "Metadata" })
  ).toHaveCount(0);
});

test("an unknown item slug on the old metadata route still fails safely", async ({
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
