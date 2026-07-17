// Authenticated Recipe admin CRUD and validation coverage against the REAL
// application and the isolated Supabase test project. Runs in the
// chromium-admin project with the storage state saved by auth.setup.ts.
// All temporary Recipe rows use the test-e2e-recipe slug prefix and are
// removed by guard-first, prefix-scoped cleanup in
// beforeAll/afterEach/afterAll — a mid-test failure can never strand a
// row. Seeded Items and Professions are only REFERENCED as relations of
// temporary Recipes and never modified; deleting a temporary Recipe
// cascades only its own RecipeIngredient rows. No image file is ever
// provided: the optional image input stays empty, so no Storage object is
// written or deleted.

import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  countE2eTestRecipeRecords,
  createTemporaryRecipeWithSixIngredients,
  deleteE2eTestRecipeRecords,
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
  // Defensive prefix-scoped cleanup even when a test failed mid-lifecycle:
  // RecipeIngredient rows of test Recipes first, then the Recipes.
  await deleteE2eTestRecipeRecords();
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

test.beforeAll(async () => {
  // Remove stale rows from interrupted earlier runs; the guard inside the
  // helper throws here if the environment is not the verified test project.
  await deleteE2eTestRecipeRecords();
  expect(await countE2eTestRecipeRecords()).toBe(0);
});

test.afterAll(async () => {
  const remaining = await deleteE2eTestRecipeRecords();
  // afterEach should already have removed everything — fail loudly if not.
  expect(remaining).toBe(0);
});

// The public recipe/ingredient card renders its title as an h3 inside the
// card link.
function cardLink(page: Page, name: string) {
  return page
    .getByRole("link")
    .filter({ has: page.getByRole("heading", { level: 3, name, exact: true }) });
}

// One row of the shared Recipe record list (Slice 9C.1), located by its
// exact primary text inside the list's navigation landmark. The row link
// itself opens the edit route — there is no separate per-row Edit/Delete
// action any more (Delete is reached from the edit page's toolbar).
function recordRow(page: Page, name: string) {
  return page
    .getByRole("navigation", { name: "Recipes records" })
    .getByRole("link")
    .filter({ has: page.getByText(name, { exact: true }) });
}

// The five fixed ingredient rows live inside one fieldset; its legend
// gives the group its accessible name. The selects and quantity inputs
// inside it carry no individual labels, so they are addressed by role and
// position within the group.
function ingredientGroup(page: Page) {
  return page.getByRole("group", {
    name: "Ingredients (fill at least one row)",
  });
}

function ingredientSelect(page: Page, row: number) {
  return ingredientGroup(page).getByRole("combobox").nth(row);
}

function ingredientQuantity(page: Page, row: number) {
  return ingredientGroup(page).getByRole("spinbutton").nth(row);
}

// Reads the visible text of a <select>'s currently selected option, for
// prefill assertions where option values (database ids) are unknown.
async function selectedOptionLabel(select: Locator): Promise<string> {
  return select.evaluate(
    (el) =>
      (el as HTMLSelectElement).selectedOptions[0]?.textContent?.trim() ?? ""
  );
}

type RecipeFormData = {
  name: string;
  slug: string;
  resultingItem: string;
  resultingQuantity?: string;
  profession?: string;
  requiredLevel?: string;
  ingredients: { item: string; quantity: string }[];
};

// Fills the create form on /admin/recipes/new (the page must already be
// open — the dedicated creation route since Slice 9C.1) and submits it.
// The optional image input is deliberately left untouched: creation must
// succeed with no image.
async function createRecipeThroughForm(page: Page, data: RecipeFormData) {
  await page.getByLabel("Name", { exact: true }).fill(data.name);
  await page.getByLabel(/^Slug/).fill(data.slug);
  await page
    .getByRole("combobox", { name: "Resulting item", exact: true })
    .selectOption({ label: data.resultingItem });
  if (data.resultingQuantity) {
    await page
      .getByLabel("Resulting quantity", { exact: true })
      .fill(data.resultingQuantity);
  }
  if (data.profession) {
    await page
      .getByRole("combobox", { name: "Profession", exact: true })
      .selectOption({ label: data.profession });
  }
  if (data.requiredLevel) {
    await page.getByLabel(/^Required level/).fill(data.requiredLevel);
  }
  for (const [index, ingredient] of data.ingredients.entries()) {
    await ingredientSelect(page, index).selectOption({
      label: ingredient.item,
    });
    await ingredientQuantity(page, index).fill(ingredient.quantity);
  }
  await page
    .getByRole("button", { name: "Create Recipe", exact: true })
    .click();

  await expect(page).toHaveURL("/admin/recipes?success=created");
  await expect(page.getByRole("status")).toHaveText("Recipe created.");
  await expect(recordRow(page, data.name)).toBeVisible();
}

