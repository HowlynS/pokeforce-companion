// Authenticated Item admin lifecycle against the REAL application and the
// isolated Supabase test project. Runs in the chromium-admin project with
// the storage state saved by auth.setup.ts. All temporary Item rows use
// the test-e2e-item slug prefix, the temporary Recipe/RecipeIngredient
// rows for the blocked-deletion tests use the separate
// test-e2e-item-relation- prefix, and everything is removed by
// guard-first, prefix-scoped cleanup in beforeAll/afterEach/afterAll — a
// mid-test failure can never strand a row. Seeded fixtures are read but
// never modified: seeded Categories are only ASSIGNED to temporary Items,
// the duplicate test only borrows a seeded NAME, and the relation tests
// link temporary Recipes only to temporary Items. No image file is ever
// provided: the optional image input stays empty, so no Storage object is
// written or deleted.

import { expect, test, type Page } from "@playwright/test";
import {
  countE2eTestItemRecords,
  createTemporaryIngredientReferenceToItem,
  createTemporaryRecipeProducingItem,
  deleteE2eTestItemRecords,
  readFixtureCounts,
  removeTemporaryItemRelationRecords,
} from "./helpers/database-cleanup";

const INITIAL = {
  name: "Test E2E Item",
  slug: "test-e2e-item",
  description: "Created by the authenticated Item browser test.",
  category: "Materials",
  rarity: "Common",
  baseValue: "5",
} as const;

const EDITED = {
  name: "Test E2E Item Updated",
  slug: "test-e2e-item-updated",
  description: "Updated by the authenticated Item browser test.",
  category: "Tools",
  rarity: "Rare",
  baseValue: "12",
} as const;

// Separate temporary Items for the two relation-blocked deletion tests, so
// neither depends on the lifecycle test's data or on each other.
const BLOCKED_RESULT = {
  name: "Test E2E Item Blocked Result",
  slug: "test-e2e-item-blocked-result",
} as const;

const BLOCKED_INGREDIENT = {
  name: "Test E2E Item Blocked Ingredient",
  slug: "test-e2e-item-blocked-ingredient",
} as const;

// Browser error hygiene: any uncaught page error fails the test. Serial
// single-worker execution makes this module-level state safe.
let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(async () => {
  // Defensive prefix-scoped cleanup even when a test failed mid-lifecycle:
  // temporary RecipeIngredient/Recipe rows first, then test Items.
  await deleteE2eTestItemRecords();
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

test.beforeAll(async () => {
  // Remove stale rows from interrupted earlier runs; the guard inside the
  // helper throws here if the environment is not the verified test project.
  await deleteE2eTestItemRecords();
  expect(await countE2eTestItemRecords()).toBe(0);
});

test.afterAll(async () => {
  const remaining = await deleteE2eTestItemRecords();
  // afterEach should already have removed everything — fail loudly if not.
  expect(remaining).toBe(0);
});

// The public item card renders its title as an h3 inside the card link.
function cardLink(page: Page, name: string) {
  return page
    .getByRole("link")
    .filter({ has: page.getByRole("heading", { level: 3, name, exact: true }) });
}

// The admin table row for an item, located by its exact Name cell.
function adminRow(page: Page, name: string) {
  return page
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name, exact: true }) });
}

// Fills the create form on /admin/items (the page must already be open)
// with name, slug, and description only, and submits it. The optional
// image input is deliberately left untouched: creation must succeed with
// no image.
async function createMinimalItemThroughForm(
  page: Page,
  data: { name: string; slug: string }
) {
  await page.getByLabel("Name", { exact: true }).fill(data.name);
  await page.getByLabel(/^Slug/).fill(data.slug);
  await page.getByRole("button", { name: "Create Item", exact: true }).click();

  await expect(page).toHaveURL("/admin/items?success=created");
  await expect(page.getByRole("status")).toHaveText("Item created.");
  await expect(
    page.getByRole("cell", { name: data.name, exact: true })
  ).toBeVisible();
}

