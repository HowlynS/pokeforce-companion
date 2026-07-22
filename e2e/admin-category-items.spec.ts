// Authenticated coverage for the Category Items tab (Slice 9E.3): a
// real, read-only tab inside the Category workspace showing every Item
// linked to the selected Category, each linking to the EXISTING Item
// admin edit route. No inline item editing, unlink control, or
// create-item form exists on this tab, so there is nothing here that
// duplicates admin-items.spec.ts's own CRUD coverage. Mirrors
// admin-profession-recipes.spec.ts's (Slice 9D.3) structure exactly,
// adapted to a single relationship direction (Category -> Item).
//
// Runs in the chromium-admin project with the storage state saved by
// auth.setup.ts. Every temporary Category uses the test-e2e-category
// slug prefix; the Item fixtures reuse the existing
// test-e2e-category-relation- DB helpers already relied on by
// admin-categories.spec.ts's blocked-deletion test, so cleanup
// (deleteE2eTestCategories) is already guard-first and exhaustive — no
// new cleanup surface is introduced.

import { expect, test, type Page } from "@playwright/test";
import {
  countE2eTestCategories,
  createTemporaryItemForCategoryItemsTab,
  deleteE2eTestCategories,
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
  await deleteE2eTestCategories();
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

test.beforeAll(async () => {
  await deleteE2eTestCategories();
  expect(await countE2eTestCategories()).toBe(0);
});

test.afterAll(async () => {
  const remaining = await deleteE2eTestCategories();
  expect(remaining).toBe(0);
});

// One row of the shared Category record list, located by its exact
// primary text inside the list's navigation landmark.
function recordRow(page: Page, name: string) {
  return page
    .getByRole("navigation", { name: "Categories records" })
    .getByRole("link")
    .filter({ has: page.getByText(name, { exact: true }) });
}

function tabNav(page: Page) {
  return page.getByRole("navigation", { name: "Category editor sections" });
}

async function createTemporaryCategory(
  page: Page,
  data: { name: string; slug: string }
) {
  await page.goto("/admin/categories/new");
  await page.getByLabel("Name", { exact: true }).fill(data.name);
  await page.getByLabel(/^Page address/).fill(data.slug);
  await page
    .getByRole("button", { name: "Create Category", exact: true })
    .click();
  await expect(page).toHaveURL("/admin/categories?success=created");
}

test("opening the Items tab directly shows the linked items inside the Category workspace", async ({
  page,
}) => {
  const CATEGORY = {
    name: "Test E2E Category Items Tab",
    slug: "test-e2e-category-items-tab",
  };
  await createTemporaryCategory(page, CATEGORY);
  // Created out of alphabetical order, so the page's own ordering — not
  // insertion order — is what determines row order. Only the second
  // item carries a base value, proving the hide-empty behavior.
  await createTemporaryItemForCategoryItemsTab(CATEGORY.slug, {
    suffix: "zeta",
    itemName: "Zeta Test E2E Category Items Tab Item",
    heldItem: false,
    tradeable: true,
  });
  await createTemporaryItemForCategoryItemsTab(CATEGORY.slug, {
    suffix: "alpha",
    itemName: "Alpha Test E2E Category Items Tab Item",
    heldItem: true,
    tradeable: false,
    baseValue: 15,
  });

  await page.goto(`/admin/categories/${CATEGORY.slug}/items`);

  // One h1: the category's own name; the record list stays visible with
  // this category selected; the Items tab is marked active.
  await expect(
    page.getByRole("heading", { level: 1, name: CATEGORY.name, exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Categories records" })
  ).toBeVisible();
  await expect(recordRow(page, CATEGORY.name)).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(
    tabNav(page).getByRole("link", { name: "Items", exact: true })
  ).toHaveAttribute("aria-current", "page");

  // Relationship-count badge (Phase B sub-slice): the active Items tab
  // shows its own count (2 linked items), while General carries no badge
  // at all. The badge is aria-hidden, so the exact-name role query above
  // keeps matching the tab by its plain label alone.
  await expect(
    tabNav(page).getByRole("link", { name: "Items", exact: true })
  ).toContainText("2");
  await expect(
    tabNav(page).getByRole("link", { name: "General", exact: true })
  ).not.toContainText(/[0-9]/);

  const table = page.getByRole("table");
  await expect(table).toBeVisible();
  const rows = table.getByRole("row");
  // Header row plus exactly two data rows.
  await expect(rows).toHaveCount(3);

  // Alphabetical order: "Alpha..." renders before "Zeta...", even though
  // it was created second. The item name is located via its LINK (the
  // cell's own accessible name also concatenates the Base value detail
  // line when present, so an exact cell-name match would be wrong here).
  const firstDataRow = rows.nth(1);
  const secondDataRow = rows.nth(2);
  await expect(
    firstDataRow.getByRole("link", {
      name: "Alpha Test E2E Category Items Tab Item",
      exact: true,
    })
  ).toBeVisible();
  await expect(
    secondDataRow.getByRole("link", {
      name: "Zeta Test E2E Category Items Tab Item",
      exact: true,
    })
  ).toBeVisible();

  // Three cells per row: Item, Held Item, Tradeable. No separate
  // Category column exists — the current Category is already the page
  // context.
  await expect(firstDataRow.getByRole("cell")).toHaveCount(3);
  await expect(
    firstDataRow.getByRole("cell", { name: "Yes", exact: true })
  ).toBeVisible();
  await expect(
    firstDataRow.getByRole("cell", { name: "No", exact: true })
  ).toBeVisible();
  // Base value IS set on this row: a labeled detail line renders.
  await expect(
    firstDataRow.getByText("Base value: 15", { exact: true })
  ).toBeVisible();

  // The other row has no base value: no placeholder dash, no "Base
  // value:" label, and no blank cell of its own — the row still has
  // exactly three cells.
  await expect(secondDataRow.getByRole("cell")).toHaveCount(3);
  await expect(secondDataRow.getByText("Base value:")).toHaveCount(0);
  await expect(secondDataRow.getByText("—", { exact: true })).toHaveCount(0);

  // The item link goes to the EXISTING Item admin edit route — no
  // inline editing lives on this tab.
  const itemLink = firstDataRow.getByRole("link", {
    name: "Alpha Test E2E Category Items Tab Item",
    exact: true,
  });
  await expect(itemLink).toHaveAttribute(
    "href",
    /^\/admin\/items\/.+\/edit$/
  );
  await itemLink.click();
  await expect(page).toHaveURL(/\/admin\/items\/.+\/edit$/);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Alpha Test E2E Category Items Tab Item",
      exact: true,
    })
  ).toBeVisible();
});

