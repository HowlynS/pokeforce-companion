// Focused E2E coverage for the Sonnet Rollout Pass's Recipe adoption of the
// shared AdminFormGuard (General, Ingredients). Mirrors the Item pilot
// (e2e/admin-item-unsaved-changes.spec.ts) but trimmed to what is specific
// to Recipe: quantity-tooltip/dirty independence, ingredient-row tracking,
// and draft isolation between the General and Ingredients tabs of the same
// recipe. The shared guard mechanics themselves (modal semantics, history,
// Ctrl+S plumbing) are already proven by the Item spec and are not
// re-verified exhaustively here.

import { expect, test, type Page } from "@playwright/test";
import {
  deleteE2eTestRecipeRecords,
  countE2eTestRecipeRecords,
} from "./helpers/database-cleanup";

let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.beforeAll(async () => {
  await deleteE2eTestRecipeRecords();
  expect(await countE2eTestRecipeRecords()).toBe(0);
});

test.afterEach(async () => {
  await deleteE2eTestRecipeRecords();
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

test.afterAll(async () => {
  expect(await deleteE2eTestRecipeRecords()).toBe(0);
});

function status(page: Page) {
  return page.getByText("Unsaved changes", { exact: true });
}

function discardDialog(page: Page) {
  return page.getByRole("dialog").filter({
    has: page.getByRole("heading", { name: "Discard unsaved changes?" }),
  });
}

async function createTempRecipe(
  page: Page,
  name: string,
  slug: string
): Promise<string> {
  await page.goto("/admin/recipes/new");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel(/^Page address/).fill(slug);
  await page
    .getByRole("combobox", { name: "Resulting item", exact: true })
    .selectOption({ label: "Iron Ore" });
  await page
    .locator('select[name="ingredientItemId1"]')
    .selectOption({ label: "Iron Ingot" });
  await page.locator('input[name="ingredientQuantity1"]').fill("1");
  await page
    .getByRole("button", { name: "Create Recipe", exact: true })
    .click();
  await expect(page).toHaveURL("/admin/recipes?success=created");
  return slug;
}

test("General: a meaningful edit marks dirty and reverting returns to clean", async ({
  page,
}) => {
  const slug = await createTempRecipe(
    page,
    "Test E2E Recipe Guard General",
    "test-e2e-recipe-guard-general"
  );
  await page.goto(`/admin/recipes/${slug}/edit`);
  await expect(status(page)).toHaveCount(0);

  const nameField = page.getByLabel("Name", { exact: true });
  await nameField.fill("Test E2E Recipe Guard General Edited");
  await expect(status(page)).toBeVisible();

  await nameField.fill("Test E2E Recipe Guard General");
  await expect(status(page)).toHaveCount(0);
});

test("General: opening the Minimum/Maximum quantity tooltip does not mark the form dirty", async ({
  page,
}) => {
  const slug = await createTempRecipe(
    page,
    "Test E2E Recipe Guard Tooltip",
    "test-e2e-recipe-guard-tooltip"
  );
  await page.goto(`/admin/recipes/${slug}/edit`);
  await expect(status(page)).toHaveCount(0);

  await page
    .getByRole("button", { name: "More information about Minimum quantity" })
    .focus();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await expect(status(page)).toHaveCount(0);

  // A genuine quantity change still marks dirty, and reverting clears it.
  const minField = page.getByLabel("Minimum quantity", { exact: true });
  await minField.fill("2");
  await expect(status(page)).toBeVisible();
  await minField.fill("1");
  await expect(status(page)).toHaveCount(0);
});

test("General: dirty Cancel prompts, Keep editing preserves values, Discard leaves", async ({
  page,
}) => {
  const slug = await createTempRecipe(
    page,
    "Test E2E Recipe Guard Cancel",
    "test-e2e-recipe-guard-cancel"
  );
  await page.goto(`/admin/recipes/${slug}/edit`);

  await page
    .getByLabel("Name", { exact: true })
    .fill("Test E2E Recipe Guard Cancel Edited");
  await expect(status(page)).toBeVisible();

  await page.getByRole("link", { name: "Cancel", exact: true }).click();
  await expect(discardDialog(page)).toBeVisible();

  await page.getByRole("button", { name: "Keep editing", exact: true }).click();
  await expect(page).toHaveURL(`/admin/recipes/${slug}/edit`);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Test E2E Recipe Guard Cancel Edited"
  );

  await page.getByRole("link", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Discard changes", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/recipes(\?|$)/);
});

test("General: Ctrl+S saves a valid form", async ({ page }) => {
  const slug = await createTempRecipe(
    page,
    "Test E2E Recipe Guard Save",
    "test-e2e-recipe-guard-save"
  );
  await page.goto(`/admin/recipes/${slug}/edit`);

  await page
    .getByLabel("Required level (optional)", { exact: true })
    .fill("5");
  await expect(status(page)).toBeVisible();

  await page.keyboard.press("Control+s");
  await expect(page).toHaveURL(/\/admin\/recipes\?success=updated/);
});

test("Ingredients: the freshly loaded row is never dirty, a quantity change marks dirty, and reverting to the loaded value clears it", async ({
  page,
}) => {
  // createTempRecipe's own ingredient row (Iron Ingot, quantity 1) becomes
  // this tab's loaded baseline — a fresh visit must not read as dirty just
  // because a row is populated.
  const slug = await createTempRecipe(
    page,
    "Test E2E Recipe Guard Ingredients",
    "test-e2e-recipe-guard-ingredients"
  );
  await page.goto(`/admin/recipes/${slug}/ingredients`);
  await expect(status(page)).toHaveCount(0);

  const firstQuantity = page.locator('input[name="ingredientQuantity1"]');
  await expect(firstQuantity).toHaveValue("1");

  await firstQuantity.fill("3");
  await expect(status(page)).toBeVisible();

  await firstQuantity.fill("1");
  await expect(status(page)).toHaveCount(0);
});

test("General and Ingredients keep separate drafts for the same recipe", async ({
  page,
}) => {
  const slug = await createTempRecipe(
    page,
    "Test E2E Recipe Guard Isolation",
    "test-e2e-recipe-guard-isolation"
  );

  await page.goto(`/admin/recipes/${slug}/edit`);
  await page
    .getByLabel("Name", { exact: true })
    .fill("Test E2E Recipe Guard Isolation General Dirty");
  await expect(status(page)).toBeVisible();

  // Switching to the Ingredients tab is a real navigation the guard
  // intercepts (dirty General) — Discard proceeds to Ingredients, which
  // starts clean: the two tabs' drafts never leak into each other.
  await page.getByRole("link", { name: "Ingredients", exact: true }).click();
  await expect(discardDialog(page)).toBeVisible();
  await page.getByRole("button", { name: "Discard changes", exact: true }).click();
  await expect(page).toHaveURL(`/admin/recipes/${slug}/ingredients`);
  await expect(status(page)).toHaveCount(0);
});