test("authenticated item admin access uses the saved storage state", async ({
  page,
}) => {
  await page.goto("/admin/items");

  // No redirect to /login: the saved state authenticates the request.
  await expect(page).toHaveURL("/admin/items");
  await expect(
    page.getByRole("heading", { level: 2, name: "Item Management" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create Item", exact: true })
  ).toBeVisible();

  // Seeded items appear in the admin table.
  await expect(
    page.getByRole("cell", { name: "Iron Ore", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Iron Sword", exact: true })
  ).toBeVisible();
});

test("item create/edit/delete lifecycle through the real admin UI", async ({
  page,
}) => {
  // --- Create (all fields, optional image input left empty) ------------
  await page.goto("/admin");
  await page.getByRole("link", { name: /Manage Items/ }).click();
  await expect(page).toHaveURL("/admin/items");
  await expect(
    page.getByRole("heading", { level: 2, name: "Item Management" })
  ).toBeVisible();

  await page.getByLabel("Name", { exact: true }).fill(INITIAL.name);
  await page.getByLabel(/^Slug/).fill(INITIAL.slug);
  await page.getByLabel(/^Description/).fill(INITIAL.description);
  // getByLabel cannot target the select exactly (a wrapping label's text
  // includes the option texts), so the accessible role/name is used.
  await page
    .getByRole("combobox", { name: "Category", exact: true })
    .selectOption({ label: INITIAL.category });
  await page.getByLabel(/^Rarity/).fill(INITIAL.rarity);
  await page.getByLabel("Tradeable").check();
  await page.getByLabel(/^Base value/).fill(INITIAL.baseValue);
  await page.getByRole("button", { name: "Create Item", exact: true }).click();

  await expect(page).toHaveURL("/admin/items?success=created");
  await expect(page.getByRole("status")).toHaveText("Item created.");

  // The admin row shows every submitted field, including the assigned
  // seeded Category.
  const createdRow = adminRow(page, INITIAL.name);
  await expect(createdRow).toBeVisible();
  await expect(
    createdRow.getByRole("cell", { name: INITIAL.slug, exact: true })
  ).toBeVisible();
  await expect(
    createdRow.getByRole("cell", { name: INITIAL.category, exact: true })
  ).toBeVisible();
  await expect(
    createdRow.getByRole("cell", { name: INITIAL.rarity, exact: true })
  ).toBeVisible();
  await expect(
    createdRow.getByRole("cell", { name: "Yes", exact: true })
  ).toBeVisible();
  await expect(
    createdRow.getByRole("cell", { name: INITIAL.baseValue, exact: true })
  ).toBeVisible();

  // Public detail page renders every field the UI shows for an item,
  // plus the no-image fallback and both empty recipe-relation states.
  await page.goto(`/items/${INITIAL.slug}`);
  await expect(
    page.getByRole("heading", { level: 2, name: INITIAL.name, exact: true })
  ).toBeVisible();
  await expect(page.getByText(INITIAL.description)).toBeVisible();
  await expect(
    page.getByText(
      `Category: ${INITIAL.category} · Rarity: ${INITIAL.rarity} · Tradeable: Yes · Base value: ${INITIAL.baseValue}`
    )
  ).toBeVisible();
  await expect(page.getByText("No image available")).toBeVisible();
  await expect(page.getByText("No recipes produce this item")).toBeVisible();
  await expect(page.getByText("Not used in any recipes")).toBeVisible();

  // Public list card appears and points at the detail route.
  await page.goto("/items");
  const createdCard = cardLink(page, INITIAL.name);
  await expect(createdCard).toBeVisible();
  await expect(createdCard).toHaveAttribute("href", `/items/${INITIAL.slug}`);

  // --- Edit (name, slug, description, Category reassignment, rarity,
  // --- tradeable, base value; image untouched) --------------------------
  await page.goto("/admin/items");
  await adminRow(page, INITIAL.name).getByRole("link", { name: "Edit" }).click();
  await expect(page).toHaveURL(`/admin/items/${INITIAL.slug}/edit`);
  await expect(
    page.getByRole("heading", { level: 2, name: "Edit Item" })
  ).toBeVisible();
  await expect(
    page.getByText(`Update details for "${INITIAL.name}".`)
  ).toBeVisible();

  await page.getByLabel("Name", { exact: true }).fill(EDITED.name);
  await page.getByLabel("Slug", { exact: true }).fill(EDITED.slug);
  await page.getByLabel(/^Description/).fill(EDITED.description);
  await page
    .getByRole("combobox", { name: "Category", exact: true })
    .selectOption({ label: EDITED.category });
  await page.getByLabel(/^Rarity/).fill(EDITED.rarity);
  await page.getByLabel("Tradeable").uncheck();
  await page.getByLabel(/^Base value/).fill(EDITED.baseValue);
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();

  await expect(page).toHaveURL("/admin/items?success=updated");
  await expect(page.getByRole("status")).toHaveText("Item updated.");

  const editedRow = adminRow(page, EDITED.name);
  await expect(editedRow).toBeVisible();
  await expect(
    editedRow.getByRole("cell", { name: EDITED.category, exact: true })
  ).toBeVisible();
  await expect(
    editedRow.getByRole("cell", { name: EDITED.rarity, exact: true })
  ).toBeVisible();
  await expect(
    editedRow.getByRole("cell", { name: "No", exact: true })
  ).toBeVisible();

  // The slug changed, so the original public route must be gone...
  const staleResponse = await page.goto(`/items/${INITIAL.slug}`);
  expect(staleResponse?.status()).toBe(404);

  // ...and the new public detail page renders the edited values, including
  // the reassigned Category.
  await page.goto(`/items/${EDITED.slug}`);
  await expect(
    page.getByRole("heading", { level: 2, name: EDITED.name, exact: true })
  ).toBeVisible();
  await expect(page.getByText(EDITED.description)).toBeVisible();
  await expect(
    page.getByText(
      `Category: ${EDITED.category} · Rarity: ${EDITED.rarity} · Tradeable: No · Base value: ${EDITED.baseValue}`
    )
  ).toBeVisible();

  await page.goto("/items");
  const editedCard = cardLink(page, EDITED.name);
  await expect(editedCard).toBeVisible();
  await expect(editedCard).toHaveAttribute("href", `/items/${EDITED.slug}`);

  // --- Delete -----------------------------------------------------------
  await page.goto("/admin/items");
  await adminRow(page, EDITED.name).getByRole("link", { name: "Delete" }).click();
  await expect(page).toHaveURL(`/admin/items/${EDITED.slug}/delete`);
  await expect(
    page.getByRole("heading", { level: 2, name: "Delete Item" })
  ).toBeVisible();
  // The confirmation identifies exactly this item by name, slug, Category,
  // and both recipe-reference counts.
  await expect(page.getByText(`(${EDITED.slug})`)).toBeVisible();
  await expect(page.getByText(`Category: ${EDITED.category}`)).toBeVisible();
  await expect(page.getByText("Used as a recipe result: 0")).toBeVisible();
  await expect(page.getByText("Used as a recipe ingredient: 0")).toBeVisible();

  await page
    .getByRole("button", { name: "Delete Permanently", exact: true })
    .click();

  await expect(page).toHaveURL("/admin/items?success=deleted");
  await expect(page.getByRole("status")).toHaveText("Item deleted.");
  await expect(
    page.getByRole("cell", { name: EDITED.name, exact: true })
  ).toHaveCount(0);

  // Gone from the public site as well.
  const deletedResponse = await page.goto(`/items/${EDITED.slug}`);
  expect(deletedResponse?.status()).toBe(404);

  await page.goto("/items");
  await expect(cardLink(page, EDITED.name)).toHaveCount(0);
});

test("creating an item with a seeded name is rejected server-side", async ({
  page,
}) => {
  await page.goto("/admin/items");

  // Seeded name "Iron Ore" in different casing with surrounding
  // whitespace: the server trims the name and its duplicate check is
  // case-insensitive, so this must be rejected. The slug carries the test
  // prefix so cleanup would catch the row if creation ever slipped through.
  await page.getByLabel("Name", { exact: true }).fill("  iron ore  ");
  await page.getByLabel(/^Slug/).fill("test-e2e-item-duplicate");
  await page.getByRole("button", { name: "Create Item", exact: true }).click();

  await expect(page).toHaveURL("/admin/items?error=duplicate_name");
  // Next.js injects a hidden route-announcer div that also has role=alert,
  // so the application's alert is located by its exact readable text.
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "An item with that name already exists." })
  ).toBeVisible();

  // Back on a safe form state, and nothing was written.
  await expect(
    page.getByRole("button", { name: "Create Item", exact: true })
  ).toBeVisible();
  expect(await countE2eTestItemRecords()).toBe(0);
});

test("deletion is blocked while a recipe produces the item", async ({
  page,
}) => {
  // The temporary Item is created through the real admin UI; only the
  // producing Recipe is set up through the guarded database helper,
  // because Recipe admin browser workflows are out of scope for this
  // suite.
  await page.goto("/admin/items");
  await createMinimalItemThroughForm(page, BLOCKED_RESULT);

  // Open the confirmation page while the item is still unreferenced: both
  // counts are zero and the delete button is offered.
  await page.goto(`/admin/items/${BLOCKED_RESULT.slug}/delete`);
  await expect(
    page.getByRole("heading", { level: 2, name: "Delete Item" })
  ).toBeVisible();
  await expect(page.getByText("Used as a recipe result: 0")).toBeVisible();
  await expect(page.getByText("Used as a recipe ingredient: 0")).toBeVisible();
  const deleteButton = page.getByRole("button", {
    name: "Delete Permanently",
    exact: true,
  });
  await expect(deleteButton).toBeVisible();

  // Make the item a Recipe RESULT after the page loaded, then confirm
  // deletion: the server action re-checks both reference counts
  // immediately before deleting, so the stale confirmation page must not
  // slip through.
  await createTemporaryRecipeProducingItem(BLOCKED_RESULT.slug);
  await deleteButton.click();

  await expect(page).toHaveURL(
    `/admin/items/${BLOCKED_RESULT.slug}/delete?error=linked_recipes`
  );
  await expect(
    page.getByRole("alert").filter({
      hasText:
        "This item cannot be deleted because it is used as the result of 1 recipe.",
    })
  ).toBeVisible();

  // The re-rendered confirmation page also blocks statically: the count is
  // shown, the warning explains the rule, and the delete button is gone.
  await expect(page.getByText("Used as a recipe result: 1")).toBeVisible();
  await expect(
    page.getByText("Remove or reassign those recipe references first.")
  ).toBeVisible();
  await expect(deleteButton).toHaveCount(0);

  // The item survived, in the admin list and on the public site, where the
  // temporary recipe is rendered through the real relation.
  await page.goto("/admin/items");
  await expect(
    page.getByRole("cell", { name: BLOCKED_RESULT.name, exact: true })
  ).toBeVisible();
  await page.goto(`/items/${BLOCKED_RESULT.slug}`);
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: BLOCKED_RESULT.name,
      exact: true,
    })
  ).toBeVisible();
  await expect(
    cardLink(page, "Test E2E Item Relation Producing Recipe")
  ).toBeVisible();

  // Safely remove ONLY the temporary Recipe, then delete the item through
  // the real confirmation flow.
  expect(await removeTemporaryItemRelationRecords()).toBe(1);

  await page.goto(`/admin/items/${BLOCKED_RESULT.slug}/delete`);
  await expect(page.getByText("Used as a recipe result: 0")).toBeVisible();
  await page
    .getByRole("button", { name: "Delete Permanently", exact: true })
    .click();

  await expect(page).toHaveURL("/admin/items?success=deleted");
  await expect(page.getByRole("status")).toHaveText("Item deleted.");
  await expect(
    page.getByRole("cell", { name: BLOCKED_RESULT.name, exact: true })
  ).toHaveCount(0);

  const deletedResponse = await page.goto(`/items/${BLOCKED_RESULT.slug}`);
  expect(deletedResponse?.status()).toBe(404);
});

