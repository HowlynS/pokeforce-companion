// Focused E2E coverage for Recipe display-image inheritance (Recipe Image
// Inheritance follow-up): a Recipe with no custom image of its own shows
// its selected resulting Item's image instead — display only, never
// copied or persisted onto the Recipe row, and never touching the Item's
// own image. Complements the existing admin-recipe-images.spec.ts (which
// covers the Recipe's OWN image upload/replace/remove/delete lifecycle,
// completely unchanged by this follow-up) and admin-image-preview.spec.ts
// (which covers ImagePanel's generic local-file preview mechanics) — this
// spec is the one place the INHERITANCE behavior itself is exercised
// against the real application, the real database, and the real
// game-images bucket.
//
// Isolation: temporary Items carry the test-e2e-item-image-inherit- slug
// prefix, covered by the EXISTING E2E_ITEM_IMAGE_SLUG_PREFIX cleanup;
// temporary Recipes carry test-e2e-recipe-image-inherit-, covered by the
// EXISTING E2E_RECIPE_IMAGE_SLUG_PREFIX cleanup. Both suites' established
// guard-first cleanup helpers are reused as-is — no new prefix, table, or
// cleanup logic was introduced for this spec.

import { expect, test, type Page } from "@playwright/test";
import { selectAdminOption } from "./helpers/admin-select";
import path from "node:path";
import {
  countE2eTestItemImageRecords,
  countE2eTestRecipeImageIngredientRows,
  countE2eTestRecipeImageRecords,
  countItemFolderObjects,
  countRecipeFolderObjects,
  deleteE2eTestItemImageRecords,
  deleteE2eTestRecipeImageRecords,
  itemImageObjectExists,
  readItemImagePath,
  readRecipeImagePath,
  recipeImageObjectExists,
} from "./helpers/database-cleanup";

const PNG_FIXTURE = path.join(__dirname, "fixtures", "tiny-valid.png");
const WEBP_FIXTURE = path.join(__dirname, "fixtures", "tiny-valid.webp");

// Snapshot of how many objects each folder held before this suite ran; the
// preservation test proves the suite added none.
let itemFolderBaseline = 0;
let recipeFolderBaseline = 0;

