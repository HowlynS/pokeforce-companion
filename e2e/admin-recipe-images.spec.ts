// Authenticated Recipe IMAGE workflow against the REAL application, the
// isolated Supabase test project, and its real game-images bucket.
// Mirrors the Item and Profession image suites: every temporary Recipe slug
// carries the test-e2e-recipe-image prefix; Storage objects live under the
// production recipes/ folder with server-generated names, identified ONLY
// through the exact object path stored on the temporary row — never by
// guessing names and never by bulk folder deletion. Guard-first cleanup in
// beforeAll/afterEach/afterAll removes those exact objects first and the
// rows second (their RecipeIngredient rows fall to the database-level
// cascade), and fails loudly on leftovers. Object paths and URLs are
// asserted boolean-only so they never reach test output.
//
// Seeded Items are only REFERENCED as the resulting item and the single
// ingredient of temporary Recipes and are never modified; the Profession
// select is left on "No profession" to keep the form minimal but valid.
//
// The committed fixtures are reused from the Item image suite; the
// oversized payload is generated at runtime in the OS temporary directory
// and removed afterwards.

import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  countE2eTestRecipeImageIngredientRows,
  countE2eTestRecipeImageRecords,
  countRecipeFolderObjects,
  deleteE2eTestRecipeImageRecords,
  fetchRecipeImageContentType,
  readFixtureCounts,
  readRecipeImagePath,
  recipeImageObjectExists,
} from "./helpers/database-cleanup";

const PNG_FIXTURE = path.join(__dirname, "fixtures", "tiny-valid.png");
const WEBP_FIXTURE = path.join(__dirname, "fixtures", "tiny-valid.webp");
const TEXT_FIXTURE = path.join(__dirname, "fixtures", "not-an-image.txt");

// Snapshot of how many objects the recipes/ folder held before this suite
// ran; the preservation test proves the suite added none (read-only count —
// deletion is always by exact recorded path).
let recipeFolderBaseline = 0;

