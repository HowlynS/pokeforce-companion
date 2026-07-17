// Authenticated coverage for the Item "Used in Recipes" tab (Slice
// 9B.7): a real, read-only tab inside the Item workspace showing every
// Recipe relationship for the selected Item — both directions ("used as
// an ingredient in" and "produced by"), never conflated, each linking to
// the EXISTING Recipe admin edit route. No inline recipe editing exists
// on this tab, so there is nothing here that duplicates
// admin-recipes.spec.ts's own CRUD coverage.
//
// Runs in the chromium-admin project with the storage state saved by
// auth.setup.ts. Every temporary Item uses the test-e2e-item slug
// prefix; the Recipe/RecipeIngredient fixtures reuse the existing
// test-e2e-item-relation- DB helpers already relied on by
// admin-items.spec.ts's blocked-deletion tests, so cleanup
// (deleteE2eTestItemRecords) is already guard-first and exhaustive —
// no new cleanup surface is introduced.

import { expect, test, type Page } from "@playwright/test";
import {
  countE2eTestItemRecords,
  createTemporaryIngredientReferenceToItem,
  createTemporaryRecipeProducingItem,
  createTemporaryRecipeProducingItemWithMetadata,
  deleteE2eTestItemRecords,
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

test("opening the Used in Recipes tab directly shows both relationship directions inside the Item workspace", async ({
  page,
}) => {
  const ITEM = {
    name: "Test E2E Item Recipes Tab",
    slug: "test-e2e-item-recipes-tab",
  };
  await createTemporaryItem(page, ITEM);
  await createTemporaryRecipeProducingItem(ITEM.slug);
  await createTemporaryIngredientReferenceToItem(ITEM.slug);
  await createTemporaryRecipeProducingItemWithMetadata(
    ITEM.slug,
    "smithing",
    7
  );

  await page.goto(`/admin/items/${ITEM.slug}/recipes`);

  // One h1: the item's own name; the record list stays visible with this
  // item selected; the Used in Recipes tab is marked active.
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
    tabNav(page).getByRole("link", { name: "Used in Recipes", exact: true })
  ).toHaveAttribute("aria-current", "page");

  // Used as an ingredient in: recipe name (linking to the Recipe admin
  // edit route), quantity, and the resulting item name. Profession and
  // required level are both absent on this fixture, so the Recipe cell
  // carries no detail line at all — no placeholder dash, no "Profession:"
  // or "Required level:" label, and no separate Profession/Required Level
  // column exists any more (three cells per row: Recipe, Quantity,
  // Resulting Item).
  const ingredientRow = page
    .getByRole("row")
    .filter({
      has: page.getByRole("cell", {
        name: "Test E2E Item Relation Consuming Recipe",
        exact: true,
      }),
    });
  await expect(ingredientRow).toBeVisible();
  await expect(ingredientRow.getByRole("cell")).toHaveCount(3);
  await expect(
    ingredientRow.getByRole("cell", { name: "1", exact: true })
  ).toBeVisible();
  await expect(
    ingredientRow.getByRole("cell", {
      name: "Test E2E Item Relation Result Item",
      exact: true,
    })
  ).toBeVisible();
  await expect(ingredientRow.getByText("—", { exact: true })).toHaveCount(0);
  await expect(ingredientRow.getByText("Profession:")).toHaveCount(0);
  await expect(ingredientRow.getByText("Required level:")).toHaveCount(0);
  const ingredientRecipeLink = ingredientRow.getByRole("link", {
    name: "Test E2E Item Relation Consuming Recipe",
    exact: true,
  });
  await expect(ingredientRecipeLink).toHaveAttribute(
    "href",
    /^\/admin\/recipes\/.+\/edit$/
  );

  // Produced by: recipe name and yields; also both optional fields
  // absent on this fixture, so no detail line renders (two cells per
  // row: Recipe, Yields).
  const producedRow = page
    .getByRole("row")
    .filter({
      has: page.getByRole("cell", {
        name: "Test E2E Item Relation Producing Recipe",
        exact: true,
      }),
    });
  await expect(producedRow).toBeVisible();
  await expect(producedRow.getByRole("cell")).toHaveCount(2);
  await expect(
    producedRow.getByRole("cell", { name: "1", exact: true })
  ).toBeVisible();
  await expect(producedRow.getByText("—", { exact: true })).toHaveCount(0);
  await expect(producedRow.getByText("Profession:")).toHaveCount(0);
  await expect(producedRow.getByText("Required level:")).toHaveCount(0);

  // A second Produced by row WITH a Profession and Required level set
  // renders both as a labeled detail line beneath the recipe name —
  // proving presence, not just absence — while keeping the same two
  // cells per row.
  const producedWithMetaRow = page
    .getByRole("row")
    .filter({
      hasText: "Test E2E Item Relation Producing Recipe With Metadata",
    });
  await expect(producedWithMetaRow).toBeVisible();
  await expect(producedWithMetaRow.getByRole("cell")).toHaveCount(2);
  await expect(
    producedWithMetaRow.getByText("Profession: Smithing", { exact: true })
  ).toBeVisible();
  await expect(
    producedWithMetaRow.getByText("Required level: 7", { exact: true })
  ).toBeVisible();

  // The recipe link goes to the EXISTING Recipe admin edit route — no
  // inline editing lives on this tab.
  await ingredientRecipeLink.click();
  await expect(page).toHaveURL(/\/admin\/recipes\/.+\/edit$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Edit Recipe" })
  ).toBeVisible();
});