test("authenticated recipe admin access uses the saved storage state", async ({
  page,
}) => {
  await page.goto("/admin/recipes");

  // No redirect to /login: the saved state authenticates the request.
  await expect(page).toHaveURL("/admin/recipes");
  await expect(
    page.getByRole("heading", { level: 1, name: "Recipe Management" })
  ).toBeVisible();

  // The workspace landing state: the record list with its create link —
  // the embedded creation form is gone from this page (Slice 9C.1,
  // following the Item workspace's Slice 9B.4 precedent).
  await expect(
    page.getByRole("link", { name: "+ New recipe", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create Recipe", exact: true })
  ).toHaveCount(0);
  await expect(page.getByLabel("Name", { exact: true })).toHaveCount(0);

  // Seeded recipes appear as record-list rows.
  await expect(recordRow(page, "Iron Sword")).toBeVisible();
  await expect(recordRow(page, "Minor Healing Tonic")).toBeVisible();
});

test("Create recipe opens the dedicated creation route", async ({ page }) => {
  await page.goto("/admin/recipes");
  await page.getByRole("link", { name: "+ New recipe", exact: true }).click();

  await expect(page).toHaveURL("/admin/recipes/new");
  await expect(
    page.getByRole("heading", { level: 1, name: "Create Recipe" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create Recipe", exact: true })
  ).toBeVisible();
});

test("recipe creation renders result, profession, and ingredients publicly", async ({
  page,
}) => {
  await page.goto("/admin");
  await page.getByRole("link", { name: /Manage Recipes/ }).click();
  await expect(page).toHaveURL("/admin/recipes");
  await expect(
    page.getByRole("heading", { level: 1, name: "Recipe Management" })
  ).toBeVisible();

  await page.getByRole("link", { name: "+ New recipe", exact: true }).click();
  await expect(page).toHaveURL("/admin/recipes/new");

  await createRecipeThroughForm(page, {
    name: "Test E2E Recipe",
    slug: "test-e2e-recipe",
    resultingItem: "Iron Ingot",
    resultingQuantity: "2",
    profession: "Smithing",
    requiredLevel: "3",
    ingredients: [
      { item: "Iron Ore", quantity: "2" },
      { item: "Charcoal", quantity: "1" },
    ],
  });

  // The record-list row shows the resulting item as concise secondary
  // context; the full submitted detail (slug, quantity, profession,
  // ingredients) is verified below via the public pages, which render
  // every field.
  const createdRow = recordRow(page, "Test E2E Recipe");
  await expect(createdRow).toBeVisible();
  await expect(createdRow.getByText("Iron Ingot", { exact: true })).toBeVisible();

  // Public list card appears with the full summary (ingredients are
  // rendered in item-name order: Charcoal before Iron Ore).
  await page.goto("/recipes");
  const createdCard = cardLink(page, "Test E2E Recipe");
  await expect(createdCard).toBeVisible();
  await expect(createdCard).toHaveAttribute("href", "/recipes/test-e2e-recipe");
  await expect(
    createdCard.getByText(
      "Crafts 2x Iron Ingot (Components) · Profession: Smithing · Required level: 3 · Requires: 1x Charcoal, 2x Iron Ore"
    )
  ).toBeVisible();

  // Public detail page shows the name, resulting item, profession, both
  // ingredients with quantities, and the no-image fallback.
  await page.goto("/recipes/test-e2e-recipe");
  await expect(
    page.getByRole("heading", { level: 1, name: "Test E2E Recipe", exact: true })
  ).toBeVisible();
  await expect(
    cardLink(page, "Result: Iron Ingot").getByText(
      "Yields 2x Iron Ingot (Components)."
    )
  ).toBeVisible();
  await expect(
    page.getByText("Profession: Smithing · Required level: 3")
  ).toBeVisible();
  await expect(
    cardLink(page, "Charcoal").getByText("1x required.")
  ).toBeVisible();
  await expect(
    cardLink(page, "Iron Ore").getByText("2x required.")
  ).toBeVisible();
  await expect(page.getByText("No image available")).toBeVisible();
});

test("recipe editing prefills ingredients and applies the transactional update", async ({
  page,
}) => {
  await page.goto("/admin/recipes/new");
  await createRecipeThroughForm(page, {
    name: "Test E2E Recipe",
    slug: "test-e2e-recipe",
    resultingItem: "Iron Ingot",
    profession: "Smithing",
    requiredLevel: "3",
    ingredients: [
      { item: "Iron Ore", quantity: "2" },
      { item: "Charcoal", quantity: "1" },
    ],
  });

  // --- Open the edit form and verify every prefilled value --------------
  // Quick switching: the record-list row itself is the edit link, and the
  // open record is marked selected (aria-current) in the list.
  await recordRow(page, "Test E2E Recipe").click();
  await expect(page).toHaveURL("/admin/recipes/test-e2e-recipe/edit");
  await expect(recordRow(page, "Test E2E Recipe")).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(
    page.getByRole("heading", { level: 1, name: "Edit Recipe" })
  ).toBeVisible();
  await expect(
    page.getByText(`Update details for "Test E2E Recipe".`)
  ).toBeVisible();

  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Test E2E Recipe"
  );
  await expect(page.getByLabel("Slug", { exact: true })).toHaveValue(
    "test-e2e-recipe"
  );
  expect(
    await selectedOptionLabel(
      page.getByRole("combobox", { name: "Resulting item", exact: true })
    )
  ).toBe("Iron Ingot");
  await expect(page.getByLabel("Resulting quantity", { exact: true })).toHaveValue(
    "1"
  );
  expect(
    await selectedOptionLabel(
      page.getByRole("combobox", { name: "Profession", exact: true })
    )
  ).toBe("Smithing");
  await expect(page.getByLabel(/^Required level/)).toHaveValue("3");

  // Ingredient rows prefill in item-name order: Charcoal, then Iron Ore,
  // then three untouched empty rows.
  expect(await selectedOptionLabel(ingredientSelect(page, 0))).toBe("Charcoal");
  await expect(ingredientQuantity(page, 0)).toHaveValue("1");
  expect(await selectedOptionLabel(ingredientSelect(page, 1))).toBe("Iron Ore");
  await expect(ingredientQuantity(page, 1)).toHaveValue("2");
  for (const row of [2, 3, 4]) {
    expect(await selectedOptionLabel(ingredientSelect(page, row))).toBe(
      "No ingredient"
    );
    await expect(ingredientQuantity(page, row)).toHaveValue("");
  }

  // --- Change name, slug, result, profession (to none), level, and both
  // --- ingredient rows; image untouched ---------------------------------
  await page.getByLabel("Name", { exact: true }).fill("Test E2E Recipe Updated");
  await page.getByLabel("Slug", { exact: true }).fill("test-e2e-recipe-updated");
  await page
    .getByRole("combobox", { name: "Resulting item", exact: true })
    .selectOption({ label: "Copper Ingot" });
  await page.getByLabel("Resulting quantity", { exact: true }).fill("3");
  // Clearing the Profession exercises the optional relation: the empty
  // "No profession" option stores null.
  await page
    .getByRole("combobox", { name: "Profession", exact: true })
    .selectOption({ label: "No profession" });
  await page.getByLabel(/^Required level/).fill("");
  await ingredientSelect(page, 0).selectOption({ label: "Wood" });
  await ingredientQuantity(page, 0).fill("4");
  await ingredientSelect(page, 1).selectOption({ label: "Spring Water" });
  await ingredientQuantity(page, 1).fill("5");
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();

  await expect(page).toHaveURL("/admin/recipes?success=updated");
  await expect(page.getByRole("status")).toHaveText("Recipe updated.");

  // The list reflects the rename and the reassigned resulting item; the
  // flipped profession and other fields are asserted on the public page
  // below.
  const editedRow = recordRow(page, "Test E2E Recipe Updated");
  await expect(editedRow).toBeVisible();
  await expect(
    editedRow.getByText("Copper Ingot", { exact: true })
  ).toBeVisible();

  // The slug changed, so the original public route must be gone...
  const staleResponse = await page.goto("/recipes/test-e2e-recipe");
  expect(staleResponse?.status()).toBe(404);

  // ...and the new public detail page renders the fully replaced data.
  await page.goto("/recipes/test-e2e-recipe-updated");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Test E2E Recipe Updated",
      exact: true,
    })
  ).toBeVisible();
  await expect(
    cardLink(page, "Result: Copper Ingot").getByText(
      "Yields 3x Copper Ingot (Components)."
    )
  ).toBeVisible();
  // No profession and no required level: the details card shows only the
  // no-profession fallback.
  await expect(page.getByText("Profession: None", { exact: true })).toBeVisible();
  await expect(
    cardLink(page, "Spring Water").getByText("5x required.")
  ).toBeVisible();
  await expect(cardLink(page, "Wood").getByText("4x required.")).toBeVisible();
  // The replaced ingredients are gone.
  await expect(cardLink(page, "Charcoal")).toHaveCount(0);
  await expect(cardLink(page, "Iron Ore")).toHaveCount(0);
});

