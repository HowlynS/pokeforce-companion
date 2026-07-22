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
  E2E_CURRENT_GAME_VERSION_NAME,
  countE2eTestRecipeRecords,
  createE2eTestGameVersion,
  createTemporaryRecipeWithSixIngredients,
  deleteE2eTestGameVersionRecords,
  deleteE2eTestRecipeRecords,
  readFixtureCounts,
} from "./helpers/database-cleanup";

// The persistent test-only Game Version fixture, made current by
// auth.setup.ts before any admin spec runs.
const CURRENT_VERSION_NAME = E2E_CURRENT_GAME_VERSION_NAME;

// A NON-current browser-test version for the historical-selection flow;
// carries the test-e2e-gv- prefix so deleteE2eTestGameVersionRecords
// always catches it.
const HISTORICAL_VERSION_NAME = "test-e2e-gv-recipes-historical";

// The checkbox's own label text is now dynamic ("Mark as verified for
// {selected version's name}"), so every call site matches this pattern
// rather than one fixed string.
const VERIFICATION_CHECKBOX_LABEL = /^Mark as verified for/;

// Browser error hygiene: any uncaught page error fails the test. Serial
// single-worker execution makes this module-level state safe.
let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(async () => {
  // Defensive prefix-scoped cleanup even when a test failed mid-lifecycle:
  // RecipeIngredient rows of test Recipes first, then the Recipes, then
  // the browser-test Game Version the verification test creates (last —
  // a stamped Recipe RESTRICT-references it).
  await deleteE2eTestRecipeRecords();
  await deleteE2eTestGameVersionRecords();
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

test.beforeAll(async () => {
  // Remove stale rows from interrupted earlier runs; the guard inside the
  // helper throws here if the environment is not the verified test project.
  await deleteE2eTestRecipeRecords();
  await deleteE2eTestGameVersionRecords();
  expect(await countE2eTestRecipeRecords()).toBe(0);
});

test.afterAll(async () => {
  const remaining =
    (await deleteE2eTestRecipeRecords()) +
    (await deleteE2eTestGameVersionRecords());
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

// One of the shared panels' rows (Verification or Timestamps) in the
// Recipe editor's aside, located by its label (dt) text — scoped to the
// panel by heading so identical row labels can never collide. The row's
// dt/dd text is concatenated with no separator, so the filter is
// anchored to the START of the row's text — otherwise "Current version"
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
  resultQuantityMin?: string;
  resultQuantityMax?: string;
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
  await page.getByLabel(/^Page address/).fill(data.slug);
  await page
    .getByRole("combobox", { name: "Resulting item", exact: true })
    .selectOption({ label: data.resultingItem });
  if (data.resultQuantityMin) {
    await page
      .getByLabel("Minimum quantity", { exact: true })
      .fill(data.resultQuantityMin);
  }
  if (data.resultQuantityMax) {
    await page
      .getByLabel("Maximum quantity", { exact: true })
      .fill(data.resultQuantityMax);
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

test("Recipe editor tabs: create shows only General; edit and ingredients mark their own tab active with the other one real; exactly one h1 renders; Timestamps render on General edit", async ({
  page,
}) => {
  // --- Create: exactly one h1, one real tab, no disabled placeholders,
  // Image panel present, no Timestamps panel (nothing to show yet) ------
  await page.goto("/admin/recipes/new");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  const createTabNav = page.getByRole("navigation", {
    name: "Recipe editor sections",
  });
  await expect(
    createTabNav.getByRole("link", { name: "General", exact: true })
  ).toHaveAttribute("aria-current", "page");
  await expect(createTabNav.getByText("Ingredients")).toHaveCount(0);
  await expect(createTabNav.getByText("Metadata")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 2, name: "Image", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Timestamps", exact: true })
  ).toHaveCount(0);

  await createRecipeThroughForm(page, {
    name: "Test E2E Recipe Tabs",
    slug: "test-e2e-recipe-tabs",
    resultingItem: "Iron Ingot",
    ingredients: [{ item: "Iron Ore", quantity: "1" }],
  });

  // --- General edit: exactly one h1 (the recipe's own name), General
  // active, Ingredients is the one other REAL tab (the Metadata tab was
  // removed — Visual Pass sub-slice 4), Timestamps present (Created/
  // Updated only, no Verified row) ----------------------------------------
  await recordRow(page, "Test E2E Recipe Tabs").click();
  await expect(page).toHaveURL("/admin/recipes/test-e2e-recipe-tabs/edit");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Test E2E Recipe Tabs",
      exact: true,
    })
  ).toBeVisible();

  const editTabNav = page.getByRole("navigation", {
    name: "Recipe editor sections",
  });
  await expect(
    editTabNav.getByRole("link", { name: "General", exact: true })
  ).toHaveAttribute("aria-current", "page");
  await expect(editTabNav.locator('[aria-current="page"]')).toHaveCount(1);
  await expect(
    editTabNav.getByRole("link", { name: "Ingredients", exact: true })
  ).toBeVisible();
  await expect(editTabNav.getByRole("link")).toHaveCount(2);
  await expect(editTabNav.locator('[aria-disabled="true"]')).toHaveCount(0);

  await expect(
    page.getByRole("heading", { level: 2, name: "Image", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Timestamps", exact: true })
  ).toBeVisible();
  await expect(panelRow(page, "Timestamps", "Created")).toBeVisible();
  await expect(panelRow(page, "Timestamps", "Updated")).toBeVisible();
  await expect(panelRow(page, "Timestamps", "Verified")).toHaveCount(0);
  // Ingredient rows are gone from General — moved entirely to the
  // Ingredients tab (Slice 9C.3).
  await expect(
    page.getByRole("group", { name: "Ingredients (fill at least one row)" })
  ).toHaveCount(0);

  // --- Ingredients: exactly one h1 (still the recipe's own name),
  // Ingredients active, General is the one other REAL tab, NO
  // Image/Verification/Timestamps panels (nothing to do with ingredients) -
  await editTabNav
    .getByRole("link", { name: "Ingredients", exact: true })
    .click();
  await expect(page).toHaveURL(
    "/admin/recipes/test-e2e-recipe-tabs/ingredients"
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Test E2E Recipe Tabs",
      exact: true,
    })
  ).toBeVisible();

  const ingredientsTabNav = page.getByRole("navigation", {
    name: "Recipe editor sections",
  });
  await expect(
    ingredientsTabNav.getByRole("link", { name: "Ingredients", exact: true })
  ).toHaveAttribute("aria-current", "page");
  await expect(
    ingredientsTabNav.locator('[aria-current="page"]')
  ).toHaveCount(1);
  await expect(
    ingredientsTabNav.getByRole("link", { name: "General", exact: true })
  ).toBeVisible();
  await expect(ingredientsTabNav.getByRole("link")).toHaveCount(2);
  await expect(
    ingredientsTabNav.locator('[aria-disabled="true"]')
  ).toHaveCount(0);

  await expect(
    page.getByRole("group", { name: "Ingredients (fill at least one row)" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Image", exact: true })
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 2, name: "Verification", exact: true })
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 2, name: "Timestamps", exact: true })
  ).toHaveCount(0);

  // Danger zone was removed from this relationship tab entirely (Visual
  // Pass II Section 7: General tab only) — Delete stays reachable via
  // General's own unconditional DangerZonePanel instead.
  await expect(
    page.getByRole("heading", { level: 2, name: "Danger zone", exact: true })
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Delete Recipe", exact: true })
  ).toHaveCount(0);

  await editTabNav.getByRole("link", { name: "General", exact: true }).click();
  await expect(page).toHaveURL("/admin/recipes/test-e2e-recipe-tabs/edit");
  await expect(
    page.getByRole("heading", { level: 2, name: "Danger zone", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Delete Recipe", exact: true })
  ).toHaveAttribute("href", "/admin/recipes/test-e2e-recipe-tabs/delete");
});

test("recipe creation renders result, profession, and ingredients publicly", async ({
  page,
}) => {
  await page.goto("/admin/recipes");
  await expect(
    page.getByRole("heading", { level: 1, name: "Recipe Management" })
  ).toBeVisible();

  await page.getByRole("link", { name: "+ New recipe", exact: true }).click();
  await expect(page).toHaveURL("/admin/recipes/new");

  await createRecipeThroughForm(page, {
    name: "Test E2E Recipe",
    slug: "test-e2e-recipe",
    resultingItem: "Iron Ingot",
    resultQuantityMin: "2",
    resultQuantityMax: "2",
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
      "Produces 2 Iron Ingot (Components) · Profession: Smithing · Required level: 3 · Requires: 1x Charcoal, 2x Iron Ore"
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
      "Produces 2 Iron Ingot (Components)."
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

test("creating a variable-output recipe (min 1, max 4) displays the range publicly, never a redundant 1-1", async ({
  page,
}) => {
  await page.goto("/admin/recipes/new");
  await createRecipeThroughForm(page, {
    name: "Test E2E Recipe Variable Output",
    slug: "test-e2e-recipe-variable-output",
    resultingItem: "Iron Ingot",
    resultQuantityMin: "1",
    resultQuantityMax: "4",
    ingredients: [{ item: "Iron Ore", quantity: "1" }],
  });

  await page.goto("/recipes/test-e2e-recipe-variable-output");
  await expect(
    cardLink(page, "Result: Iron Ingot").getByText(
      "Produces 1–4 Iron Ingot (Components)."
    )
  ).toBeVisible();
  // The en-dash range renders — never a hyphen, and never a redundant
  // "1-1" (this recipe's own min/max genuinely differ).
  await expect(page.getByText("Produces 1-1", { exact: false })).toHaveCount(
    0
  );

  // The edit form loads the persisted range back correctly.
  await page.goto("/admin/recipes");
  await recordRow(page, "Test E2E Recipe Variable Output").click();
  await expect(page.getByLabel("Minimum quantity", { exact: true })).toHaveValue(
    "1"
  );
  await expect(page.getByLabel("Maximum quantity", { exact: true })).toHaveValue(
    "4"
  );
});

test("editing a fixed-output recipe into a variable range, and a variable range back into a fixed output, both save and display correctly", async ({
  page,
}) => {
  await page.goto("/admin/recipes/new");
  await createRecipeThroughForm(page, {
    name: "Test E2E Recipe Range Toggle",
    slug: "test-e2e-recipe-range-toggle",
    resultingItem: "Iron Ingot",
    resultQuantityMin: "2",
    resultQuantityMax: "2",
    ingredients: [{ item: "Iron Ore", quantity: "1" }],
  });

  // --- Fixed -> variable --------------------------------------------------
  await recordRow(page, "Test E2E Recipe Range Toggle").click();
  await expect(page.getByLabel("Minimum quantity", { exact: true })).toHaveValue(
    "2"
  );
  await expect(page.getByLabel("Maximum quantity", { exact: true })).toHaveValue(
    "2"
  );
  await page.getByLabel("Minimum quantity", { exact: true }).fill("1");
  await page.getByLabel("Maximum quantity", { exact: true }).fill("5");
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(page).toHaveURL("/admin/recipes?success=updated");

  await page.goto("/recipes/test-e2e-recipe-range-toggle");
  await expect(
    cardLink(page, "Result: Iron Ingot").getByText(
      "Produces 1–5 Iron Ingot (Components)."
    )
  ).toBeVisible();

  // --- Variable -> fixed ---------------------------------------------------
  await page.goto("/admin/recipes");
  await recordRow(page, "Test E2E Recipe Range Toggle").click();
  await expect(page.getByLabel("Minimum quantity", { exact: true })).toHaveValue(
    "1"
  );
  await expect(page.getByLabel("Maximum quantity", { exact: true })).toHaveValue(
    "5"
  );
  await page.getByLabel("Minimum quantity", { exact: true }).fill("3");
  await page.getByLabel("Maximum quantity", { exact: true }).fill("3");
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(page).toHaveURL("/admin/recipes?success=updated");

  await page.goto("/recipes/test-e2e-recipe-range-toggle");
  await expect(
    cardLink(page, "Result: Iron Ingot").getByText(
      "Produces 3 Iron Ingot (Components)."
    )
  ).toBeVisible();
});

test("a maximum quantity below the minimum is rejected with a useful error, both on create and on edit", async ({
  page,
}) => {
  await page.goto("/admin/recipes/new");
  await page.getByLabel("Name", { exact: true }).fill("Test E2E Recipe Invalid Range");
  await page.getByLabel(/^Page address/).fill("test-e2e-recipe-invalid-range");
  await page
    .getByRole("combobox", { name: "Resulting item", exact: true })
    .selectOption({ label: "Iron Ingot" });
  await page.getByLabel("Minimum quantity", { exact: true }).fill("4");
  await page.getByLabel("Maximum quantity", { exact: true }).fill("1");
  await ingredientSelect(page, 0).selectOption({ label: "Iron Ore" });
  await ingredientQuantity(page, 0).fill("1");
  await page
    .getByRole("button", { name: "Create Recipe", exact: true })
    .click();

  // The submission is rejected server-side; the create route reloads with
  // a field-specific, readable error — no recipe is created.
  await expect(page).toHaveURL(
    "/admin/recipes/new?error=invalid_result_quantity_range"
  );
  await expect(
    page.getByText(
      "Maximum quantity must be equal to or greater than minimum quantity."
    )
  ).toBeVisible();
  await expect(recordRow(page, "Test E2E Recipe Invalid Range")).toHaveCount(
    0
  );

  // --- The same rule is enforced identically on an existing recipe's edit
  // --- form ----------------------------------------------------------------
  await createRecipeThroughForm(page, {
    name: "Test E2E Recipe Invalid Range Edit",
    slug: "test-e2e-recipe-invalid-range-edit",
    resultingItem: "Iron Ingot",
    ingredients: [{ item: "Iron Ore", quantity: "1" }],
  });
  await recordRow(page, "Test E2E Recipe Invalid Range Edit").click();
  await page.getByLabel("Minimum quantity", { exact: true }).fill("5");
  await page.getByLabel("Maximum quantity", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();

  await expect(page).toHaveURL(
    "/admin/recipes/test-e2e-recipe-invalid-range-edit/edit?error=invalid_result_quantity_range"
  );
  await expect(
    page.getByText(
      "Maximum quantity must be equal to or greater than minimum quantity."
    )
  ).toBeVisible();
  // The invalid submission never overwrote the persisted (still fixed 1/1)
  // values.
  await page.reload();
  await expect(page.getByLabel("Minimum quantity", { exact: true })).toHaveValue(
    "1"
  );
  await expect(page.getByLabel("Maximum quantity", { exact: true })).toHaveValue(
    "1"
  );
});

test("the seeded Stamina Brew recipe's migrated variable range loads correctly in the editor", async ({
  page,
}) => {
  // Seeded fixture only — read, never modified. Proves the migration's
  // backfill (and the seed's own deliberate min 1/max 4 range) is exactly
  // what the editor loads, end to end against real persisted data rather
  // than a freshly created row.
  await page.goto("/admin/recipes/stamina-brew/edit");
  await expect(
    page.getByRole("heading", { level: 1, name: "Stamina Brew", exact: true })
  ).toBeVisible();
  await expect(page.getByLabel("Minimum quantity", { exact: true })).toHaveValue(
    "1"
  );
  await expect(page.getByLabel("Maximum quantity", { exact: true })).toHaveValue(
    "4"
  );

  await page.goto("/recipes/stamina-brew");
  await expect(
    cardLink(page, "Result: Stamina Brew").getByText(
      "Produces 1–4 Stamina Brew (Consumables)."
    )
  ).toBeVisible();
});

test("General editing updates its own fields and leaves ingredients byte-for-byte untouched", async ({
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

  // --- Open the General edit form and verify every prefilled value ------
  // Quick switching: the record-list row itself is the edit link, and the
  // open record is marked selected (aria-current) in the list.
  await recordRow(page, "Test E2E Recipe").click();
  await expect(page).toHaveURL("/admin/recipes/test-e2e-recipe/edit");
  await expect(recordRow(page, "Test E2E Recipe")).toHaveAttribute(
    "aria-current",
    "page"
  );
  // The editor's one h1 is the recipe's own name; its slug is the
  // subtitle context underneath (Slice 9C.2, matching the Item General
  // editor's convention exactly).
  await expect(
    page.getByRole("heading", { level: 1, name: "Test E2E Recipe", exact: true })
  ).toBeVisible();
  await expect(page.getByText("test-e2e-recipe", { exact: true })).toBeVisible();

  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Test E2E Recipe"
  );
  await expect(page.getByLabel("Page address", { exact: true })).toHaveValue(
    "test-e2e-recipe"
  );
  expect(
    await selectedOptionLabel(
      page.getByRole("combobox", { name: "Resulting item", exact: true })
    )
  ).toBe("Iron Ingot");
  await expect(page.getByLabel("Minimum quantity", { exact: true })).toHaveValue(
    "1"
  );
  await expect(page.getByLabel("Maximum quantity", { exact: true })).toHaveValue(
    "1"
  );
  expect(
    await selectedOptionLabel(
      page.getByRole("combobox", { name: "Profession", exact: true })
    )
  ).toBe("Smithing");
  await expect(page.getByLabel(/^Required level/)).toHaveValue("3");
  // Ingredients moved entirely to their own tab (Slice 9C.3) — no
  // ingredient group renders on General any more.
  await expect(
    page.getByRole("group", { name: "Ingredients (fill at least one row)" })
  ).toHaveCount(0);

  // --- Change name, slug, result, profession (to none), and level;
  // --- ingredients and image untouched -----------------------------------
  await page.getByLabel("Name", { exact: true }).fill("Test E2E Recipe Updated");
  await page.getByLabel("Page address", { exact: true }).fill("test-e2e-recipe-updated");
  await page
    .getByRole("combobox", { name: "Resulting item", exact: true })
    .selectOption({ label: "Copper Ingot" });
  await page.getByLabel("Minimum quantity", { exact: true }).fill("3");
  await page.getByLabel("Maximum quantity", { exact: true }).fill("3");
  // Clearing the Profession exercises the optional relation: the empty
  // "No profession" option stores null.
  await page
    .getByRole("combobox", { name: "Profession", exact: true })
    .selectOption({ label: "No profession" });
  await page.getByLabel(/^Required level/).fill("");
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

  // ...and the new public detail page renders the changed General fields
  // — but the SAME, untouched ingredients: a General-only save must never
  // reach the RecipeIngredient table.
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
      "Produces 3 Copper Ingot (Components)."
    )
  ).toBeVisible();
  // No profession and no required level: the details card shows only the
  // no-profession fallback.
  await expect(page.getByText("Profession: None", { exact: true })).toBeVisible();
  await expect(
    cardLink(page, "Charcoal").getByText("1x required.")
  ).toBeVisible();
  await expect(
    cardLink(page, "Iron Ore").getByText("2x required.")
  ).toBeVisible();
});

test("Ingredients editing updates the ingredient rows and leaves General fields byte-for-byte untouched", async ({
  page,
}) => {
  await page.goto("/admin/recipes/new");
  await createRecipeThroughForm(page, {
    name: "Test E2E Recipe Ingredients",
    slug: "test-e2e-recipe-ingredients",
    resultingItem: "Iron Ingot",
    profession: "Smithing",
    requiredLevel: "3",
    ingredients: [
      { item: "Iron Ore", quantity: "2" },
      { item: "Charcoal", quantity: "1" },
    ],
  });

  // --- Open the Ingredients tab and verify every prefilled value --------
  await recordRow(page, "Test E2E Recipe Ingredients").click();
  await page
    .getByRole("navigation", { name: "Recipe editor sections" })
    .getByRole("link", { name: "Ingredients", exact: true })
    .click();
  await expect(page).toHaveURL(
    "/admin/recipes/test-e2e-recipe-ingredients/ingredients"
  );
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Test E2E Recipe Ingredients",
      exact: true,
    })
  ).toBeVisible();

  // Relationship-count badge (Phase B sub-slice): the active Ingredients
  // tab shows its own count (2 populated rows), and is still findable by
  // its plain accessible name since the badge is aria-hidden.
  await expect(
    page
      .getByRole("navigation", { name: "Recipe editor sections" })
      .getByRole("link", { name: "Ingredients", exact: true })
  ).toContainText("2");

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

  // --- Replace both ingredient rows; every other field untouched --------
  await ingredientSelect(page, 0).selectOption({ label: "Wood" });
  await ingredientQuantity(page, 0).fill("4");
  await ingredientSelect(page, 1).selectOption({ label: "Spring Water" });
  await ingredientQuantity(page, 1).fill("5");
  await page
    .getByRole("button", { name: "Save Ingredients", exact: true })
    .click();

  await expect(page).toHaveURL("/admin/recipes?success=updated");
  await expect(page.getByRole("status")).toHaveText("Recipe updated.");

  // The list still shows the SAME name and resulting item — an
  // ingredients-only save never touches them.
  const unchangedRow = recordRow(page, "Test E2E Recipe Ingredients");
  await expect(unchangedRow).toBeVisible();
  await expect(
    unchangedRow.getByText("Iron Ingot", { exact: true })
  ).toBeVisible();

  // The public route is unchanged (the slug never moved)...
  await page.goto("/recipes/test-e2e-recipe-ingredients");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Test E2E Recipe Ingredients",
      exact: true,
    })
  ).toBeVisible();
  // ...and every General field (result, profession, required level) is
  // byte-for-byte the same as before...
  await expect(
    cardLink(page, "Result: Iron Ingot").getByText(
      "Produces 1 Iron Ingot (Components)."
    )
  ).toBeVisible();
  await expect(
    page.getByText("Profession: Smithing · Required level: 3")
  ).toBeVisible();
  // ...but the ingredients are fully replaced.
  await expect(
    cardLink(page, "Spring Water").getByText("5x required.")
  ).toBeVisible();
  await expect(cardLink(page, "Wood").getByText("4x required.")).toBeVisible();
  await expect(cardLink(page, "Charcoal")).toHaveCount(0);
  await expect(cardLink(page, "Iron Ore")).toHaveCount(0);
});