test("switching items while on the Used in Recipes tab preserves the tab and q", async ({
  page,
}) => {
  const ITEM_A = {
    name: "Test E2E Item Recipes Switch A",
    slug: "test-e2e-item-recipes-switch-a",
  };
  const ITEM_B = {
    name: "Test E2E Item Recipes Switch B",
    slug: "test-e2e-item-recipes-switch-b",
  };
  await createTemporaryItem(page, ITEM_A);
  await createTemporaryItem(page, ITEM_B);
  await createTemporaryRecipeProducingItem(ITEM_A.slug);

  // A shared, distinguishing query so only these two temporary items match.
  await page.goto("/admin/items");
  await page
    .getByRole("searchbox", { name: "Search items" })
    .fill("test e2e item recipes switch");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(recordRow(page, ITEM_A.name)).toBeVisible();
  await expect(recordRow(page, ITEM_B.name)).toBeVisible();

  await recordRow(page, ITEM_A.name).click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/items/${ITEM_A.slug}/edit\\?q=`)
  );

  await tabNav(page)
    .getByRole("link", { name: "Used in Recipes", exact: true })
    .click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/items/${ITEM_A.slug}/recipes\\?q=`)
  );
  await expect(recordRow(page, ITEM_A.name)).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(
    page.getByRole("cell", {
      name: "Test E2E Item Relation Producing Recipe",
      exact: true,
    })
  ).toBeVisible();

  // Switching records while ON the Used in Recipes tab opens the OTHER
  // item's Used in Recipes tab — not its General tab — with q intact.
  await recordRow(page, ITEM_B.name).click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/items/${ITEM_B.slug}/recipes\\?q=`)
  );
  await expect(
    page.getByRole("heading", { level: 1, name: ITEM_B.name, exact: true })
  ).toBeVisible();
  await expect(
    tabNav(page).getByRole("link", { name: "Used in Recipes", exact: true })
  ).toHaveAttribute("aria-current", "page");
  await expect(recordRow(page, ITEM_B.name)).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(recordRow(page, ITEM_A.name)).not.toHaveAttribute(
    "aria-current",
    "page"
  );
  // Item B has no recipe usage: a valid empty tab state, not an error.
  await expect(page.getByText("Not used in any recipes yet")).toBeVisible();
});

test("an item with no recipe usage shows a valid empty state", async ({
  page,
}) => {
  const ITEM = {
    name: "Test E2E Item Recipes Empty",
    slug: "test-e2e-item-recipes-empty",
  };
  await createTemporaryItem(page, ITEM);

  await page.goto(`/admin/items/${ITEM.slug}/recipes`);
  await expect(
    page.getByRole("heading", { level: 1, name: ITEM.name, exact: true })
  ).toBeVisible();
  await expect(page.getByText("Not used in any recipes yet")).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
});

test("General and Acquisition Sources remain real links from the Used in Recipes tab, and Metadata stays inert", async ({
  page,
}) => {
  const ITEM = {
    name: "Test E2E Item Recipes Nav",
    slug: "test-e2e-item-recipes-nav",
  };
  await createTemporaryItem(page, ITEM);

  await page.goto(`/admin/items/${ITEM.slug}/recipes`);
  await expect(
    tabNav(page).getByRole("link", { name: "Used in Recipes", exact: true })
  ).toHaveAttribute("aria-current", "page");
  await expect(tabNav(page).locator('[aria-current="page"]')).toHaveCount(1);

  await expect(
    tabNav(page).getByText("Metadata", { exact: true })
  ).toHaveAttribute("aria-disabled", "true");
  await expect(
    tabNav(page).getByRole("link", { name: "Metadata", exact: true })
  ).toHaveCount(0);

  await tabNav(page)
    .getByRole("link", { name: "General", exact: true })
    .click();
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
});

test("an unknown item slug fails safely on the recipes route", async ({
  page,
}) => {
  const response = await page.goto(
    "/admin/items/test-e2e-item-recipes-does-not-exist/recipes"
  );
  expect(response?.status()).toBe(404);
});

test("seeded fixtures are preserved and no test item or relation record remains", async () => {
  expect(await readFixtureCounts()).toEqual({
    categories: 5,
    professions: 10,
    items: 16,
    recipes: 8,
    recipeIngredients: 15,
  });
  expect(await countE2eTestItemRecords()).toBe(0);
});