// Browser error hygiene: any uncaught page error fails the test. Serial
// single-worker execution (playwright.config.ts) makes this module-level
// state safe.
let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(async () => {
  // Defensive cleanup even when a test failed mid-flow: Recipes first
  // (their own image objects), then Items (theirs) — matching the create
  // order, though either order is safe since the two prefixes never
  // overlap.
  await deleteE2eTestRecipeImageRecords();
  await deleteE2eTestItemImageRecords();
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

test.beforeAll(async () => {
  // Remove stale rows/objects from interrupted earlier runs; the guard
  // inside the helper throws here if the environment is not the verified
  // test project. Only then are the folder baselines recorded.
  await deleteE2eTestRecipeImageRecords();
  await deleteE2eTestItemImageRecords();
  expect(await countE2eTestRecipeImageRecords()).toBe(0);
  expect(await countE2eTestItemImageRecords()).toBe(0);
  itemFolderBaseline = await countItemFolderObjects();
  recipeFolderBaseline = await countRecipeFolderObjects();
});

test.afterAll(async () => {
  const remainingRecipes = await deleteE2eTestRecipeImageRecords();
  const remainingItems = await deleteE2eTestItemImageRecords();
  // afterEach should already have removed everything — fail loudly if not.
  expect(remainingRecipes).toBe(0);
  expect(remainingItems).toBe(0);
});

// The one large preview image ImagePanel/RecipeImagePanel renders, however
// it is currently sourced (inherited, persisted, or a local blob preview)
// — the same locator e2e/admin-image-preview.spec.ts already established
// for this exact element.
function preview(page: Page) {
  return page.locator("img.admin-image-preview-lg");
}

function ingredientGroup(page: Page) {
  return page.getByRole("group", {
    name: "Ingredients (fill at least one row)",
  });
}

// Creates an Item through the real create form with the given image file
// attached. Category is a seeded record, only ASSIGNED — never modified.
async function createItemWithImage(
  page: Page,
  data: { name: string; slug: string },
  imageFile: string
) {
  await page.goto("/admin/items/new");
  await page.getByLabel("Name", { exact: true }).fill(data.name);
  await page.getByLabel(/^Page address/).fill(data.slug);
  await selectAdminOption(
    page.getByRole("combobox", { name: "Category", exact: true }),
    "Materials"
  );
  await page.locator('input[name="image"]').setInputFiles(imageFile);
  await page.getByRole("button", { name: "Create item", exact: true }).click();

  await expect(page).toHaveURL(`/admin/items/${data.slug}/edit`);
  await expect(page.getByRole("status")).toHaveText("Item created");
}

// Fills the General fields of /admin/recipes/new with a given Resulting
// Item and the seeded "Iron Ore" as the single ingredient — the minimum
// valid Recipe, exactly like admin-recipe-images.spec.ts's own
// fillMinimalRecipeForm, but parameterized on the Resulting Item so each
// test below can choose which (image-bearing) Item the Recipe inherits
// from. Assumes the caller has already navigated to /admin/recipes/new.
async function fillRecipeGeneralFields(
  page: Page,
  data: { name: string; slug: string },
  resultingItemName: string
) {
  await page.getByLabel("Name", { exact: true }).fill(data.name);
  await page.getByLabel(/^Page address/).fill(data.slug);
  await selectAdminOption(
    page.getByRole("combobox", { name: "Resulting item", exact: true }),
    resultingItemName
  );
  await selectAdminOption(
    page.getByRole("combobox", { name: "Required class", exact: true }),
    "Trainer"
  );
  await selectAdminOption(
    ingredientGroup(page).getByRole("combobox").nth(0),
    "Iron Ore"
  );
  await ingredientGroup(page).getByRole("spinbutton").nth(0).fill("1");
}

test("selecting a resulting item with an image inherits it immediately, and saving without a recipe image persists none", async ({
  page,
}) => {
  const ITEM = {
    name: "Test E2E Item Image Inherit Create",
    slug: "test-e2e-item-image-inherit-create",
  };
  const RECIPE = {
    name: "Test E2E Recipe Image Inherit Create",
    slug: "test-e2e-recipe-image-inherit-create",
  };

  await createItemWithImage(page, ITEM, PNG_FIXTURE);
  expect(await readItemImagePath(ITEM.slug)).not.toBeNull();

  await page.goto("/admin/recipes/new");
  await expect(page.getByText("No image uploaded.")).toBeVisible();

  await fillRecipeGeneralFields(page, RECIPE, ITEM.name);

  // Inherited immediately — before any submission.
  await expect(preview(page)).toBeVisible();
  await expect(preview(page)).toHaveAttribute("src", /\.png$/);
  await expect(
    page.getByText(
      "Using the resulting item's image. Upload a Recipe image only to override it."
    )
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Create Recipe", exact: true })
    .click();
  await expect(page).toHaveURL(`/admin/recipes/${RECIPE.slug}/edit`);
  await expect(page.getByRole("status")).toHaveText("Recipe created");

  // The recipe's own image field was never written — the preview shown is
  // purely a read-time display fallback.
  expect(await readRecipeImagePath(RECIPE.slug)).toBeNull();
  await expect(preview(page)).toHaveAttribute("src", /\.png$/);
  await expect(
    page.getByText(
      "Using the resulting item's image. Upload a Recipe image only to override it."
    )
  ).toBeVisible();

  // Public pages show the inherited image too, with no database write.
  await page.goto(`/recipes/${RECIPE.slug}`);
  const detailImage = page.getByRole("img", {
    name: `Image of ${RECIPE.name}`,
    exact: true,
  });
  await detailImage.scrollIntoViewIfNeeded();
  await expect(detailImage).toBeVisible();
  await expect
    .poll(() =>
      detailImage.evaluate((el) => (el as HTMLImageElement).naturalWidth)
    )
    .toBeGreaterThan(0);
  await expect(
    page.locator(".recipe-result-image-stage").getByRole("img", {
      name: `Image of ${ITEM.name}`,
      exact: true,
    })
  ).toBeVisible();

  await page.goto("/recipes");
  const listImage = page.getByRole("img", {
    name: `Image of ${ITEM.name}`,
    exact: true,
  });
  await listImage.scrollIntoViewIfNeeded();
  await expect(listImage).toBeVisible();
});

test("changing the selected resulting item swaps the inherited preview, and creates no custom recipe image", async ({
  page,
}) => {
  const ITEM_A = {
    name: "Test E2E Item Image Inherit Switch A",
    slug: "test-e2e-item-image-inherit-switch-a",
  };
  const ITEM_B = {
    name: "Test E2E Item Image Inherit Switch B",
    slug: "test-e2e-item-image-inherit-switch-b",
  };
  const RECIPE = {
    name: "Test E2E Recipe Image Inherit Switch",
    slug: "test-e2e-recipe-image-inherit-switch",
  };

  // Distinct extensions (PNG vs WebP) make "the preview actually changed"
  // unambiguous from the src attribute alone.
  await createItemWithImage(page, ITEM_A, PNG_FIXTURE);
  await createItemWithImage(page, ITEM_B, WEBP_FIXTURE);

  await page.goto("/admin/recipes/new");
  await page.getByLabel("Name", { exact: true }).fill(RECIPE.name);
  await page.getByLabel(/^Page address/).fill(RECIPE.slug);

  await selectAdminOption(
    page.getByRole("combobox", { name: "Resulting item", exact: true }),
    ITEM_A.name
  );
  await expect(preview(page)).toHaveAttribute("src", /\.png$/);
  const firstSrc = await preview(page).getAttribute("src");

  await selectAdminOption(
    page.getByRole("combobox", { name: "Resulting item", exact: true }),
    ITEM_B.name
  );
  await expect(preview(page)).toHaveAttribute("src", /\.webp$/);
  const secondSrc = await preview(page).getAttribute("src");
  expect(secondSrc).not.toBe(firstSrc);

  await selectAdminOption(
    page.getByRole("combobox", { name: "Required class", exact: true }),
    "Trainer"
  );
  await selectAdminOption(
    ingredientGroup(page).getByRole("combobox").nth(0),
    "Iron Ore"
  );
  await ingredientGroup(page).getByRole("spinbutton").nth(0).fill("1");

  await page
    .getByRole("button", { name: "Create Recipe", exact: true })
    .click();
  await expect(page).toHaveURL(`/admin/recipes/${RECIPE.slug}/edit`);
  expect(await readRecipeImagePath(RECIPE.slug)).toBeNull();
});

test("a locally selected recipe image overrides the inherited item image and persists as the recipe's own", async ({
  page,
}) => {
  const ITEM = {
    name: "Test E2E Item Image Inherit Override",
    slug: "test-e2e-item-image-inherit-override",
  };
  const RECIPE = {
    name: "Test E2E Recipe Image Inherit Override",
    slug: "test-e2e-recipe-image-inherit-override",
  };

  await createItemWithImage(page, ITEM, PNG_FIXTURE);

  await page.goto("/admin/recipes/new");
  await fillRecipeGeneralFields(page, RECIPE, ITEM.name);
  await expect(preview(page)).toHaveAttribute("src", /\.png$/);

  // A local Recipe image file always wins over the inherited preview.
  await page.locator('input[name="image"]').setInputFiles(WEBP_FIXTURE);
  await expect(preview(page)).toHaveAttribute("src", /^blob:/);

  await page
    .getByRole("button", { name: "Create Recipe", exact: true })
    .click();
  await expect(page).toHaveURL(`/admin/recipes/${RECIPE.slug}/edit`);
  await expect(page.getByRole("status")).toHaveText("Recipe created");

  const recipeImagePath = await readRecipeImagePath(RECIPE.slug);
  expect(recipeImagePath !== null).toBe(true);
  expect(/^recipes\/[a-z0-9-]+\.webp$/.test(recipeImagePath as string)).toBe(
    true
  );
  expect(await recipeImageObjectExists(recipeImagePath as string)).toBe(true);

  // After reload the recipe's own (webp) image is shown, not the item's
  // (png) — the custom override note appears in place of the inherited one.
  await expect(preview(page)).toHaveAttribute("src", /\.webp$/);
  await expect(page.getByText("custom image override")).toBeVisible();
  await expect(
    page.getByText("Using the resulting item's image.")
  ).toHaveCount(0);

  // Public pages show the recipe's own image, not the item's. next/image
  // rewrites the rendered src through its own optimizer proxy
  // (/_next/image?url=<encoded original>&w=...&q=...), so the match looks
  // for the extension immediately before that trailing query string rather
  // than at the very end of src.
  await page.goto(`/recipes/${RECIPE.slug}`);
  const detailImage = page.getByRole("img", {
    name: `Image of ${RECIPE.name}`,
    exact: true,
  });
  await expect(detailImage).toHaveAttribute("src", /\.webp&/);
});

test("removing the recipe's custom image keeps it visible, muted, until save — then reveals the resulting item's image, leaving the item's own image untouched", async ({
  page,
}) => {
  const ITEM = {
    name: "Test E2E Item Image Inherit Remove",
    slug: "test-e2e-item-image-inherit-remove",
  };
  const RECIPE = {
    name: "Test E2E Recipe Image Inherit Remove",
    slug: "test-e2e-recipe-image-inherit-remove",
  };

  await createItemWithImage(page, ITEM, PNG_FIXTURE);
  const itemImagePath = await readItemImagePath(ITEM.slug);
  expect(itemImagePath !== null).toBe(true);

  await page.goto("/admin/recipes/new");
  await fillRecipeGeneralFields(page, RECIPE, ITEM.name);
  await page.locator('input[name="image"]').setInputFiles(WEBP_FIXTURE);
  await page
    .getByRole("button", { name: "Create Recipe", exact: true })
    .click();
  await expect(page).toHaveURL(`/admin/recipes/${RECIPE.slug}/edit`);

  const recipeImagePath = await readRecipeImagePath(RECIPE.slug);
  expect(recipeImagePath !== null).toBe(true);

  // The removal checkbox itself is visually hidden; its accessible label
  // is the visible trash toggle, exactly like admin-recipe-images.spec.ts.
  await page.getByTitle("Remove image").click();
  await expect(
    page.getByRole("checkbox", { name: "Remove image" })
  ).toBeChecked();

  // BEFORE any save: the recipe's own (webp) custom image stays visible —
  // muted, not replaced by the empty fallback or the inherited item's
  // (png) image — and the inherited note must NOT appear yet, since the
  // custom image has not actually been removed.
  await expect(preview(page)).toHaveAttribute("src", /\.webp$/);
  await expect(preview(page)).toHaveClass(
    /admin-image-preview-lg--pending-removal/
  );
  await expect(
    page.getByText("Image will be removed when saved.")
  ).toBeVisible();
  await expect(
    page.getByText(
      "Using the resulting item's image. Upload a Recipe image only to override it."
    )
  ).toHaveCount(0);

  // Reversing removal restores the normal (non-muted) custom image
  // immediately, without saving anything.
  await page.getByTitle("Remove image").click();
  await expect(
    page.getByRole("checkbox", { name: "Remove image" })
  ).not.toBeChecked();
  await expect(preview(page)).toHaveAttribute("src", /\.webp$/);
  await expect(preview(page)).not.toHaveClass(
    /admin-image-preview-lg--pending-removal/
  );

  // Re-check removal and actually save this time.
  await page.getByTitle("Remove image").click();
  await expect(
    page.getByRole("checkbox", { name: "Remove image" })
  ).toBeChecked();
  await page
    .getByRole("button", { name: "Save Changes", exact: true })
    .click();
  await expect(page).toHaveURL(`/admin/recipes/${RECIPE.slug}/edit`);
  await expect(page.getByRole("status")).toHaveText("Recipe saved");

  // The recipe's own image field is cleared and its exact object deleted —
  // the item's own image is completely untouched by this Recipe action.
  expect(await readRecipeImagePath(RECIPE.slug)).toBeNull();
  expect(await recipeImageObjectExists(recipeImagePath as string)).toBe(
    false
  );
  expect(await itemImageObjectExists(itemImagePath as string)).toBe(true);
  expect(await readItemImagePath(ITEM.slug)).toBe(itemImagePath);

  // Only NOW, after the save-in-place reload, does the inherited item
  // image appear.
  await expect(preview(page)).toHaveAttribute("src", /\.png$/);
  await expect(preview(page)).not.toHaveClass(
    /admin-image-preview-lg--pending-removal/
  );

  // next/image rewrites the rendered src through its own optimizer proxy
  // (see the override test's identical comment above).
  await page.goto(`/recipes/${RECIPE.slug}`);
  const detailImage = page.getByRole("img", {
    name: `Image of ${RECIPE.name}`,
    exact: true,
  });
  await expect(detailImage).toHaveAttribute("src", /\.png&/);
});

test("no suite item, recipe, or storage object remains", async () => {
  expect(await countE2eTestRecipeImageRecords()).toBe(0);
  expect(await countE2eTestRecipeImageIngredientRows()).toBe(0);
  expect(await countE2eTestItemImageRecords()).toBe(0);
  // Both folders hold exactly as many objects as before the suite:
  // nothing was orphaned by any create, switch, override, or remove.
  expect(await countItemFolderObjects()).toBe(itemFolderBaseline);
  expect(await countRecipeFolderObjects()).toBe(recipeFolderBaseline);
});