test("incomplete ingredient pairs are rejected in both directions", async ({
  page,
}) => {
  await page.goto("/admin/recipes/new");

  // Item selected but quantity left empty.
  await page.getByLabel("Name", { exact: true }).fill("Test E2E Recipe Incomplete");
  await page.getByLabel(/^Slug/).fill("test-e2e-recipe-incomplete");
  await page
    .getByRole("combobox", { name: "Resulting item", exact: true })
    .selectOption({ label: "Iron Ingot" });
  await ingredientSelect(page, 0).selectOption({ label: "Iron Ore" });
  await page
    .getByRole("button", { name: "Create Recipe", exact: true })
    .click();

  await expect(page).toHaveURL("/admin/recipes/new?error=incomplete_ingredient");
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Each ingredient row needs both an item and a quantity." })
  ).toBeVisible();

  // Quantity entered but no item selected (the redirect re-rendered a
  // fresh form, so every field is filled again).
  await page.getByLabel("Name", { exact: true }).fill("Test E2E Recipe Incomplete");
  await page.getByLabel(/^Slug/).fill("test-e2e-recipe-incomplete");
  await page
    .getByRole("combobox", { name: "Resulting item", exact: true })
    .selectOption({ label: "Iron Ingot" });
  await ingredientQuantity(page, 0).fill("2");
  await page
    .getByRole("button", { name: "Create Recipe", exact: true })
    .click();

  await expect(page).toHaveURL("/admin/recipes/new?error=incomplete_ingredient");
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Each ingredient row needs both an item and a quantity." })
  ).toBeVisible();

  // Neither submission wrote anything.
  expect(await countE2eTestRecipeRecords()).toBe(0);
});

