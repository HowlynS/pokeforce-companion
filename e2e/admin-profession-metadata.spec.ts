// Coverage for the retired Profession "Metadata" tab (Visual Pass
// sub-slice 4): its one fact (Recipe count) was already shown by the
// Recipes tab's own count, and Verification/Timestamps duplicated
// General's own aside — so the tab and its route were removed rather
// than kept as a near-empty third destination. This suite proves the
// old route redirects safely to General instead of 404ing (preserving
// the active search query), and that the Metadata tab no longer appears
// anywhere in the tab strip.
//
// Runs in the chromium-admin project with the storage state saved by
// auth.setup.ts. Every temporary Profession uses the test-e2e-profession
// slug prefix.

import { expect, test, type Page } from "@playwright/test";
import {
  countE2eTestProfessionRecords,
  deleteE2eTestProfessionRecords,
  readFixtureCounts,
} from "./helpers/database-cleanup";

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

function tabNav(page: Page) {
  return page.getByRole("navigation", { name: "Profession editor sections" });
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

test("visiting the old Metadata route redirects to General, preserving the search query", async ({
  page,
}) => {
  const PROFESSION = {
    name: "Test E2E Profession Metadata Redirect",
    slug: "test-e2e-profession-metadata-redirect",
  };
  await createTemporaryProfession(page, PROFESSION);

  await page.goto(`/admin/professions/${PROFESSION.slug}/metadata?q=test`);
  await expect(page).toHaveURL(
    `/admin/professions/${PROFESSION.slug}/edit?q=test`
  );
  await expect(
    page.getByRole("heading", { level: 1, name: PROFESSION.name, exact: true })
  ).toBeVisible();
  await expect(
    tabNav(page).getByRole("link", { name: "General", exact: true })
  ).toHaveAttribute("aria-current", "page");
});

test("the tab strip no longer offers a Metadata destination anywhere", async ({
  page,
}) => {
  const PROFESSION = {
    name: "Test E2E Profession Metadata Gone",
    slug: "test-e2e-profession-metadata-gone",
  };
  await createTemporaryProfession(page, PROFESSION);

  await page.goto(`/admin/professions/${PROFESSION.slug}/edit`);
  await expect(tabNav(page).getByRole("link")).toHaveCount(2);
  await expect(
    tabNav(page).getByRole("link", { name: "Metadata" })
  ).toHaveCount(0);
});

test("an unknown profession slug on the old metadata route still fails safely", async ({
  page,
}) => {
  const response = await page.goto(
    "/admin/professions/test-e2e-profession-metadata-does-not-exist/metadata"
  );
  expect(response?.status()).toBe(404);
});

test("seeded fixtures are preserved and no test profession remains", async () => {
  expect(await readFixtureCounts()).toEqual({
    categories: 5,
    professions: 10,
    items: 16,
    recipes: 8,
    recipeIngredients: 15,
  });
  expect(await countE2eTestProfessionRecords()).toBe(0);
});