// Browser error hygiene: any uncaught page error fails the test. Serial
// single-worker execution makes this module-level state safe.
let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(async () => {
  // Defensive cleanup even when a test failed mid-flow: exact recorded
  // Storage objects first, then the prefixed Recipe rows (their ingredient
  // rows cascade).
  await deleteE2eTestRecipeImageRecords();
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

test.beforeAll(async () => {
  // Remove stale rows/objects from interrupted earlier runs; the guard
  // inside the helper throws here if the environment is not the verified
  // test project. Only then is the folder baseline recorded.
  await deleteE2eTestRecipeImageRecords();
  expect(await countE2eTestRecipeImageRecords()).toBe(0);
  expect(await countE2eTestRecipeImageIngredientRows()).toBe(0);
  recipeFolderBaseline = await countRecipeFolderObjects();
});

test.afterAll(async () => {
  const remaining = await deleteE2eTestRecipeImageRecords();
  // afterEach should already have removed everything — fail loudly if not.
  expect(remaining).toBe(0);
});

// One row of the shared Recipe record list (Slice 9C.1), located by its
// exact primary text inside the list's navigation landmark. The row link
// itself opens the edit route.
function recordRow(page: Page, name: string) {
  return page
    .getByRole("navigation", { name: "Recipes records" })
    .getByRole("link")
    .filter({ has: page.getByText(name, { exact: true }) });
}

// The five fixed ingredient rows live inside one fieldset; its legend gives
// the group its accessible name. The selects and quantity inputs inside it
// carry no individual labels, so they are addressed by role and position
// within the group (same pattern as the Recipe CRUD suite).
function ingredientGroup(page: Page) {
  return page.getByRole("group", {
    name: "Ingredients (fill at least one row)",
  });
}

// Asserts a real rendered image: visible AND actually decoded (non-zero
// natural width), which fails on a broken or unreadable source. Scrolling
// first satisfies lazy loading on longer pages.
async function expectRenderedImage(page: Page, alt: string) {
  const image = page.getByRole("img", { name: alt, exact: true });
  await image.scrollIntoViewIfNeeded();
  await expect(image).toBeVisible();
  await expect
    .poll(
      () => image.evaluate((el) => (el as HTMLImageElement).naturalWidth),
      { message: "the image must decode to a non-zero natural width" }
    )
    .toBeGreaterThan(0);
}

// Fills the create form on /admin/recipes/new with the minimum valid
// Recipe: seeded resulting item, no profession, no required level, and
// one seeded ingredient row. The image input is filled with the given
// file when one is provided; submission is left to the caller, since the
// rejection tests expect an error state rather than success.
async function fillMinimalRecipeForm(
  page: Page,
  data: { name: string; slug: string },
  imageFile: string | null
) {
  await page.goto("/admin/recipes/new");
  await page.getByLabel("Name", { exact: true }).fill(data.name);
  await page.getByLabel(/^Slug/).fill(data.slug);
  await page
    .getByRole("combobox", { name: "Resulting item", exact: true })
    .selectOption({ label: "Iron Ingot" });
  await ingredientGroup(page)
    .getByRole("combobox")
    .nth(0)
    .selectOption({ label: "Iron Ore" });
  await ingredientGroup(page).getByRole("spinbutton").nth(0).fill("1");
  if (imageFile) {
    await page.locator('input[name="image"]').setInputFiles(imageFile);
  }
}

// Creates a Recipe through the real create form with the given image file
// attached, and waits for the success state.
async function createRecipeWithImage(
  page: Page,
  data: { name: string; slug: string },
  imageFile: string
) {
  await fillMinimalRecipeForm(page, data, imageFile);
  await page
    .getByRole("button", { name: "Create Recipe", exact: true })
    .click();

  await expect(page).toHaveURL("/admin/recipes?success=created");
  await expect(page.getByRole("status")).toHaveText("Recipe created.");
  await expect(recordRow(page, data.name)).toBeVisible();
}

test("creating a recipe with a valid PNG stores, serves, and renders it", async ({
  page,
}) => {
  const RECIPE = {
    name: "Test E2E Recipe Image",
    slug: "test-e2e-recipe-image",
  };
  await createRecipeWithImage(page, RECIPE, PNG_FIXTURE);

  // The database stores a generated recipes/ object path (boolean-only
  // assertions keep the path out of test output).
  const objectPath = await readRecipeImagePath(RECIPE.slug);
  expect(objectPath !== null).toBe(true);
  expect(/^recipes\/[a-z0-9-]+\.png$/.test(objectPath as string)).toBe(true);

  // That exact object exists and is publicly readable as a PNG.
  expect(await recipeImageObjectExists(objectPath as string)).toBe(true);
  const contentType = await fetchRecipeImageContentType(objectPath as string);
  expect(contentType !== null && contentType.includes("image/png")).toBe(true);

  // Admin rendering: the edit form's current-image preview displays it.
  await page.goto(`/admin/recipes/${RECIPE.slug}/edit`);
  await expectRenderedImage(page, `Current image for ${RECIPE.name}`);

  // Public detail page renders the image instead of the fallback.
  await page.goto(`/recipes/${RECIPE.slug}`);
  await expectRenderedImage(page, `Image of ${RECIPE.name}`);
  await expect(page.getByText("No image available")).toHaveCount(0);

  // Public list card renders the image as well.
  await page.goto("/recipes");
  await expectRenderedImage(page, `Image of ${RECIPE.name}`);
});

test("replacing the recipe image stores a new object and removes the old one", async ({
  page,
}) => {
  const RECIPE = {
    name: "Test E2E Recipe Image Replace",
    slug: "test-e2e-recipe-image-replace",
  };
  await createRecipeWithImage(page, RECIPE, PNG_FIXTURE);

  const originalPath = await readRecipeImagePath(RECIPE.slug);
  expect(originalPath !== null).toBe(true);
  expect(await recipeImageObjectExists(originalPath as string)).toBe(true);

  // Real General edit form: attach the WebP replacement, leave the
  // remove control untouched, keep every other prefilled field as
  // loaded. Ingredients live on their own tab now (Slice 9C.3) and are
  // untouched by this General-only save.
  await page.goto(`/admin/recipes/${RECIPE.slug}/edit`);
  await page
    .locator('input[name="image"]')
    .setInputFiles(WEBP_FIXTURE);
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();

  await expect(page).toHaveURL("/admin/recipes?success=updated");
  await expect(page.getByRole("status")).toHaveText("Recipe updated.");

  // A different generated path is stored; the new exact object exists and
  // serves WebP; the old exact object is gone (deleted only after the
  // database update succeeded — the row already references the new path).
  const newPath = await readRecipeImagePath(RECIPE.slug);
  expect(newPath !== null).toBe(true);
  expect(newPath !== originalPath).toBe(true);
  expect(/^recipes\/[a-z0-9-]+\.webp$/.test(newPath as string)).toBe(true);
  expect(await recipeImageObjectExists(newPath as string)).toBe(true);
  const newContentType = await fetchRecipeImageContentType(newPath as string);
  expect(
    newContentType !== null && newContentType.includes("image/webp")
  ).toBe(true);
  expect(await recipeImageObjectExists(originalPath as string)).toBe(false);

  // Admin and public rendering now use the replacement image.
  await page.goto(`/admin/recipes/${RECIPE.slug}/edit`);
  await expectRenderedImage(page, `Current image for ${RECIPE.name}`);
  await page.goto(`/recipes/${RECIPE.slug}`);
  await expectRenderedImage(page, `Image of ${RECIPE.name}`);
});

test("removing the recipe image clears the row, deletes the object, and restores the fallback", async ({
  page,
}) => {
  const RECIPE = {
    name: "Test E2E Recipe Image Remove",
    slug: "test-e2e-recipe-image-remove",
  };
  await createRecipeWithImage(page, RECIPE, PNG_FIXTURE);

  const objectPath = await readRecipeImagePath(RECIPE.slug);
  expect(objectPath !== null).toBe(true);

  // The removal checkbox itself is visually hidden (screen-reader pattern);
  // its accessible label is the visible toggle, and checking it reveals the
  // confirmation note. No replacement file is attached.
  await page.goto(`/admin/recipes/${RECIPE.slug}/edit`);
  await page.getByTitle("Remove image").click();
  await expect(
    page.getByRole("checkbox", { name: "Remove image" })
  ).toBeChecked();
  await expect(
    page.getByText("Image will be removed when saved.")
  ).toBeVisible();
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();

  await expect(page).toHaveURL("/admin/recipes?success=updated");
  await expect(page.getByRole("status")).toHaveText("Recipe updated.");

  // The database image field is null and the exact previous object is gone.
  expect(await readRecipeImagePath(RECIPE.slug)).toBeNull();
  expect(await recipeImageObjectExists(objectPath as string)).toBe(false);

  // The public detail page shows the no-image fallback again.
  await page.goto(`/recipes/${RECIPE.slug}`);
  await expect(page.getByText("No image available")).toBeVisible();
  await expect(
    page.getByRole("img", { name: `Image of ${RECIPE.name}`, exact: true })
  ).toHaveCount(0);
});

test("choosing a replacement and removal together is rejected without changes", async ({
  page,
}) => {
  const RECIPE = {
    name: "Test E2E Recipe Image Conflict",
    slug: "test-e2e-recipe-image-conflict",
  };
  await createRecipeWithImage(page, RECIPE, PNG_FIXTURE);

  const objectPath = await readRecipeImagePath(RECIPE.slug);
  expect(objectPath !== null).toBe(true);

  // Both a replacement file AND the remove control: the action rejects the
  // conflicting intent before any upload or deletion happens.
  await page.goto(`/admin/recipes/${RECIPE.slug}/edit`);
  await page.getByTitle("Remove image").click();
  await page
    .locator('input[name="image"]')
    .setInputFiles(WEBP_FIXTURE);
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();

  await expect(page).toHaveURL(
    `/admin/recipes/${RECIPE.slug}/edit?error=conflicting_image_input`
  );
  await expect(
    page
      .getByRole("alert")
      .filter({
        hasText:
          "Choose either a replacement image or Remove current image, not both.",
      })
  ).toBeVisible();

  // The stored path is unchanged and its exact object still exists.
  expect(await readRecipeImagePath(RECIPE.slug)).toBe(objectPath);
  expect(await recipeImageObjectExists(objectPath as string)).toBe(true);
});

test("an unsupported file type is rejected and nothing is written", async ({
  page,
}) => {
  // setInputFiles bypasses the accept picker hint (which is not
  // validation), so the submission reaches the server-side type check with
  // otherwise fully valid Recipe fields.
  await fillMinimalRecipeForm(
    page,
    {
      name: "Test E2E Recipe Image Invalid",
      slug: "test-e2e-recipe-image-invalid",
    },
    TEXT_FIXTURE
  );
  await page
    .getByRole("button", { name: "Create Recipe", exact: true })
    .click();

  await expect(page).toHaveURL("/admin/recipes/new?error=invalid_image_type");
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Only PNG, JPEG, and WebP images are allowed." })
  ).toBeVisible();

  // No Recipe row and no ingredient row were created; the action validates
  // before uploading, so no object was written either (also proven by the
  // suite-level folder baseline in the preservation test).
  expect(await countE2eTestRecipeImageRecords()).toBe(0);
  expect(await countE2eTestRecipeImageIngredientRows()).toBe(0);
});

test("an oversized image is rejected and nothing is written", async ({
  page,
}) => {
  // One byte over the 5 MB limit, generated in the OS temporary directory
  // (never committed) with an allowed extension/MIME so only the size check
  // can reject it. The application's server-action body limit (6 MB) still
  // admits the request, so the readable size error is exercised.
  const oversizedPath = path.join(
    os.tmpdir(),
    `test-e2e-recipe-image-oversized-${Date.now()}.png`
  );
  fs.writeFileSync(oversizedPath, Buffer.alloc(5 * 1024 * 1024 + 1));

  try {
    await fillMinimalRecipeForm(
      page,
      {
        name: "Test E2E Recipe Image Oversized",
        slug: "test-e2e-recipe-image-oversized",
      },
      oversizedPath
    );
    await page
      .getByRole("button", { name: "Create Recipe", exact: true })
      .click();

    await expect(page).toHaveURL("/admin/recipes/new?error=image_too_large");
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "The image must be 5 MB or smaller." })
    ).toBeVisible();

    expect(await countE2eTestRecipeImageRecords()).toBe(0);
    expect(await countE2eTestRecipeImageIngredientRows()).toBe(0);
  } finally {
    fs.unlinkSync(oversizedPath);
  }
});