test("ingredient quantities are guarded by browser-native validation with no upper bound", async ({
  page,
}) => {
  await page.goto("/admin/recipes/new");

  // A complete form except for the quantity under test, so the quantity
  // input is the only invalid control.
  await page.getByLabel("Name", { exact: true }).fill("Test E2E Recipe Max Quantity");
  await page.getByLabel(/^Slug/).fill("test-e2e-recipe-max-quantity");
  await page
    .getByRole("combobox", { name: "Resulting item", exact: true })
    .selectOption({ label: "Iron Ingot" });
  await ingredientSelect(page, 0).selectOption({ label: "Iron Ore" });
  const quantity = ingredientQuantity(page, 0);

  // Zero and negative values violate min=1; a decimal violates step=1. In
  // each case the browser refuses to submit, so the server-side
  // invalid_quantity path is unreachable through the real UI.
  await quantity.fill("0");
  expect(
    await quantity.evaluate((el) => (el as HTMLInputElement).validity.rangeUnderflow)
  ).toBe(true);
  await page.getByRole("button", { name: "Create Recipe", exact: true }).click();
  await expect(page).toHaveURL("/admin/recipes/new");

  await quantity.fill("-2");
  expect(
    await quantity.evaluate((el) => (el as HTMLInputElement).validity.rangeUnderflow)
  ).toBe(true);
  await page.getByRole("button", { name: "Create Recipe", exact: true }).click();
  await expect(page).toHaveURL("/admin/recipes/new");

  await quantity.fill("1.5");
  expect(
    await quantity.evaluate((el) => (el as HTMLInputElement).validity.stepMismatch)
  ).toBe(true);
  await page.getByRole("button", { name: "Create Recipe", exact: true }).click();
  await expect(page).toHaveURL("/admin/recipes/new");

  // Nothing was written by the blocked submissions.
  expect(await countE2eTestRecipeRecords()).toBe(0);

  // The repository defines no maximum quantity (min=1 and step=1 only, and
  // the server checks only for a positive integer), so a large value such
  // as 9999 is an ordinary valid quantity.
  await quantity.fill("9999");
  expect(
    await quantity.evaluate((el) => (el as HTMLInputElement).validity.valid)
  ).toBe(true);
  await page.getByRole("button", { name: "Create Recipe", exact: true }).click();

  await expect(page).toHaveURL("/admin/recipes?success=created");
  await expect(page.getByRole("status")).toHaveText("Recipe created.");

  await page.goto("/recipes/test-e2e-recipe-max-quantity");
  await expect(
    cardLink(page, "Iron Ore").getByText("9999x required.")
  ).toBeVisible();
});

