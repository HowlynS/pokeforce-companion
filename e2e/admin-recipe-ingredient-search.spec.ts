// Focused E2E coverage for SearchableAdminSelect on Recipe ingredient item
// fields (Admin Polish Pass 1, Part 3). Field-level correctness (the right
// value submits, dirty/draft/revert) is proven elsewhere via
// e2e/helpers/admin-select.ts's own click-based selection; this spec adds
// what that doesn't: the internal search field's live filtering, keyboard
// navigation over FILTERED results, no-results state, ingredient-row
// isolation, and draft restoration preserving the selected value (never
// the search query, which is pure local UI state).

import { expect, test, type Page } from "@playwright/test";
import { deleteE2eTestRecipeRecords } from "./helpers/database-cleanup";

let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.beforeAll(async () => {
  await deleteE2eTestRecipeRecords();
});

test.afterEach(async () => {
  await deleteE2eTestRecipeRecords();
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

test.afterAll(async () => {
  expect(await deleteE2eTestRecipeRecords()).toBe(0);
});

function ingredientGroup(page: Page) {
  return page.getByRole("group", { name: "Ingredients (fill at least one row)" });
}

function status(page: Page) {
  return page.getByText("Unsaved changes", { exact: true });
}

test("the search field appears only once the dropdown opens, and is focused immediately", async ({
  page,
}) => {
  await page.goto("/admin/recipes/new");
  const row0 = ingredientGroup(page).getByRole("combobox").nth(0);

  await expect(page.locator(".searchable-admin-select-search-input")).toHaveCount(0);
  await row0.click();
  await expect(page.locator(".searchable-admin-select-search-input")).toBeFocused();
});

test("typing filters live, case-insensitively and with surrounding whitespace trimmed; clearing restores the full list", async ({
  page,
}) => {
  await page.goto("/admin/recipes/new");
  const row0 = ingredientGroup(page).getByRole("combobox").nth(0);
  await row0.click();

  await page.keyboard.type("  IRON ORE  ");
  await expect(page.getByRole("option", { name: "Iron Ore", exact: true })).toBeVisible();
  await expect(page.getByRole("option", { name: "Copper Ore", exact: true })).toHaveCount(0);

  await page.locator(".searchable-admin-select-search-input").fill("");
  await expect(page.getByRole("option", { name: "Copper Ore", exact: true })).toBeVisible();
  await expect(page.getByRole("option", { name: "No ingredient", exact: true })).toBeVisible();
});

test("a query matching nothing shows the compact no-results state", async ({ page }) => {
  await page.goto("/admin/recipes/new");
  const row0 = ingredientGroup(page).getByRole("combobox").nth(0);
  await row0.click();
  await page.keyboard.type("zzzznotarealitem");
  await expect(page.getByText("No items match your search.")).toBeVisible();
});

test("Arrow Down/Up and Enter select from the FILTERED list, not the full list", async ({
  page,
}) => {
  await page.goto("/admin/recipes/new");
  const row0 = ingredientGroup(page).getByRole("combobox").nth(0);
  await row0.click();
  await page.keyboard.type("iron ore");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(row0).toContainText("Iron Ore");
});

test("Escape closes the dropdown without corrupting the already-committed value", async ({
  page,
}) => {
  await page.goto("/admin/recipes/new");
  const row0 = ingredientGroup(page).getByRole("combobox").nth(0);
  await row0.click();
  await page.keyboard.type("iron ore");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(row0).toContainText("Iron Ore");

  await row0.click();
  await page.keyboard.type("copper");
  await page.keyboard.press("Escape");
  await expect(row0).toContainText("Iron Ore");
});

test("searching does not mark the form dirty; selecting an ingredient does", async ({
  page,
}) => {
  await page.goto("/admin/recipes/new");
  const row0 = ingredientGroup(page).getByRole("combobox").nth(0);
  await row0.click();
  await page.keyboard.type("iron");
  await expect(status(page)).toHaveCount(0);

  await page.keyboard.press("Escape");
  await row0.click();
  await page.keyboard.type("iron ore");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(status(page)).toBeVisible();
});

test("each ingredient row's search/selection is fully isolated from the others", async ({
  page,
}) => {
  await page.goto("/admin/recipes/new");
  const group = ingredientGroup(page);
  const row0 = group.getByRole("combobox").nth(0);
  const row1 = group.getByRole("combobox").nth(1);

  await row0.click();
  await page.keyboard.type("iron ore");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(row0).toContainText("Iron Ore");
  await expect(row1).toContainText("No ingredient");

  await row1.click();
  await page.keyboard.type("copper ore");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(row1).toContainText("Copper Ore");
  await expect(row0).toContainText("Iron Ore");
});

test("Item thumbnails remain visible inside the search results", async ({ page }) => {
  await page.goto("/admin/recipes/new");
  const row0 = ingredientGroup(page).getByRole("combobox").nth(0);
  await row0.click();
  await expect(page.locator(".resource-icon").first()).toBeVisible();
});

test("draft restoration preserves the selected ingredient, never the search query", async ({
  page,
}) => {
  await page.goto("/admin/recipes/new");
  await page.getByLabel("Name", { exact: true }).fill("Test E2E Recipe Ingredient Draft");
  await page
    .getByLabel(/^Page address/)
    .fill("test-e2e-recipe-ingredient-draft");

  const group = ingredientGroup(page);
  const row0 = group.getByRole("combobox").nth(0);
  await row0.click();
  await page.keyboard.type("iron ore");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(row0).toContainText("Iron Ore");

  // Reload without saving — the draft-recovery prompt should offer to
  // restore the selected ingredient.
  await page.reload();
  const restore = page.getByRole("button", { name: "Restore draft", exact: true });
  await expect(restore).toBeVisible();
  await restore.click();

  await expect(row0).toContainText("Iron Ore");
  // The search input itself carries no name and is never part of the
  // draft — only the underlying selection is restorable.
  await expect(page.locator(".searchable-admin-select-search-input")).toHaveCount(0);
});
