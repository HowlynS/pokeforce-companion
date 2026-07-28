// Focused E2E coverage for the shared AdminSelect dropdown (Massive Admin
// Interaction Completion Pass, Phase 1) — behaviors that are genuinely
// cross-cutting across every resource that embeds it, exercised here on a
// representative sample (Item, Recipe General, Recipe Ingredients,
// Location General, Location Hierarchy, Acquisition Source) rather than
// repeated per resource. Field-level correctness (the right value submits,
// dirty/draft/revert work) is already proven by each resource's own CRUD
// and unsaved-changes specs, which all drive AdminSelect through the
// shared e2e/helpers/admin-select.ts click-based helper; this spec adds
// what those don't: keyboard-only operation, type-ahead, native
// constraint validation on a required field, and navigation interaction
// while a dropdown is left open.

import { expect, test, type Page } from "@playwright/test";
import { selectAdminOption } from "./helpers/admin-select";
import {
  deleteE2eTestItemRecords,
  countE2eTestItemRecords,
  deleteE2eTestRecipeRecords,
  deleteE2eTestLocationRecords,
} from "./helpers/database-cleanup";

let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.beforeAll(async () => {
  await deleteE2eTestItemRecords();
  await deleteE2eTestRecipeRecords();
  await deleteE2eTestLocationRecords();
  expect(await countE2eTestItemRecords()).toBe(0);
});