test("switching categories while on the Items tab preserves the tab and q", async ({
  page,
}) => {
  const CATEGORY_A = {
    name: "Test E2E Category Items Switch A",
    slug: "test-e2e-category-items-switch-a",
  };
  const CATEGORY_B = {
    name: "Test E2E Category Items Switch B",
    slug: "test-e2e-category-items-switch-b",
  };
  await createTemporaryCategory(page, CATEGORY_A);
  await createTemporaryCategory(page, CATEGORY_B);
  await createTemporaryItemForCategoryItemsTab(CATEGORY_A.slug, {
    suffix: "switch",
    itemName: "Test E2E Category Items Switch Item",
  });

  // A shared, distinguishing query so only these two temporary
  // categories match.
  await page.goto("/admin/categories");
  await page
    .getByRole("searchbox", { name: "Search categories" })
    .fill("test e2e category items switch");
  await expect(recordRow(page, CATEGORY_A.name)).toBeVisible();
  await expect(recordRow(page, CATEGORY_B.name)).toBeVisible();

  await recordRow(page, CATEGORY_A.name).click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/categories/${CATEGORY_A.slug}/edit\\?q=`)
  );

  await tabNav(page).getByRole("link", { name: "Items", exact: true }).click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/categories/${CATEGORY_A.slug}/items\\?q=`)
  );
  await expect(recordRow(page, CATEGORY_A.name)).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(
    page.getByRole("cell", {
      name: "Test E2E Category Items Switch Item",
      exact: true,
    })
  ).toBeVisible();

  // Switching records while ON the Items tab opens the OTHER category's
  // Items tab — not its General tab — with q intact.
  await recordRow(page, CATEGORY_B.name).click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/categories/${CATEGORY_B.slug}/items\\?q=`)
  );
  await expect(
    page.getByRole("heading", { level: 1, name: CATEGORY_B.name, exact: true })
  ).toBeVisible();
  await expect(
    tabNav(page).getByRole("link", { name: "Items", exact: true })
  ).toHaveAttribute("aria-current", "page");
  await expect(recordRow(page, CATEGORY_B.name)).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(recordRow(page, CATEGORY_A.name)).not.toHaveAttribute(
    "aria-current",
    "page"
  );
  // Category B has no linked item: a valid empty tab state, not an
  // error.
  await expect(
    page.getByText("No items use this category yet")
  ).toBeVisible();
});

test("a category with no linked item shows a valid empty state", async ({
  page,
}) => {
  const CATEGORY = {
    name: "Test E2E Category Items Empty",
    slug: "test-e2e-category-items-empty",
  };
  await createTemporaryCategory(page, CATEGORY);

  await page.goto(`/admin/categories/${CATEGORY.slug}/items`);
  await expect(
    page.getByRole("heading", { level: 1, name: CATEGORY.name, exact: true })
  ).toBeVisible();
  await expect(
    page.getByText("No items use this category yet")
  ).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);

  // Relationship-count badge: zero linked items still renders the
  // visible digit 0 on the Items tab, never omitted.
  await expect(
    tabNav(page).getByRole("link", { name: "Items", exact: true })
  ).toContainText("0");
});

test("General remains a real link from the Items tab, and no Category tab is disabled", async ({
  page,
}) => {
  const CATEGORY = {
    name: "Test E2E Category Items Nav",
    slug: "test-e2e-category-items-nav",
  };
  await createTemporaryCategory(page, CATEGORY);

  await page.goto(`/admin/categories/${CATEGORY.slug}/items`);
  await expect(
    tabNav(page).getByRole("link", { name: "Items", exact: true })
  ).toHaveAttribute("aria-current", "page");
  await expect(tabNav(page).locator('[aria-current="page"]')).toHaveCount(1);

  // The Metadata tab was removed (Visual Pass sub-slice 4) — every
  // remaining Category tab (General, Items) is a real link; none is a
  // disabled placeholder.
  await expect(tabNav(page).getByRole("link")).toHaveCount(2);
  await expect(tabNav(page).locator('[aria-disabled="true"]')).toHaveCount(0);

  await tabNav(page).getByRole("link", { name: "General", exact: true }).click();
  await expect(page).toHaveURL(`/admin/categories/${CATEGORY.slug}/edit`);
  await expect(
    tabNav(page).getByRole("link", { name: "General", exact: true })
  ).toHaveAttribute("aria-current", "page");

  await tabNav(page).getByRole("link", { name: "Items", exact: true }).click();
  await expect(page).toHaveURL(`/admin/categories/${CATEGORY.slug}/items`);
  await expect(
    tabNav(page).getByRole("link", { name: "Items", exact: true })
  ).toHaveAttribute("aria-current", "page");
});

test("the Items tab renders no form, mutation control, or image/verification control", async ({
  page,
}) => {
  const CATEGORY = {
    name: "Test E2E Category Items ReadOnly",
    slug: "test-e2e-category-items-readonly",
  };
  await createTemporaryCategory(page, CATEGORY);
  await createTemporaryItemForCategoryItemsTab(CATEGORY.slug, {
    suffix: "readonly",
    itemName: "Test E2E Category Items ReadOnly Item",
  });

  await page.goto(`/admin/categories/${CATEGORY.slug}/items`);

  // Strictly read-only, scoped to the workspace's main content region:
  // the record list's own search form (a plain GET, not a mutation) is
  // outside this region and is expected to stay on-screen, matching the
  // Profession Recipes tab's precedent for this exact assertion shape.
  const main = page.locator(".admin-workspace-main");
  await expect(main.locator("form")).toHaveCount(0);
  await expect(main.locator("input")).toHaveCount(0);
  await expect(main.locator("select")).toHaveCount(0);
  await expect(main.getByRole("button")).toHaveCount(0);
  await expect(
    main.getByRole("heading", { level: 2, name: "Image", exact: true })
  ).toHaveCount(0);
  await expect(
    main.getByRole("heading", { level: 2, name: "Verification", exact: true })
  ).toHaveCount(0);
  await expect(
    main.getByRole("heading", { level: 2, name: "Timestamps", exact: true })
  ).toHaveCount(0);
  await expect(main.getByText("Delete Category")).toHaveCount(0);
});

test("an unknown category slug fails safely on the items route", async ({
  page,
}) => {
  const response = await page.goto(
    "/admin/categories/test-e2e-category-items-does-not-exist/items"
  );
  expect(response?.status()).toBe(404);
});

test("seeded fixtures are preserved and no test category or relation record remains", async () => {
  expect(await readFixtureCounts()).toEqual({
    categories: 5,
    professions: 10,
    items: 16,
    recipes: 8,
    recipeIngredients: 15,
  });
  expect(await countE2eTestCategories()).toBe(0);
});