test("deletion is blocked while the item is a recipe ingredient", async ({
  page,
}) => {
  await page.goto("/admin/items");
  await createMinimalItemThroughForm(page, BLOCKED_INGREDIENT);

  await page.goto(`/admin/items/${BLOCKED_INGREDIENT.slug}/delete`);
  await expect(page.getByText("Used as a recipe ingredient: 0")).toBeVisible();
  const deleteButton = page.getByRole("button", {
    name: "Delete Permanently",
    exact: true,
  });
  await expect(deleteButton).toBeVisible();

  // Make the item a Recipe INGREDIENT (helper result Item + Recipe +
  // RecipeIngredient) after the page loaded, then confirm deletion: the
  // action's re-check must block on the ingredient path as well.
  await createTemporaryIngredientReferenceToItem(BLOCKED_INGREDIENT.slug);
  await deleteButton.click();

  await expect(page).toHaveURL(
    `/admin/items/${BLOCKED_INGREDIENT.slug}/delete?error=linked_recipes`
  );
  await expect(
    page.getByRole("alert").filter({
      hasText:
        "This item cannot be deleted because it is used as an ingredient in 1 recipe.",
    })
  ).toBeVisible();

  // Static block on the re-render, with the ingredient count shown.
  await expect(page.getByText("Used as a recipe ingredient: 1")).toBeVisible();
  await expect(
    page.getByText("Remove or reassign those recipe references first.")
  ).toBeVisible();
  await expect(deleteButton).toHaveCount(0);

  // The item survived; its public page renders the consuming recipe
  // through the real ingredient relation.
  await page.goto(`/items/${BLOCKED_INGREDIENT.slug}`);
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: BLOCKED_INGREDIENT.name,
      exact: true,
    })
  ).toBeVisible();
  await expect(
    cardLink(page, "Test E2E Item Relation Consuming Recipe")
  ).toBeVisible();

  // Safely remove ONLY the temporary relation rows (RecipeIngredient,
  // Recipe, and helper result Item), then delete through the real flow.
  expect(await removeTemporaryItemRelationRecords()).toBe(3);

  await page.goto(`/admin/items/${BLOCKED_INGREDIENT.slug}/delete`);
  await expect(page.getByText("Used as a recipe ingredient: 0")).toBeVisible();
  await page
    .getByRole("button", { name: "Delete Permanently", exact: true })
    .click();

  await expect(page).toHaveURL("/admin/items?success=deleted");
  await expect(page.getByRole("status")).toHaveText("Item deleted.");
  await expect(
    page.getByRole("cell", { name: BLOCKED_INGREDIENT.name, exact: true })
  ).toHaveCount(0);

  const deletedResponse = await page.goto(
    `/items/${BLOCKED_INGREDIENT.slug}`
  );
  expect(deletedResponse?.status()).toBe(404);
});

test("seeded fixtures are preserved and no test item remains", async () => {
  expect(await readFixtureCounts()).toEqual({
    categories: 5,
    professions: 2,
    items: 16,
    recipes: 8,
    recipeIngredients: 15,
  });
  expect(await countE2eTestItemRecords()).toBe(0);
});