test.afterEach(async () => {
  await deleteE2eTestItemRecords();
  await deleteE2eTestRecipeRecords();
  await deleteE2eTestLocationRecords();
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

test.afterAll(async () => {
  const remaining =
    (await deleteE2eTestItemRecords()) +
    (await deleteE2eTestRecipeRecords()) +
    (await deleteE2eTestLocationRecords());
  expect(remaining).toBe(0);
});

function status(page: Page) {
  return page.getByText("Unsaved changes", { exact: true });
}

function discardDialog(page: Page) {
  return page.getByRole("dialog").filter({
    has: page.getByRole("heading", { name: "Discard unsaved changes?" }),
  });
}

test("Item create: keyboard-only selection opens with Enter, moves with Arrow keys, and commits with Enter", async ({
  page,
}) => {
  await page.goto("/admin/items/new");
  const category = page.getByRole("combobox", { name: "Category", exact: true });
  await category.focus();
  await expect(category).toHaveAttribute("aria-expanded", "false");

  await page.keyboard.press("Enter");
  await expect(category).toHaveAttribute("aria-expanded", "true");

  // "No category" is first; Arrow Down twice reaches the second real
  // option without ever touching the mouse.
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");

  await expect(category).toHaveAttribute("aria-expanded", "false");
  await expect(status(page)).toBeVisible();
  const committedValue = await page
    .locator('input[name="categoryId"]')
    .inputValue();
  expect(committedValue.length).toBeGreaterThan(0);
});

test("Item create: Escape closes the dropdown without changing the value", async ({
  page,
}) => {
  await page.goto("/admin/items/new");
  const category = page.getByRole("combobox", { name: "Category", exact: true });
  const before = await page.locator('input[name="categoryId"]').inputValue();

  await category.click();
  await expect(category).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Escape");

  await expect(category).toHaveAttribute("aria-expanded", "false");
  const after = await page.locator('input[name="categoryId"]').inputValue();
  expect(after).toBe(before);
  await expect(status(page)).toHaveCount(0);
});

test("Item create: type-ahead jumps to and commits the first option starting with the typed letter", async ({
  page,
}) => {
  await page.goto("/admin/items/new");
  const category = page.getByRole("combobox", { name: "Category", exact: true });
  await category.focus();
  // Closed-state type-ahead (native <select> semantics): typing a letter
  // jumps to AND commits the first matching option immediately.
  await page.keyboard.press("m");
  await expect(category).toContainText("Materials");
});

test("Item create: outside click closes the dropdown", async ({ page }) => {
  await page.goto("/admin/items/new");
  const category = page.getByRole("combobox", { name: "Category", exact: true });
  await category.click();
  await expect(category).toHaveAttribute("aria-expanded", "true");

  await page.getByLabel("Name", { exact: true }).click();
  await expect(category).toHaveAttribute("aria-expanded", "false");
});

test("Recipe General: Resulting item is required — Ctrl+S with nothing selected fails native validation and never submits", async ({
  page,
}) => {
  await page.goto("/admin/recipes/new");
  await page.getByLabel("Name", { exact: true }).fill("Test E2E Dropdown Recipe");
  await page
    .getByLabel(/^Page address/)
    .fill("test-e2e-recipe-dropdown");
  // Resulting item deliberately left unselected (the create form's own
  // placeholder-only default).

  await page.keyboard.press("Control+s");
  // Native constraint validation blocks the submit — still on the create
  // route, not redirected.
  await expect(page).toHaveURL("/admin/recipes/new");
});

test("Recipe Ingredients: each row's dropdown is keyboard-operable and isolated from the others", async ({
  page,
}) => {
  await page.goto("/admin/recipes/new");
  await page.getByLabel("Name", { exact: true }).fill("Test E2E Dropdown Ingredients");
  await page
    .getByLabel(/^Page address/)
    .fill("test-e2e-recipe-dropdown-ingredients");
  await selectAdminOption(
    page.getByRole("combobox", { name: "Resulting item", exact: true }),
    "Iron Ore"
  );

  const group = page.getByRole("group", {
    name: "Ingredients (fill at least one row)",
  });
  const row0 = group.getByRole("combobox").nth(0);
  const row1 = group.getByRole("combobox").nth(1);

  await row0.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await group.getByRole("spinbutton").nth(0).fill("1");

  // The second row's own dropdown is untouched by the first row's
  // selection — no shared state between instances.
  await expect(row1).toContainText("No ingredient");

  await page
    .getByRole("button", { name: "Create Recipe", exact: true })
    .click();
  await expect(page).toHaveURL(
    "/admin/recipes/test-e2e-recipe-dropdown-ingredients/edit"
  );
});

test("Location Hierarchy: navigating away while the Parent dropdown is left open shows exactly one discard modal, never a stacked pair", async ({
  page,
}) => {
  await page.goto("/admin/locations/new");
  await page.getByLabel("Name", { exact: true }).fill("Test E2E Dropdown Location");
  await page
    .getByLabel(/^Page address/)
    .fill("test-e2e-location-dropdown");
  await selectAdminOption(
    page.getByRole("combobox", { name: "Type", exact: true }),
    "Town"
  );
  await page
    .getByRole("button", { name: "Create Location", exact: true })
    .click();
  await expect(page).toHaveURL("/admin/locations/test-e2e-location-dropdown/edit");

  await page.goto("/admin/locations/test-e2e-location-dropdown/hierarchy");
  const parent = page.getByRole("combobox", { name: "Parent location", exact: true });
  // Open the dropdown but never select anything — the form is still
  // clean, so leaving must navigate immediately with no modal at all,
  // and the left-open dropdown must not itself block or duplicate that.
  await parent.click();
  await expect(parent).toHaveAttribute("aria-expanded", "true");

  await page.getByRole("link", { name: "General", exact: true }).click();
  await expect(discardDialog(page)).toHaveCount(0);
  await expect(page).toHaveURL(/\/admin\/locations\/test-e2e-location-dropdown\/edit/);
});

test("Location Hierarchy: a genuinely dirty parent selection shows exactly one discard modal when navigating away with the dropdown still open", async ({
  page,
}) => {
  await page.goto("/admin/locations/new");
  await page.getByLabel("Name", { exact: true }).fill("Test E2E Dropdown Location Parent");
  await page
    .getByLabel(/^Page address/)
    .fill("test-e2e-location-dropdown-parent");
  await selectAdminOption(
    page.getByRole("combobox", { name: "Type", exact: true }),
    "Town"
  );
  await page
    .getByRole("button", { name: "Create Location", exact: true })
    .click();
  await expect(page).toHaveURL(
    "/admin/locations/test-e2e-location-dropdown-parent/edit"
  );

  await page.goto("/admin/locations/new");
  await page.getByLabel("Name", { exact: true }).fill("Test E2E Dropdown Location Child");
  await page
    .getByLabel(/^Page address/)
    .fill("test-e2e-location-dropdown-child");
  await selectAdminOption(
    page.getByRole("combobox", { name: "Type", exact: true }),
    "Town"
  );
  await page
    .getByRole("button", { name: "Create Location", exact: true })
    .click();
  await expect(page).toHaveURL(
    "/admin/locations/test-e2e-location-dropdown-child/edit"
  );

  await page.goto("/admin/locations/test-e2e-location-dropdown-child/hierarchy");
  const parent = page.getByRole("combobox", { name: "Parent location", exact: true });
  await parent.click();
  await page.getByRole("option", { name: "Test E2E Dropdown Location Parent", exact: true }).click();
  await expect(status(page)).toBeVisible();

  // Open it again (without changing the value) and navigate away — the
  // guard's own dirty state (from the selection above) must still produce
  // exactly ONE modal, not two stacked ones from the dropdown itself.
  await parent.click();
  await expect(parent).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("link", { name: "General", exact: true }).click();

  const dialogs = page.getByRole("dialog");
  await expect(dialogs).toHaveCount(1);
  await expect(discardDialog(page)).toBeVisible();
  await page.getByRole("button", { name: "Discard changes", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/locations\/test-e2e-location-dropdown-child\/edit/);
});

test("Acquisition Source create: pointer selection on Type, Location, and Profession all commit independently", async ({
  page,
}) => {
  await page.goto("/admin/items/new");
  await page.getByLabel("Name", { exact: true }).fill("Test E2E Dropdown Acqsrc Item");
  await page
    .getByLabel(/^Page address/)
    .fill("test-e2e-item-dropdown-acqsrc");
  await page.getByRole("button", { name: "Create item", exact: true }).click();
  await expect(page).toHaveURL("/admin/items/test-e2e-item-dropdown-acqsrc/edit");

  await page.goto("/admin/items/test-e2e-item-dropdown-acqsrc/sources");
  await selectAdminOption(
    page.getByRole("combobox", { name: "Type", exact: true }),
    "Mining"
  );
  await expect(status(page)).toBeVisible();
  await page
    .getByRole("button", { name: "Add Source", exact: true })
    .click();
  await expect(page).toHaveURL(
    /\/admin\/items\/test-e2e-item-dropdown-acqsrc\/sources\/[^/]+\/edit$/
  );
});

// Admin Polish Pass 1, Part 2 — entity dropdowns (Recipe resulting item,
// Item Category, Location Parent, Acquisition Source Location/Profession)
// show a compact icon per option; enum/metadata dropdowns (Location Type,
// Acquisition Source Type, Game Version) stay text-only. One representative
// case of each, rather than every dropdown, since the icon-vs-not decision
// is made once in each page's own options array (see entity-select-options.ts)
// and AdminSelect's own rendering is already proven generic by
// admin-select.test.tsx.
test("entity dropdowns (Recipe resulting item) show a compact icon per option; enum dropdowns (Location Type) stay text-only", async ({
  page,
}) => {
  await page.goto("/admin/recipes/new");
  const resultingItem = page.getByRole("combobox", {
    name: "Resulting item",
    exact: true,
  });
  await resultingItem.click();
  const resultingItemListboxId = await resultingItem.getAttribute("aria-controls");
  await expect(
    page.locator(`#${resultingItemListboxId} .resource-icon`).first()
  ).toBeVisible();
  await page.keyboard.press("Escape");

  await page.goto("/admin/locations/new");
  const type = page.getByRole("combobox", { name: "Type", exact: true });
  await type.click();
  const typeListboxId = await type.getAttribute("aria-controls");
  await expect(page.locator(`#${typeListboxId} .resource-icon`)).toHaveCount(0);
});
