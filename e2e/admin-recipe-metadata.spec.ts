// Authenticated coverage for the Recipe "Metadata" tab (Slice 9C.4): the
// third and final real Recipe tab, showing restrained, read-only
// administrative information — resulting item, optional profession,
// optional required level, ingredient count, created/updated dates, and
// verification status/version/date — with no form, picker, checkbox,
// submit button, delete action, image control, or ingredient control
// anywhere in the main content region. The Game Version verification
// rules themselves (stamping, current-version resolution, tampered-id
// rejection) are exhaustively covered by admin-recipes.spec.ts's own
// verification test and the Game Version service tests; this suite only
// proves the Metadata tab DISPLAYS that state correctly and never
// exposes internal ids or foreign keys.
//
// Runs in the chromium-admin project with the storage state saved by
// auth.setup.ts. Every temporary Recipe uses the test-e2e-recipe slug
// prefix; verification is stamped against the persistent, always-current
// test-gv-current fixture — no additional Game Version is created, so no
// extra cleanup surface is introduced beyond the existing Recipe helpers.

import { expect, test, type Page } from "@playwright/test";
import {
  E2E_CURRENT_GAME_VERSION_NAME,
  countE2eTestRecipeRecords,
  deleteE2eTestRecipeRecords,
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

// One row of the shared Recipe record list, located by its exact primary
// text inside the list's navigation landmark.
function recordRow(page: Page, name: string) {
  return page
    .getByRole("navigation", { name: "Recipes records" })
    .getByRole("link")
    .filter({ has: page.getByText(name, { exact: true }) });
}

function tabNav(page: Page) {
  return page.getByRole("navigation", { name: "Recipe editor sections" });
}

// The Metadata tab's own content, excluding the record list and header —
// the record list's search form is expected to stay on-screen, so
// "no form/mutation control" assertions must be scoped to this region
// rather than the whole page.
function mainContent(page: Page) {
  return page.locator(".admin-workspace-main");
}

// One of the shared panels' rows (Recipe, Verification, or Timestamps),
// located by its label (dt) text — scoped to the panel by heading so
// identical row labels in different panels can never collide. The row's
// dt/dd text is concatenated with no separator, so the filter is anchored
// to the START of the row's text — otherwise a label like "Current
// version" would also match the unrelated "Verified — current version"
// status badge's own "admin-panel-row" wrapper (case-insensitive
// substring).
function panelRow(page: Page, panelTitle: string, label: string) {
  return page
    .locator(".admin-panel")
    .filter({
      has: page.getByRole("heading", { level: 2, name: panelTitle, exact: true }),
    })
    .locator(".admin-panel-row")
    .filter({ hasText: new RegExp(`^${label}`) });
}

type RecipeFormData = {
  name: string;
  slug: string;
  resultingItem: string;
  profession?: string;
  requiredLevel?: string;
  ingredients: { item: string; quantity: string }[];
};

async function createTemporaryRecipe(page: Page, data: RecipeFormData) {
  await page.goto("/admin/recipes/new");
  await page.getByLabel("Name", { exact: true }).fill(data.name);
  await page.getByLabel(/^Slug/).fill(data.slug);
  await page
    .getByRole("combobox", { name: "Resulting item", exact: true })
    .selectOption({ label: data.resultingItem });
  if (data.profession) {
    await page
      .getByRole("combobox", { name: "Profession", exact: true })
      .selectOption({ label: data.profession });
  }
  if (data.requiredLevel) {
    await page.getByLabel(/^Required level/).fill(data.requiredLevel);
  }

  const group = page.getByRole("group", {
    name: "Ingredients (fill at least one row)",
  });
  for (const [index, ingredient] of data.ingredients.entries()) {
    await group
      .getByRole("combobox")
      .nth(index)
      .selectOption({ label: ingredient.item });
    await group.getByRole("spinbutton").nth(index).fill(ingredient.quantity);
  }

  await page.getByRole("button", { name: "Create Recipe", exact: true }).click();
  await expect(page).toHaveURL("/admin/recipes?success=created");
}

test("opening the Metadata tab directly shows the resulting item, ingredient count, and Unverified status inside the Recipe workspace", async ({
  page,
}) => {
  const RECIPE = {
    name: "Test E2E Recipe Metadata Tab",
    slug: "test-e2e-recipe-metadata-tab",
    resultingItem: "Iron Ingot",
    ingredients: [{ item: "Iron Ore", quantity: "2" }],
  };
  await createTemporaryRecipe(page, RECIPE);

  await page.goto(`/admin/recipes/${RECIPE.slug}/metadata`);

  // One h1: the recipe's own name; the record list stays visible with
  // this recipe selected; the Metadata tab is marked active.
  await expect(
    page.getByRole("heading", { level: 1, name: RECIPE.name, exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Recipes records" })
  ).toBeVisible();
  await expect(recordRow(page, RECIPE.name)).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(
    tabNav(page).getByRole("link", { name: "Metadata", exact: true })
  ).toHaveAttribute("aria-current", "page");
  await expect(tabNav(page).locator('[aria-disabled="true"]')).toHaveCount(0);

  // Recipe context: resulting item and ingredient count; no profession or
  // required level rows since neither was set.
  await expect(panelRow(page, "Recipe", "Resulting item")).toContainText(
    "1x Iron Ingot"
  );
  await expect(panelRow(page, "Recipe", "Ingredients")).toContainText("1");
  await expect(panelRow(page, "Recipe", "Profession")).toHaveCount(0);
  await expect(panelRow(page, "Recipe", "Required level")).toHaveCount(0);

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
  await expect(main.locator('input[type="number"]')).toHaveCount(0);
  await expect(main.locator('button[type="submit"]')).toHaveCount(0);
  await expect(main.getByRole("button", { name: /save/i })).toHaveCount(0);
  await expect(main.getByRole("link", { name: /delete/i })).toHaveCount(0);
  // No raw database id, foreign key, or storage path field.
  await expect(main.locator('input[name="id"]')).toHaveCount(0);
  await expect(main.locator('input[type="hidden"]')).toHaveCount(0);
});

test("a recipe with a profession and required level renders both, and a verified recipe shows the verified version and verification date", async ({
  page,
}) => {
  const RECIPE = {
    name: "Test E2E Recipe Metadata Verified",
    slug: "test-e2e-recipe-metadata-verified",
    resultingItem: "Iron Ingot",
    profession: "Smithing",
    requiredLevel: "4",
    ingredients: [
      { item: "Iron Ore", quantity: "2" },
      { item: "Charcoal", quantity: "1" },
    ],
  };
  await createTemporaryRecipe(page, RECIPE);

  await page.goto(`/admin/recipes/${RECIPE.slug}/metadata`);
  await expect(panelRow(page, "Recipe", "Profession")).toContainText(
    "Smithing"
  );
  await expect(panelRow(page, "Recipe", "Required level")).toContainText("4");
  await expect(panelRow(page, "Recipe", "Ingredients")).toContainText("2");

  // Verify through the real General edit form's shared VerificationPanel
  // (unchanged behavior) — the picker defaults to the current version.
  await page.goto(`/admin/recipes/${RECIPE.slug}/edit`);
  await page.getByLabel(VERIFICATION_CHECKBOX_LABEL).check();
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(page).toHaveURL("/admin/recipes?success=updated");

  await page.goto(`/admin/recipes/${RECIPE.slug}/metadata`);
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

test("switching recipes while on the Metadata tab preserves the tab and q", async ({
  page,
}) => {
  const RECIPE_A = {
    name: "Test E2E Recipe Metadata Switch A",
    slug: "test-e2e-recipe-metadata-switch-a",
    resultingItem: "Iron Ingot",
    ingredients: [{ item: "Iron Ore", quantity: "1" }],
  };
  const RECIPE_B = {
    name: "Test E2E Recipe Metadata Switch B",
    slug: "test-e2e-recipe-metadata-switch-b",
    resultingItem: "Copper Ingot",
    ingredients: [{ item: "Copper Ore", quantity: "1" }],
  };
  await createTemporaryRecipe(page, RECIPE_A);
  await createTemporaryRecipe(page, RECIPE_B);

  // A shared, distinguishing query so only these two temporary recipes
  // match.
  await page.goto("/admin/recipes");
  await page
    .getByRole("searchbox", { name: "Search recipes" })
    .fill("test e2e recipe metadata switch");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(recordRow(page, RECIPE_A.name)).toBeVisible();
  await expect(recordRow(page, RECIPE_B.name)).toBeVisible();

  await recordRow(page, RECIPE_A.name).click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/recipes/${RECIPE_A.slug}/edit\\?q=`)
  );

  await tabNav(page).getByRole("link", { name: "Metadata", exact: true }).click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/recipes/${RECIPE_A.slug}/metadata\\?q=`)
  );
  await expect(recordRow(page, RECIPE_A.name)).toHaveAttribute(
    "aria-current",
    "page"
  );

  // Switching records while ON the Metadata tab opens the OTHER recipe's
  // Metadata tab — not its General tab — with q intact.
  await recordRow(page, RECIPE_B.name).click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/recipes/${RECIPE_B.slug}/metadata\\?q=`)
  );
  await expect(
    page.getByRole("heading", { level: 1, name: RECIPE_B.name, exact: true })
  ).toBeVisible();
  await expect(
    tabNav(page).getByRole("link", { name: "Metadata", exact: true })
  ).toHaveAttribute("aria-current", "page");
  await expect(recordRow(page, RECIPE_B.name)).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(recordRow(page, RECIPE_A.name)).not.toHaveAttribute(
    "aria-current",
    "page"
  );
});

test("General and Ingredients remain real links from the Metadata tab, and no Recipe tab is disabled", async ({
  page,
}) => {
  const RECIPE = {
    name: "Test E2E Recipe Metadata Nav",
    slug: "test-e2e-recipe-metadata-nav",
    resultingItem: "Iron Ingot",
    ingredients: [{ item: "Iron Ore", quantity: "1" }],
  };
  await createTemporaryRecipe(page, RECIPE);

  await page.goto(`/admin/recipes/${RECIPE.slug}/metadata`);
  await expect(
    tabNav(page).getByRole("link", { name: "Metadata", exact: true })
  ).toHaveAttribute("aria-current", "page");
  await expect(tabNav(page).locator('[aria-current="page"]')).toHaveCount(1);
  await expect(tabNav(page).locator('[aria-disabled="true"]')).toHaveCount(0);

  await tabNav(page).getByRole("link", { name: "General", exact: true }).click();
  await expect(page).toHaveURL(`/admin/recipes/${RECIPE.slug}/edit`);
  await expect(
    tabNav(page).getByRole("link", { name: "General", exact: true })
  ).toHaveAttribute("aria-current", "page");

  await tabNav(page)
    .getByRole("link", { name: "Ingredients", exact: true })
    .click();
  await expect(page).toHaveURL(`/admin/recipes/${RECIPE.slug}/ingredients`);
  await expect(
    tabNav(page).getByRole("link", { name: "Ingredients", exact: true })
  ).toHaveAttribute("aria-current", "page");

  await tabNav(page).getByRole("link", { name: "Metadata", exact: true }).click();
  await expect(page).toHaveURL(`/admin/recipes/${RECIPE.slug}/metadata`);
  await expect(
    tabNav(page).getByRole("link", { name: "Metadata", exact: true })
  ).toHaveAttribute("aria-current", "page");
});

test("an unknown recipe slug fails safely on the metadata route", async ({
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