test("incomplete ingredient pairs are rejected in both directions", async ({
  page,
}) => {
  await page.goto("/admin/recipes/new");

  // Item selected but quantity left empty.
  await page.getByLabel("Name", { exact: true }).fill("Test E2E Recipe Incomplete");
  await page.getByLabel(/^Page address/).fill("test-e2e-recipe-incomplete");
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
  await page.getByLabel(/^Page address/).fill("test-e2e-recipe-incomplete");
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
  await page.getByLabel(/^Page address/).fill("test-e2e-recipe-max-quantity");
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
  await page.getByLabel(/^Page address/).fill("test-e2e-recipe-duplicate-ingredient");
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

test("Ingredients editing rejects invalid submissions exactly like creation, with no General field touched", async ({
  page,
}) => {
  await page.goto("/admin/recipes/new");
  await createRecipeThroughForm(page, {
    name: "Test E2E Recipe Ingredients Invalid",
    slug: "test-e2e-recipe-ingredients-invalid",
    resultingItem: "Iron Ingot",
    ingredients: [{ item: "Iron Ore", quantity: "1" }],
  });

  await page.goto(
    "/admin/recipes/test-e2e-recipe-ingredients-invalid/ingredients"
  );

  // A duplicate ingredient item is rejected server-side, exactly like the
  // create form — the same shared parser, reached through a different
  // action.
  await ingredientSelect(page, 1).selectOption({ label: "Iron Ore" });
  await ingredientQuantity(page, 1).fill("2");
  await page
    .getByRole("button", { name: "Save Ingredients", exact: true })
    .click();

  await expect(page).toHaveURL(
    "/admin/recipes/test-e2e-recipe-ingredients-invalid/ingredients?error=duplicate_ingredient"
  );
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Each ingredient can only be added once." })
  ).toBeVisible();

  // The rejected submission changed nothing: the original single
  // ingredient survives, and the recipe's own name is untouched.
  await page.goto("/recipes/test-e2e-recipe-ingredients-invalid");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Test E2E Recipe Ingredients Invalid",
      exact: true,
    })
  ).toBeVisible();
  await expect(
    cardLink(page, "Iron Ore").getByText("1x required.")
  ).toBeVisible();
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

  // ...and the Ingredients tab prefills all five rows (item-name order).
  await page.goto("/admin/recipes/test-e2e-recipe-five/ingredients");
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
  // guard, now isolated to the Ingredients tab (Slice 9C.3): the page
  // explains the refusal and renders no form at all, so the extra
  // ingredient cannot be silently dropped.
  await createTemporaryRecipeWithSixIngredients();
  await page.goto("/admin/recipes/test-e2e-recipe-six-ingredients/ingredients");
  await expect(
    page.getByRole("alert").filter({
      hasText:
        "This recipe has 6 ingredients, but this form currently supports only 5.",
    })
  ).toBeVisible();
  await expect(
    page.getByText(/none of this recipe's data is at risk of being dropped/)
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save Ingredients", exact: true })
  ).toHaveCount(0);
  await expect(
    page.getByRole("group", { name: "Ingredients (fill at least one row)" })
  ).toHaveCount(0);
  // Deletion must never depend on the Ingredients form being renderable.
  // Danger Zone was removed from the Ingredients tab entirely (Visual
  // Pass II Section 7: General tab only), so Delete Recipe never appears
  // here at all — reachability is proven via General instead, a
  // completely separate route the ingredient-count guard never touches.
  await expect(
    page.getByRole("link", { name: "Delete Recipe", exact: true })
  ).toHaveCount(0);
  await page.goto("/admin/recipes/test-e2e-recipe-six-ingredients/edit");
  await expect(
    page.getByRole("link", { name: "Delete Recipe", exact: true })
  ).toBeVisible();
  await page.goto("/admin/recipes/test-e2e-recipe-six-ingredients/ingredients");
  // The Ingredients tab never renders Image/Verification/Timestamps in
  // the first place — nothing there to withhold.
  await expect(
    page.getByRole("heading", { level: 2, name: "Image", exact: true })
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 2, name: "Verification", exact: true })
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 2, name: "Timestamps", exact: true })
  ).toHaveCount(0);

  // The key Slice 9C.3 improvement: the SAME over-capacity recipe's
  // General tab is fully, normally editable — the former all-or-nothing
  // guard is gone from General entirely, and a normal save succeeds
  // without touching (or losing) any of the six ingredients. (Next.js
  // injects a hidden route-announcer div that also carries role="alert",
  // so the absence of the capacity banner is checked by its exact text
  // rather than by alert count.)
  await page.goto("/admin/recipes/test-e2e-recipe-six-ingredients/edit");
  await expect(
    page.getByText(/currently has more ingredients|ingredients, but/)
  ).toHaveCount(0);
  await expect(page.getByLabel("Name", { exact: true })).toBeVisible();
  await page.getByLabel(/^Required level/).fill("8");
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(page).toHaveURL("/admin/recipes?success=updated");
  await expect(page.getByRole("status")).toHaveText("Recipe updated.");

  // The Ingredients guard still applies afterward — none of the six
  // ingredients were touched by the General save.
  await page.goto("/admin/recipes/test-e2e-recipe-six-ingredients/ingredients");
  await expect(
    page.getByRole("alert").filter({
      hasText:
        "This recipe has 6 ingredients, but this form currently supports only 5.",
    })
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

  // Quick switching opens the edit route; Delete is reached from the
  // aside's Danger zone panel (the old table's per-row Delete link is
  // gone, and Delete no longer lives in the sticky Save/Cancel bar).
  await recordRow(page, "Test E2E Recipe Delete").click();
  await expect(page).toHaveURL("/admin/recipes/test-e2e-recipe-delete/edit");
  await page.getByRole("link", { name: "Delete Recipe", exact: true }).click();
  await expect(page).toHaveURL("/admin/recipes/test-e2e-recipe-delete/delete");
  await expect(
    page.getByRole("heading", { level: 1, name: "Delete Recipe" })
  ).toBeVisible();
  // The confirmation identifies exactly this recipe and its relations.
  await expect(page.getByText("(test-e2e-recipe-delete)")).toBeVisible();
  await expect(page.getByText("Result: 1 Iron Ingot")).toBeVisible();
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

test("gameplay verification stamps the selected game version and survives normal edits", async ({
  page,
}) => {
  // A NON-current historical version for the picker flows below.
  await createE2eTestGameVersion(HISTORICAL_VERSION_NAME);

  await page.goto("/admin/recipes/new");
  await createRecipeThroughForm(page, {
    name: "Test E2E Recipe Verify",
    slug: "test-e2e-recipe-verify",
    resultingItem: "Iron Ingot",
    ingredients: [{ item: "Iron Ore", quantity: "1" }],
  });

  // --- The shared VerificationPanel shows Unverified with no stamp rows,
  // and the picker lists versions and defaults to the current one -------
  await recordRow(page, "Test E2E Recipe Verify").click();
  await expect(page).toHaveURL("/admin/recipes/test-e2e-recipe-verify/edit");
  await expect(
    page.locator(".admin-status-badge", { hasText: "Unverified" })
  ).toBeVisible();
  await expect(panelRow(page, "Verification", "Verified for")).toHaveCount(
    0
  );
  const picker = page.getByLabel("Verify this record for");
  await expect(
    picker.locator("option:checked"),
    "the current version is preselected"
  ).toHaveText(`${CURRENT_VERSION_NAME} (current)`);
  await expect(
    picker.locator("option", { hasText: HISTORICAL_VERSION_NAME })
  ).toHaveCount(1);

  // --- Verify via the explicit opt-in checkbox (picker untouched) -------
  const verifyCheckbox = page.getByLabel(VERIFICATION_CHECKBOX_LABEL);
  await expect(verifyCheckbox).not.toBeChecked();
  await verifyCheckbox.check();
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(page).toHaveURL("/admin/recipes?success=updated");

  // The edit page shows the stamp carrying the preselected current Game
  // Version, resolved and validated server-side, classified as
  // verified-for-the-current-version by the shared panel.
  await recordRow(page, "Test E2E Recipe Verify").click();
  await expect(
    page.locator(".admin-status-badge", {
      hasText: "Verified — current version",
    })
  ).toBeVisible();
  await expect(
    panelRow(page, "Verification", "Verified for")
  ).toContainText(CURRENT_VERSION_NAME);
  const stampedDateText = await panelRow(page, "Verification", "Verified on")
    .textContent();
  // The Verified date now lives only in VerificationPanel's own "Verified
  // on" row above (Visual Pass sub-slice 7) — TimestampsPanel dropped the
  // duplicate row entirely.
  await expect(panelRow(page, "Timestamps", "Verified")).toHaveCount(0);

  // --- A NORMAL edit, even one that moves the picker, must not alter the
  // stamp: the picker only ever proposes a version, and nothing is
  // written while the checkbox stays unchecked. ---------------------------
  // Unchecked by default on every render, even for an already-verified
  // recipe: verification is a per-save action, not persistent form state.
  await expect(page.getByLabel(VERIFICATION_CHECKBOX_LABEL)).not.toBeChecked();
  await page
    .getByLabel("Verify this record for")
    .selectOption({ label: HISTORICAL_VERSION_NAME });
  await page.getByLabel("Minimum quantity", { exact: true }).fill("2");
  await page.getByLabel("Maximum quantity", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(page).toHaveURL("/admin/recipes?success=updated");

  await recordRow(page, "Test E2E Recipe Verify").click();
  await expect(
    page.locator(".admin-status-badge", {
      hasText: "Verified — current version",
    })
  ).toBeVisible();
  await expect(
    panelRow(page, "Verification", "Verified for")
  ).toContainText(CURRENT_VERSION_NAME);
  expect(
    await panelRow(page, "Verification", "Verified on").textContent()
  ).toBe(stampedDateText);

  // --- Verifying against a SELECTED historical version -------------------
  await page
    .getByLabel("Verify this record for")
    .selectOption({ label: HISTORICAL_VERSION_NAME });
  await page.getByLabel(VERIFICATION_CHECKBOX_LABEL).check();
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(page).toHaveURL("/admin/recipes?success=updated");

  await recordRow(page, "Test E2E Recipe Verify").click();
  await expect(
    page.locator(".admin-status-badge", { hasText: "Verified — older version" })
  ).toBeVisible();
  await expect(
    panelRow(page, "Verification", "Verified for")
  ).toContainText(HISTORICAL_VERSION_NAME);
});

test("switching recipes while on the Ingredients tab preserves the tab and q, and General's own tab link preserves q too", async ({
  page,
}) => {
  const RECIPE_A = {
    name: "Test E2E Recipe Ingredients Switch A",
    slug: "test-e2e-recipe-ingredients-switch-a",
  };
  const RECIPE_B = {
    name: "Test E2E Recipe Ingredients Switch B",
    slug: "test-e2e-recipe-ingredients-switch-b",
  };
  await page.goto("/admin/recipes/new");
  await createRecipeThroughForm(page, {
    ...RECIPE_A,
    resultingItem: "Iron Ingot",
    ingredients: [{ item: "Iron Ore", quantity: "1" }],
  });
  await page.goto("/admin/recipes/new");
  await createRecipeThroughForm(page, {
    ...RECIPE_B,
    resultingItem: "Copper Ingot",
    ingredients: [{ item: "Copper Ore", quantity: "1" }],
  });

  // A shared, distinguishing query so only these two temporary recipes
  // match.
  await page.goto("/admin/recipes");
  await page
    .getByRole("searchbox", { name: "Search recipes" })
    .fill("test e2e recipe ingredients switch");
  await expect(recordRow(page, RECIPE_A.name)).toBeVisible();
  await expect(recordRow(page, RECIPE_B.name)).toBeVisible();

  await recordRow(page, RECIPE_A.name).click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/recipes/${RECIPE_A.slug}/edit\\?q=`)
  );

  const tabNav = page.getByRole("navigation", { name: "Recipe editor sections" });
  await tabNav.getByRole("link", { name: "Ingredients", exact: true }).click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/recipes/${RECIPE_A.slug}/ingredients\\?q=`)
  );
  await expect(recordRow(page, RECIPE_A.name)).toHaveAttribute(
    "aria-current",
    "page"
  );

  // Switching records while ON the Ingredients tab opens the OTHER
  // recipe's Ingredients tab — not its General tab — with q intact.
  await recordRow(page, RECIPE_B.name).click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/recipes/${RECIPE_B.slug}/ingredients\\?q=`)
  );
  await expect(
    page.getByRole("heading", { level: 1, name: RECIPE_B.name, exact: true })
  ).toBeVisible();
  await expect(
    tabNav.getByRole("link", { name: "Ingredients", exact: true })
  ).toHaveAttribute("aria-current", "page");
  await expect(recordRow(page, RECIPE_B.name)).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(recordRow(page, RECIPE_A.name)).not.toHaveAttribute(
    "aria-current",
    "page"
  );

  // General's own tab link, followed from the Ingredients tab, preserves
  // q too.
  await tabNav.getByRole("link", { name: "General", exact: true }).click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/recipes/${RECIPE_B.slug}/edit\\?q=`)
  );
  await expect(
    tabNav.getByRole("link", { name: "General", exact: true })
  ).toHaveAttribute("aria-current", "page");
});