test("selecting the same ingredient twice is rejected server-side", async ({
  page,
}) => {
  await page.goto("/admin/recipes/new");

  await page.getByLabel("Name", { exact: true }).fill("Test E2E Recipe Duplicate");
  await page.getByLabel(/^Slug/).fill("test-e2e-recipe-duplicate-ingredient");
  await page
    .getByRole("combobox", { name: "Resulting item", exact: true })
    .selectOption({ label: "Iron Ingot" });
  await ingredientSelect(page, 0).selectOption({ label: "Iron Ore" });
  await ingredientQuantity(page, 0).fill("1");
  await ingredientSelect(page, 1).selectOption({ label: "Iron Ore" });
  await ingredientQuantity(page, 1).fill("2");
  await page
    .getByRole("button", { name: "Create Recipe", exact: true })
    .click();

  await expect(page).toHaveURL("/admin/recipes/new?error=duplicate_ingredient");
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Each ingredient can only be added once." })
  ).toBeVisible();

  // No Recipe and no partial RecipeIngredient rows were written.
  expect(await countE2eTestRecipeRecords()).toBe(0);
  expect((await readFixtureCounts()).recipeIngredients).toBe(15);
});

test("the form supports exactly five ingredient rows and guards larger recipes", async ({
  page,
}) => {
  await page.goto("/admin/recipes/new");

  // All five fixed rows accept unique items with valid quantities.
  await expect(ingredientGroup(page).getByRole("combobox")).toHaveCount(5);
  await createRecipeThroughForm(page, {
    name: "Test E2E Recipe Five",
    slug: "test-e2e-recipe-five",
    resultingItem: "Whetstone",
    ingredients: [
      { item: "Charcoal", quantity: "1" },
      { item: "Copper Ore", quantity: "2" },
      { item: "Herb Leaf", quantity: "3" },
      { item: "Iron Ore", quantity: "4" },
      { item: "Wood", quantity: "5" },
    ],
  });

  // All five ingredients render publicly...
  await page.goto("/recipes/test-e2e-recipe-five");
  await expect(cardLink(page, "Charcoal").getByText("1x required.")).toBeVisible();
  await expect(cardLink(page, "Copper Ore").getByText("2x required.")).toBeVisible();
  await expect(cardLink(page, "Herb Leaf").getByText("3x required.")).toBeVisible();
  await expect(cardLink(page, "Iron Ore").getByText("4x required.")).toBeVisible();
  await expect(cardLink(page, "Wood").getByText("5x required.")).toBeVisible();

  // ...and the edit form prefills all five rows (item-name order).
  await page.goto("/admin/recipes/test-e2e-recipe-five/edit");
  const expectedRows: Array<[string, string]> = [
    ["Charcoal", "1"],
    ["Copper Ore", "2"],
    ["Herb Leaf", "3"],
    ["Iron Ore", "4"],
    ["Wood", "5"],
  ];
  for (const [index, [item, qty]] of expectedRows.entries()) {
    expect(await selectedOptionLabel(ingredientSelect(page, index))).toBe(item);
    await expect(ingredientQuantity(page, index)).toHaveValue(qty);
  }

  // A recipe carrying six ingredients (set up through the guarded helper;
  // seeded items are only referenced) triggers the existing capacity
  // guard: the edit page explains the refusal and renders no form at all,
  // so the extra ingredient cannot be silently dropped.
  await createTemporaryRecipeWithSixIngredients();
  await page.goto("/admin/recipes/test-e2e-recipe-six-ingredients/edit");
  await expect(
    page.getByRole("alert").filter({
      hasText:
        "This recipe has 6 ingredients, but the edit form currently supports only 5.",
    })
  ).toBeVisible();
  await expect(
    page.getByText(/none of this recipe's data is at risk of being dropped/)
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save Changes", exact: true })
  ).toHaveCount(0);
  await expect(page.getByLabel("Name", { exact: true })).toHaveCount(0);
  // Deletion must never depend on the edit form being renderable — the
  // toolbar's Delete Recipe link stays reachable even when the
  // ingredient-count guard blocks the form itself.
  await expect(
    page.getByRole("link", { name: "Delete Recipe", exact: true })
  ).toBeVisible();
});

test("recipe deletion removes the recipe and cascades its ingredient rows", async ({
  page,
}) => {
  await page.goto("/admin/recipes/new");
  await createRecipeThroughForm(page, {
    name: "Test E2E Recipe Delete",
    slug: "test-e2e-recipe-delete",
    resultingItem: "Iron Ingot",
    ingredients: [{ item: "Iron Ore", quantity: "1" }],
  });

  // Quick switching opens the edit route; Delete is reached from its
  // toolbar (the old table's per-row Delete link is gone).
  await recordRow(page, "Test E2E Recipe Delete").click();
  await expect(page).toHaveURL("/admin/recipes/test-e2e-recipe-delete/edit");
  await page.getByRole("link", { name: "Delete Recipe", exact: true }).click();
  await expect(page).toHaveURL("/admin/recipes/test-e2e-recipe-delete/delete");
  await expect(
    page.getByRole("heading", { level: 1, name: "Delete Recipe" })
  ).toBeVisible();
  // The confirmation identifies exactly this recipe and its relations.
  await expect(page.getByText("(test-e2e-recipe-delete)")).toBeVisible();
  await expect(page.getByText("Result: 1x Iron Ingot")).toBeVisible();
  await expect(page.getByText("Profession: No profession")).toBeVisible();
  await expect(page.getByText("Ingredients (1): 1x Iron Ore")).toBeVisible();

  await page
    .getByRole("button", { name: "Delete Permanently", exact: true })
    .click();

  await expect(page).toHaveURL("/admin/recipes?success=deleted");
  await expect(page.getByRole("status")).toHaveText("Recipe deleted.");
  await expect(recordRow(page, "Test E2E Recipe Delete")).toHaveCount(0);

  // Gone from the public site as well.
  const deletedResponse = await page.goto("/recipes/test-e2e-recipe-delete");
  expect(deletedResponse?.status()).toBe(404);
  await page.goto("/recipes");
  await expect(cardLink(page, "Test E2E Recipe Delete")).toHaveCount(0);

  // The cascade removed the recipe's own ingredient rows and nothing else.
  expect(await countE2eTestRecipeRecords()).toBe(0);
  expect((await readFixtureCounts()).recipeIngredients).toBe(15);
});

test("record-list search filters, preserves the query across switching, and clears", async ({
  page,
}) => {
  // Two temporary recipes sharing the test prefix, so one query matches
  // both while seeded records stay out of the way.
  await page.goto("/admin/recipes/new");
  await createRecipeThroughForm(page, {
    name: "Test E2E Recipe Search A",
    slug: "test-e2e-recipe-search-a",
    resultingItem: "Iron Ingot",
    ingredients: [{ item: "Iron Ore", quantity: "1" }],
  });
  await page.goto("/admin/recipes/new");
  await createRecipeThroughForm(page, {
    name: "Test E2E Recipe Search B",
    slug: "test-e2e-recipe-search-b",
    resultingItem: "Copper Ingot",
    ingredients: [{ item: "Copper Ore", quantity: "1" }],
  });

  // --- Search by NAME (trimmed, case-insensitive) -----------------------
  await page.goto("/admin/recipes");
  await page
    .getByRole("searchbox", { name: "Search recipes" })
    .fill("  test e2e recipe search  ");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/recipes\?q=/);
  await expect(recordRow(page, "Test E2E Recipe Search A")).toBeVisible();
  await expect(recordRow(page, "Test E2E Recipe Search B")).toBeVisible();
  // Seeded records are filtered out server-side.
  await expect(recordRow(page, "Iron Sword")).toHaveCount(0);
  await expect(page.getByText("2 matches")).toBeVisible();

  // --- Quick switching keeps the query applied --------------------------
  // Row hrefs carry the TRIMMED query, %20-encoded by the server helper.
  await recordRow(page, "Test E2E Recipe Search A").click();
  await expect(page).toHaveURL(
    "/admin/recipes/test-e2e-recipe-search-a/edit?q=test%20e2e%20recipe%20search"
  );
  await expect(
    recordRow(page, "Test E2E Recipe Search A")
  ).toHaveAttribute("aria-current", "page");

  // Switch directly to the second match: the list stays filtered, the
  // selection follows, and the first record is no longer marked.
  await recordRow(page, "Test E2E Recipe Search B").click();
  await expect(page).toHaveURL(
    "/admin/recipes/test-e2e-recipe-search-b/edit?q=test%20e2e%20recipe%20search"
  );
  await expect(
    recordRow(page, "Test E2E Recipe Search B")
  ).toHaveAttribute("aria-current", "page");
  await expect(
    recordRow(page, "Test E2E Recipe Search A")
  ).not.toHaveAttribute("aria-current", "page");

  // The create action, and this edit page's own Cancel/Delete links, keep
  // the search context too.
  await expect(
    page.getByRole("link", { name: "+ New recipe", exact: true })
  ).toHaveAttribute(
    "href",
    "/admin/recipes/new?q=test%20e2e%20recipe%20search"
  );
  await expect(page.getByRole("link", { name: "Cancel", exact: true })).toHaveAttribute(
    "href",
    "/admin/recipes?q=test%20e2e%20recipe%20search"
  );
  await expect(
    page.getByRole("link", { name: "Delete Recipe", exact: true })
  ).toHaveAttribute(
    "href",
    "/admin/recipes/test-e2e-recipe-search-b/delete?q=test%20e2e%20recipe%20search"
  );

  // --- Search by SLUG ---------------------------------------------------
  await page.goto("/admin/recipes");
  await page
    .getByRole("searchbox", { name: "Search recipes" })
    .fill("test-e2e-recipe-search-b");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(recordRow(page, "Test E2E Recipe Search B")).toBeVisible();
  await expect(recordRow(page, "Test E2E Recipe Search A")).toHaveCount(0);
  await expect(page.getByText("1 match", { exact: true })).toBeVisible();

  // --- No-match state (distinct from the no-recipes-at-all state) -------
  await page
    .getByRole("searchbox", { name: "Search recipes" })
    .fill("zzz-no-such-recipe");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const emptyRegion = page.locator(".admin-record-empty");
  await expect(emptyRegion).toContainText("No recipes match");
  await expect(emptyRegion).toContainText("zzz-no-such-recipe");
  await expect(page.getByText("0 matches")).toBeVisible();

  // --- Clear search returns the full list -------------------------------
  await page.getByRole("link", { name: "Clear search", exact: true }).click();
  await expect(page).toHaveURL("/admin/recipes");
  await expect(recordRow(page, "Iron Sword")).toBeVisible();
  await expect(recordRow(page, "Test E2E Recipe Search A")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Clear search", exact: true })
  ).toHaveCount(0);
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