test("deleting the recipe also deletes its stored image object and cascades its ingredients", async ({
  page,
}) => {
  const RECIPE = {
    name: "Test E2E Recipe Image Delete",
    slug: "test-e2e-recipe-image-delete",
  };
  await createRecipeWithImage(page, RECIPE, PNG_FIXTURE);

  const objectPath = await readRecipeImagePath(RECIPE.slug);
  expect(objectPath !== null).toBe(true);
  expect(await recipeImageObjectExists(objectPath as string)).toBe(true);
  // The temporary recipe owns exactly one ingredient row before deletion.
  expect(await countE2eTestRecipeImageIngredientRows()).toBe(1);

  // Real confirmation flow; the plain "Recipe deleted." message also proves
  // the image cleanup succeeded (a failed cleanup uses a distinct message).
  // Delete is reached from the edit page's toolbar (the old table's
  // per-row Delete link is gone).
  await recordRow(page, RECIPE.name).click();
  await expect(page).toHaveURL(`/admin/recipes/${RECIPE.slug}/edit`);
  await page.getByRole("link", { name: "Delete Recipe", exact: true }).click();
  await expect(page).toHaveURL(`/admin/recipes/${RECIPE.slug}/delete`);
  await page
    .getByRole("button", { name: "Delete Permanently", exact: true })
    .click();

  await expect(page).toHaveURL("/admin/recipes?success=deleted");
  await expect(page.getByRole("status")).toHaveText("Recipe deleted.");
  await expect(recordRow(page, RECIPE.name)).toHaveCount(0);

  // The row is gone, its ingredient rows fell to the cascade (seeded
  // ingredient rows are untouched), and so is its exact Storage object.
  expect(await countE2eTestRecipeImageRecords()).toBe(0);
  expect(await countE2eTestRecipeImageIngredientRows()).toBe(0);
  expect((await readFixtureCounts()).recipeIngredients).toBe(15);
  expect(await recipeImageObjectExists(objectPath as string)).toBe(false);
});

test("seeded fixtures are preserved and no suite row or object remains", async () => {
  expect(await readFixtureCounts()).toEqual({
    categories: 5,
    professions: 10,
    items: 16,
    recipes: 8,
    recipeIngredients: 15,
  });
  expect(await countE2eTestRecipeImageRecords()).toBe(0);
  expect(await countE2eTestRecipeImageIngredientRows()).toBe(0);
  // The recipes/ folder holds exactly as many objects as before the suite:
  // nothing was orphaned by any create, replace, remove, reject, conflict,
  // or delete.
  expect(await countRecipeFolderObjects()).toBe(recipeFolderBaseline);
});
