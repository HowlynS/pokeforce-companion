// Coverage for the retired Recipe "Metadata" tab (Visual Pass sub-slice
// 4): its resulting-item/profession/required-level facts were already on
// General, the ingredient count is visible on Ingredients, and
// Verification/Timestamps duplicated General's own aside — so the tab
// and its route were removed rather than kept as a near-empty third
// destination. This suite proves the old route redirects safely to
// General instead of 404ing (preserving the active search query), that
// the Metadata tab no longer appears anywhere in the tab strip, and that
// General still shows the resulting item/profession/required level.
//
// Runs in the chromium-admin project with the storage state saved by
// auth.setup.ts. Every temporary Recipe uses the test-e2e-recipe slug
// prefix.

import { expect, test, type Page } from "@playwright/test";
import { selectAdminOption } from "./helpers/admin-select";
import {
  countE2eTestRecipeRecords,
  deleteE2eTestRecipeRecords,
  readFixtureCounts,
} from "./helpers/database-cleanup";

let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(async () => {
  await deleteE2eTestRecipeRecords();
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

test.beforeAll(async () => {
  await deleteE2eTestRecipeRecords();
  expect(await countE2eTestRecipeRecords()).toBe(0);
});

test.afterAll(async () => {
  const remaining = await deleteE2eTestRecipeRecords();
  expect(remaining).toBe(0);
});

function tabNav(page: Page) {
  return page.getByRole("navigation", { name: "Recipe editor sections" });
}

async function createTemporaryRecipe(
  page: Page,
  data: { name: string; slug: string; resultingItem: string }
) {
  await page.goto("/admin/recipes/new");
  await page.getByLabel("Name", { exact: true }).fill(data.name);
  await page.getByLabel(/^Page address/).fill(data.slug);
  await selectAdminOption(
    page.getByRole("combobox", { name: "Resulting item", exact: true }),
    data.resultingItem
  );

  const group = page.getByRole("group", {
    name: "Ingredients (fill at least one row)",
  });
  await selectAdminOption(
    group.getByRole("combobox").first(),
    data.resultingItem
  );
  await group.getByPlaceholder("Qty").first().fill("1");

  await page.getByRole("button", { name: "Create Recipe", exact: true }).click();
  await expect(page).toHaveURL(`/admin/recipes/${data.slug}/edit`);
}

test("visiting the old Metadata route redirects to General, preserving the search query", async ({
  page,
}) => {
  const RECIPE = {
    name: "Test E2E Recipe Metadata Redirect",
    slug: "test-e2e-recipe-metadata-redirect",
    resultingItem: "Iron Ore",
  };
  await createTemporaryRecipe(page, RECIPE);

  await page.goto(`/admin/recipes/${RECIPE.slug}/metadata?q=test`);
  await expect(page).toHaveURL(`/admin/recipes/${RECIPE.slug}/edit?q=test`);
  await expect(
    page.getByRole("heading", { level: 1, name: RECIPE.name, exact: true })
  ).toBeVisible();
  await expect(
    tabNav(page).getByRole("link", { name: "General", exact: true })
  ).toHaveAttribute("aria-current", "page");
});

test("the tab strip no longer offers a Metadata destination, and General still shows the resulting item", async ({
  page,
}) => {
  const RECIPE = {
    name: "Test E2E Recipe Metadata Gone",
    slug: "test-e2e-recipe-metadata-gone",
    resultingItem: "Iron Ore",
  };
  await createTemporaryRecipe(page, RECIPE);

  await page.goto(`/admin/recipes/${RECIPE.slug}/edit`);
  await expect(tabNav(page).getByRole("link")).toHaveCount(2);
  await expect(
    tabNav(page).getByRole("link", { name: "Metadata" })
  ).toHaveCount(0);
  // AdminSelect (Massive Admin Interaction Completion Pass, Phase 1)
  // replaced the native <select> here — the trigger's own displayed text
  // shows the selected value directly; there is no <option:checked>.
  await expect(
    page.getByRole("combobox", { name: "Resulting item", exact: true })
  ).toHaveText("Iron Ore");
});

test("an unknown recipe slug on the old metadata route still fails safely", async ({
  page,
}) => {
  const response = await page.goto(
    "/admin/recipes/test-e2e-recipe-metadata-does-not-exist/metadata"
  );
  expect(response?.status()).toBe(404);
});

test("seeded fixtures are preserved and no test recipe remains", async () => {
  expect(await readFixtureCounts()).toEqual({
    categories: 5,
    professions: 10,
    items: 16,
    recipes: 8,
    recipeIngredients: 15,
  });
  expect(await countE2eTestRecipeRecords()).toBe(0);
});