test("record-list search filters instantly while typing, preserves the query across switching, and clears — no Search button, no page reload", async ({
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

  await page.goto("/admin/recipes");
  await expect(
    page.getByRole("button", { name: "Search", exact: true })
  ).toHaveCount(0);

  // --- Filter by NAME (trimmed, case-insensitive) — typing alone
  // filters immediately, no click, no navigation ------------------------
  await page
    .getByRole("searchbox", { name: "Search recipes" })
    .fill("  test e2e recipe search  ");
  await expect(recordRow(page, "Test E2E Recipe Search A")).toBeVisible();
  await expect(recordRow(page, "Test E2E Recipe Search B")).toBeVisible();
  await expect(recordRow(page, "Iron Sword")).toHaveCount(0);
  await expect(page.getByText("2 of ", { exact: false })).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/recipes\?q=/);

  // --- Quick switching keeps the query applied --------------------------
  await recordRow(page, "Test E2E Recipe Search A").click();
  await expect(page).toHaveURL(
    /\/admin\/recipes\/test-e2e-recipe-search-a\/edit\?q=/
  );
  await expect(
    recordRow(page, "Test E2E Recipe Search A")
  ).toHaveAttribute("aria-current", "page");

  await recordRow(page, "Test E2E Recipe Search B").click();
  await expect(page).toHaveURL(
    /\/admin\/recipes\/test-e2e-recipe-search-b\/edit\?q=/
  );
  await expect(
    recordRow(page, "Test E2E Recipe Search B")
  ).toHaveAttribute("aria-current", "page");
  await expect(
    recordRow(page, "Test E2E Recipe Search A")
  ).not.toHaveAttribute("aria-current", "page");

  // The create action, and this edit page's own Cancel/Delete links, keep
  // the filter context too.
  await expect(
    page.getByRole("link", { name: "+ New recipe", exact: true })
  ).toHaveAttribute("href", /\/admin\/recipes\/new\?q=/);
  await expect(page.getByRole("link", { name: "Cancel", exact: true })).toHaveAttribute(
    "href",
    /\/admin\/recipes\?q=/
  );
  await expect(
    page.getByRole("link", { name: "Delete Recipe", exact: true })
  ).toHaveAttribute("href", /\/admin\/recipes\/test-e2e-recipe-search-b\/delete\?q=/);

  // --- Filter by Page address (slug) -------------------------------------
  await page.goto("/admin/recipes");
  await page
    .getByRole("searchbox", { name: "Search recipes" })
    .fill("test-e2e-recipe-search-b");
  await expect(recordRow(page, "Test E2E Recipe Search B")).toBeVisible();
  await expect(recordRow(page, "Test E2E Recipe Search A")).toHaveCount(0);
  await expect(page.getByText("1 of ", { exact: false })).toBeVisible();

  // --- No-match state (distinct from the no-recipes-at-all state) -------
  await page
    .getByRole("searchbox", { name: "Search recipes" })
    .fill("zzz-no-such-recipe");
  const emptyRegion = page.locator(".admin-record-empty");
  await expect(emptyRegion).toContainText("No matching records.");
  await expect(page.getByText(/^0 of \d+ recipes$/)).toBeVisible();

  // --- Escape clears the query, keeping focus in the field ---------------
  await page
    .getByRole("searchbox", { name: "Search recipes" })
    .press("Escape");
  await expect(
    page.getByRole("searchbox", { name: "Search recipes" })
  ).toHaveValue("");
  await expect(
    page.getByRole("searchbox", { name: "Search recipes" })
  ).toBeFocused();
  await expect(recordRow(page, "Iron Sword")).toBeVisible();

  // --- The inline clear button restores the full list ---------------------
  await page
    .getByRole("searchbox", { name: "Search recipes" })
    .fill("test-e2e-recipe-search-a");
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(
    page.getByRole("searchbox", { name: "Search recipes" })
  ).toHaveValue("");
  await expect(recordRow(page, "Iron Sword")).toBeVisible();
  await expect(page.getByRole("button", { name: "Clear search" })).toHaveCount(0);
  await expect(page).toHaveURL("/admin/recipes");
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
