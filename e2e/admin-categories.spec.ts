// Authenticated Category admin CRUD and validation coverage against the
// REAL application and the isolated Supabase test project. Runs in the
// chromium-admin project with the storage state saved by auth.setup.ts.
// All temporary Category rows use the test-e2e-category slug prefix, the
// temporary Item row for the relation-blocked test uses the separate
// test-e2e-category-relation- prefix, and everything is removed by
// guard-first, prefix-scoped cleanup in beforeAll/afterEach/afterAll — a
// mid-test failure can never strand a row. Seeded fixtures are read but
// never modified; the duplicate test only borrows a seeded NAME to
// trigger the existing server-side rejection, and the relation test
// links a temporary Item only to a temporary Category.

import { expect, test, type Page } from "@playwright/test";
import {
  countE2eTestCategories,
  createTemporaryItemForCategory,
  deleteE2eTestCategories,
  readFixtureCounts,
  removeTemporaryItemForCategory,
} from "./helpers/database-cleanup";

const INITIAL = {
  name: "Test E2E Category",
  slug: "test-e2e-category",
  description: "Created by the authenticated Category browser test.",
} as const;

const EDITED = {
  name: "Test E2E Category Updated",
  slug: "test-e2e-category-updated",
  description: "Updated by the authenticated Category browser test.",
} as const;

// A separate temporary Category for the relation-blocked deletion test,
// so that test never depends on the lifecycle test's data.
const BLOCKED = {
  name: "Test E2E Category Blocked",
  slug: "test-e2e-category-blocked",
  description: "Created to verify the relation-blocked deletion rule.",
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
  // the temporary relation Item first, then test Categories.
  await deleteE2eTestCategories();
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

test.beforeAll(async () => {
  // Remove stale rows from interrupted earlier runs; the guard inside the
  // helper throws here if the environment is not the verified test project.
  await deleteE2eTestCategories();
  expect(await countE2eTestCategories()).toBe(0);
});

test.afterAll(async () => {
  const remaining = await deleteE2eTestCategories();
  // afterEach should already have removed everything — fail loudly if not.
  expect(remaining).toBe(0);
});

// The public category card renders its title as an h3 inside the card link.
function cardLink(page: Page, name: string) {
  return page
    .getByRole("link")
    .filter({ has: page.getByRole("heading", { level: 3, name, exact: true }) });
}

// One row of the shared Category record list, located by its exact
// primary text inside the list's navigation landmark. The row link
// itself opens the edit route — there is no separate per-row Edit/Delete
// action any more (Delete is reached from the edit page's toolbar).
function recordRow(page: Page, name: string) {
  return page
    .getByRole("navigation", { name: "Categories records" })
    .getByRole("link")
    .filter({ has: page.getByText(name, { exact: true }) });
}

// One of the shared panels' rows (Timestamps) in the Category editor's
// aside, located by its label (dt) text — scoped to the panel by heading
// so identical row labels can never collide with content elsewhere on
// the page. The row's dt/dd text is concatenated with no separator, so
// the filter is anchored to the START of the row's text.
function panelRow(page: Page, panelTitle: string, label: string) {
  return page
    .locator(".admin-panel")
    .filter({
      has: page.getByRole("heading", { level: 2, name: panelTitle, exact: true }),
    })
    .locator(".admin-panel-row")
    .filter({ hasText: new RegExp(`^${label}`) });
}

function tabNav(page: Page) {
  return page.getByRole("navigation", { name: "Category editor sections" });
}

// Fills the create form on /admin/categories/new (the page must already
// be open — the dedicated creation route) and submits it.
async function createCategoryThroughForm(
  page: Page,
  data: { name: string; slug: string; description: string }
) {
  await page.getByLabel("Name", { exact: true }).fill(data.name);
  await page.getByLabel(/^Slug/).fill(data.slug);
  await page.getByLabel(/^Description/).fill(data.description);
  await page
    .getByRole("button", { name: "Create Category", exact: true })
    .click();

  await expect(page).toHaveURL("/admin/categories?success=created");
  await expect(page.getByRole("status")).toHaveText("Category created.");
  await expect(recordRow(page, data.name)).toBeVisible();
}

test("authenticated admin access uses the saved storage state", async ({
  page,
}) => {
  await page.goto("/admin/categories");

  // No redirect to /login: the saved state authenticates the request.
  await expect(page).toHaveURL("/admin/categories");
  await expect(
    page.getByRole("heading", { level: 1, name: "Category Management" })
  ).toBeVisible();

  // The workspace landing state: the record list with its create link —
  // the embedded creation form is gone from this page.
  await expect(
    page.getByRole("link", { name: "+ New category", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create Category", exact: true })
  ).toHaveCount(0);
  await expect(page.getByLabel("Name", { exact: true })).toHaveCount(0);

  // A representative pair of seeded categories appear as record-list rows.
  await expect(recordRow(page, "Materials")).toBeVisible();
  await expect(recordRow(page, "Tools")).toBeVisible();
});

test("Create category opens the dedicated creation route", async ({
  page,
}) => {
  await page.goto("/admin/categories");
  await page
    .getByRole("link", { name: "+ New category", exact: true })
    .click();

  await expect(page).toHaveURL("/admin/categories/new");
  await expect(
    page.getByRole("heading", { level: 1, name: "Create Category" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create Category", exact: true })
  ).toBeVisible();
});

test("Category editor: create shows only General; edit marks General active with Items and Metadata both real; exactly one h1 renders; Timestamps render on edit only; no image or verification controls appear", async ({
  page,
}) => {
  // --- Create: exactly one h1, one real tab, no disabled placeholders,
  // no Timestamps panel (nothing to show yet), no image/verification
  // controls (Categories have neither) ------------------------------------
  await page.goto("/admin/categories/new");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  const createTabNav = tabNav(page);
  await expect(
    createTabNav.getByRole("link", { name: "General", exact: true })
  ).toHaveAttribute("aria-current", "page");
  await expect(createTabNav.getByText("Items")).toHaveCount(0);
  await expect(createTabNav.getByText("Metadata")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 2, name: "Timestamps", exact: true })
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 2, name: "Image", exact: true })
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 2, name: "Verification", exact: true })
  ).toHaveCount(0);
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await expect(page.locator('input[type="checkbox"]')).toHaveCount(0);
  await expect(page.locator("select")).toHaveCount(0);

  await createCategoryThroughForm(page, {
    name: "Test E2E Category Tabs",
    slug: "test-e2e-category-tabs",
    description: "Verifies the shared editor structure.",
  });

  // --- Edit: exactly one h1 (the category's own name), General active,
  // Items and Metadata both real, Timestamps present (Created/Updated),
  // still no image or verification controls ------------------------------
  await recordRow(page, "Test E2E Category Tabs").click();
  await expect(page).toHaveURL("/admin/categories/test-e2e-category-tabs/edit");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Test E2E Category Tabs",
      exact: true,
    })
  ).toBeVisible();

  const editTabNav = tabNav(page);
  await expect(
    editTabNav.getByRole("link", { name: "General", exact: true })
  ).toHaveAttribute("aria-current", "page");
  await expect(editTabNav.locator('[aria-current="page"]')).toHaveCount(1);
  // Items (Slice 9E.3) and Metadata (Slice 9E.4) are both real tabs now —
  // no Category tab remains disabled.
  await expect(
    editTabNav.getByRole("link", { name: "Items", exact: true })
  ).toBeVisible();
  await expect(
    editTabNav.getByRole("link", { name: "Metadata", exact: true })
  ).toBeVisible();
  await expect(editTabNav.locator('[aria-disabled="true"]')).toHaveCount(0);

  await expect(
    page.getByRole("heading", { level: 2, name: "Timestamps", exact: true })
  ).toBeVisible();
  await expect(panelRow(page, "Timestamps", "Created")).toBeVisible();
  await expect(panelRow(page, "Timestamps", "Updated")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Image", exact: true })
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 2, name: "Verification", exact: true })
  ).toHaveCount(0);
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await expect(page.locator('input[type="checkbox"]')).toHaveCount(0);
  await expect(page.locator("select")).toHaveCount(0);
});

test("category create/edit/delete lifecycle through the real admin UI", async ({
  page,
}) => {
  // --- Create -------------------------------------------------------------
  await page.goto("/admin/categories");
  await expect(
    page.getByRole("heading", { level: 1, name: "Category Management" })
  ).toBeVisible();

  await page
    .getByRole("link", { name: "+ New category", exact: true })
    .click();
  await expect(page).toHaveURL("/admin/categories/new");
  await createCategoryThroughForm(page, INITIAL);

  // Public detail page renders the new category. It holds no items, so
  // the entire Items section (heading and empty state alike) is omitted;
  // the Details card still says "Items: 0".
  await page.goto(`/categories/${INITIAL.slug}`);
  await expect(
    page.getByRole("heading", { level: 1, name: INITIAL.name, exact: true })
  ).toBeVisible();
  await expect(page.getByText(INITIAL.description)).toBeVisible();
  await expect(page.getByText("Items: 0")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Items", exact: true })
  ).toHaveCount(0);
  await expect(page.getByText("No items yet")).toHaveCount(0);

  // Public list card appears and points at the detail route.
  await page.goto("/categories");
  const createdCard = cardLink(page, INITIAL.name);
  await expect(createdCard).toBeVisible();
  await expect(createdCard).toHaveAttribute(
    "href",
    `/categories/${INITIAL.slug}`
  );

  // --- Edit -----------------------------------------------------------
  // Quick switching: the record-list row itself is the edit link, and the
  // open record is marked selected (aria-current) in the list.
  await page.goto("/admin/categories");
  await recordRow(page, INITIAL.name).click();
  await expect(page).toHaveURL(`/admin/categories/${INITIAL.slug}/edit`);
  await expect(recordRow(page, INITIAL.name)).toHaveAttribute(
    "aria-current",
    "page"
  );
  // The editor's one h1 is the category's own name; its slug is the
  // subtitle context underneath (Slice 9E.2, matching the Item/Recipe/
  // Profession General editors' convention exactly).
  await expect(
    page.getByRole("heading", { level: 1, name: INITIAL.name, exact: true })
  ).toBeVisible();
  await expect(page.getByText(INITIAL.slug, { exact: true })).toBeVisible();

  await page.getByLabel("Name", { exact: true }).fill(EDITED.name);
  await page.getByLabel("Slug", { exact: true }).fill(EDITED.slug);
  await page.getByLabel(/^Description/).fill(EDITED.description);
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();

  await expect(page).toHaveURL("/admin/categories?success=updated");
  await expect(page.getByRole("status")).toHaveText("Category updated.");
  await expect(recordRow(page, EDITED.name)).toBeVisible();

  // The slug changed, so the original public route must be gone...
  const staleResponse = await page.goto(`/categories/${INITIAL.slug}`);
  expect(staleResponse?.status()).toBe(404);

  // ...and the new public detail page renders the edited values.
  await page.goto(`/categories/${EDITED.slug}`);
  await expect(
    page.getByRole("heading", { level: 1, name: EDITED.name, exact: true })
  ).toBeVisible();
  await expect(page.getByText(EDITED.description)).toBeVisible();

  await page.goto("/categories");
  const editedCard = cardLink(page, EDITED.name);
  await expect(editedCard).toBeVisible();
  await expect(editedCard).toHaveAttribute(
    "href",
    `/categories/${EDITED.slug}`
  );

  // --- Delete -------------------------------------------------------------
  // Delete is reached from the edit page's toolbar (the old table's
  // per-row Delete link is gone).
  await page.goto("/admin/categories");
  await recordRow(page, EDITED.name).click();
  await expect(page).toHaveURL(`/admin/categories/${EDITED.slug}/edit`);
  await page
    .getByRole("link", { name: "Delete Category", exact: true })
    .click();
  await expect(page).toHaveURL(`/admin/categories/${EDITED.slug}/delete`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Delete Category" })
  ).toBeVisible();
  // The confirmation identifies exactly this category by name and slug.
  await expect(page.getByText(`(${EDITED.slug})`)).toBeVisible();
  await expect(page.getByText("Linked items: 0")).toBeVisible();

  await page
    .getByRole("button", { name: "Delete Permanently", exact: true })
    .click();

  await expect(page).toHaveURL("/admin/categories?success=deleted");
  await expect(page.getByRole("status")).toHaveText("Category deleted.");
  await expect(recordRow(page, EDITED.name)).toHaveCount(0);

  // Gone from the public site as well.
  const deletedResponse = await page.goto(`/categories/${EDITED.slug}`);
  expect(deletedResponse?.status()).toBe(404);

  await page.goto("/categories");
  await expect(cardLink(page, EDITED.name)).toHaveCount(0);
});

test("creating a category with a seeded name is rejected server-side", async ({
  page,
}) => {
  await page.goto("/admin/categories/new");

  // Seeded name "Materials" in different casing: the server's
  // case-insensitive duplicate check must reject it. The slug carries the
  // test prefix so cleanup would catch the row if creation ever slipped
  // through.
  await page.getByLabel("Name", { exact: true }).fill("materials");
  await page.getByLabel(/^Slug/).fill("test-e2e-category-duplicate");
  await page
    .getByRole("button", { name: "Create Category", exact: true })
    .click();

  await expect(page).toHaveURL("/admin/categories/new?error=duplicate_name");
  // Next.js injects a hidden route-announcer div that also has role=alert,
  // so the application's alert is located by its exact readable text.
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "A category with that name already exists." })
  ).toBeVisible();

  // Back on a safe form state, and nothing was written.
  await expect(
    page.getByRole("button", { name: "Create Category", exact: true })
  ).toBeVisible();
  expect(await countE2eTestCategories()).toBe(0);
});

test("deletion is blocked while an item references the category", async ({
  page,
}) => {
  // The temporary Category is created through the real admin UI; only the
  // Item relation is set up through the guarded database helper, because
  // Item admin browser workflows are out of scope for this suite.
  await page.goto("/admin/categories/new");
  await createCategoryThroughForm(page, BLOCKED);

  // Open the confirmation page while the category is still unreferenced:
  // it shows a zero count and offers the delete button.
  await page.goto(`/admin/categories/${BLOCKED.slug}/delete`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Delete Category" })
  ).toBeVisible();
  await expect(page.getByText("Linked items: 0")).toBeVisible();
  const deleteButton = page.getByRole("button", {
    name: "Delete Permanently",
    exact: true,
  });
  await expect(deleteButton).toBeVisible();

  // Link a temporary Item to the category AFTER the page loaded, then
  // confirm deletion: the server action re-checks the relation immediately
  // before deleting, so the stale confirmation page must not slip through.
  await createTemporaryItemForCategory(BLOCKED.slug);
  await deleteButton.click();

  await expect(page).toHaveURL(
    `/admin/categories/${BLOCKED.slug}/delete?error=linked_items`
  );
  await expect(
    page.getByRole("alert").filter({
      hasText:
        "This category cannot be deleted because it is assigned to 1 item.",
    })
  ).toBeVisible();

  // The re-rendered confirmation page also blocks statically: the count is
  // shown, the warning explains the rule, and the delete button is gone.
  await expect(page.getByText("Linked items: 1")).toBeVisible();
  await expect(
    page.getByText("Reassign or remove those items first.")
  ).toBeVisible();
  await expect(deleteButton).toHaveCount(0);

  // The category survived, in the admin list (record-list secondary
  // context now shows "1 item") and on the public site, where the
  // temporary item is rendered through the real relation.
  await page.goto("/admin/categories");
  const blockedRow = recordRow(page, BLOCKED.name);
  await expect(blockedRow).toBeVisible();
  await expect(blockedRow.getByText("1 item", { exact: true })).toBeVisible();
  await page.goto(`/categories/${BLOCKED.slug}`);
  await expect(
    page.getByRole("heading", { level: 1, name: BLOCKED.name, exact: true })
  ).toBeVisible();
  await expect(
    cardLink(page, "Test E2E Category Relation Item")
  ).toBeVisible();

  // Safely remove ONLY the temporary Item row, then delete the category
  // through the real confirmation flow.
  expect(await removeTemporaryItemForCategory()).toBe(1);

  await page.goto(`/admin/categories/${BLOCKED.slug}/delete`);
  await expect(page.getByText("Linked items: 0")).toBeVisible();
  await page
    .getByRole("button", { name: "Delete Permanently", exact: true })
    .click();

  await expect(page).toHaveURL("/admin/categories?success=deleted");
  await expect(page.getByRole("status")).toHaveText("Category deleted.");
  await expect(recordRow(page, BLOCKED.name)).toHaveCount(0);

  const deletedResponse = await page.goto(`/categories/${BLOCKED.slug}`);
  expect(deletedResponse?.status()).toBe(404);
});

test("record-list search filters, preserves the query across switching, and clears", async ({
  page,
}) => {
  // Two temporary categories sharing the test prefix, so one query
  // matches both while seeded records stay out of the way.
  await page.goto("/admin/categories/new");
  await createCategoryThroughForm(page, {
    name: "Test E2E Category Search A",
    slug: "test-e2e-category-search-a",
    description: "First search fixture.",
  });
  await page.goto("/admin/categories/new");
  await createCategoryThroughForm(page, {
    name: "Test E2E Category Search B",
    slug: "test-e2e-category-search-b",
    description: "Second search fixture.",
  });

  // --- Search by NAME (trimmed, case-insensitive) -----------------------
  await page.goto("/admin/categories");
  await page
    .getByRole("searchbox", { name: "Search categories" })
    .fill("  test e2e category search  ");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/categories\?q=/);
  await expect(recordRow(page, "Test E2E Category Search A")).toBeVisible();
  await expect(recordRow(page, "Test E2E Category Search B")).toBeVisible();
  // Seeded records are filtered out server-side.
  await expect(recordRow(page, "Materials")).toHaveCount(0);
  await expect(page.getByText("2 matches")).toBeVisible();

  // --- Quick switching keeps the query applied --------------------------
  // Row hrefs carry the TRIMMED query, %20-encoded by the server helper.
  await recordRow(page, "Test E2E Category Search A").click();
  await expect(page).toHaveURL(
    "/admin/categories/test-e2e-category-search-a/edit?q=test%20e2e%20category%20search"
  );
  await expect(
    recordRow(page, "Test E2E Category Search A")
  ).toHaveAttribute("aria-current", "page");

  // Switch directly to the second match: the list stays filtered, the
  // selection follows, and the first record is no longer marked.
  await recordRow(page, "Test E2E Category Search B").click();
  await expect(page).toHaveURL(
    "/admin/categories/test-e2e-category-search-b/edit?q=test%20e2e%20category%20search"
  );
  await expect(
    recordRow(page, "Test E2E Category Search B")
  ).toHaveAttribute("aria-current", "page");
  await expect(
    recordRow(page, "Test E2E Category Search A")
  ).not.toHaveAttribute("aria-current", "page");

  // The create action, and this edit page's own Cancel/Delete links, keep
  // the search context too.
  await expect(
    page.getByRole("link", { name: "+ New category", exact: true })
  ).toHaveAttribute(
    "href",
    "/admin/categories/new?q=test%20e2e%20category%20search"
  );
  await expect(
    page.getByRole("link", { name: "Cancel", exact: true })
  ).toHaveAttribute(
    "href",
    "/admin/categories?q=test%20e2e%20category%20search"
  );
  await expect(
    page.getByRole("link", { name: "Delete Category", exact: true })
  ).toHaveAttribute(
    "href",
    "/admin/categories/test-e2e-category-search-b/delete?q=test%20e2e%20category%20search"
  );

  // --- Search by SLUG ---------------------------------------------------
  await page.goto("/admin/categories");
  await page
    .getByRole("searchbox", { name: "Search categories" })
    .fill("test-e2e-category-search-b");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(recordRow(page, "Test E2E Category Search B")).toBeVisible();
  await expect(recordRow(page, "Test E2E Category Search A")).toHaveCount(0);
  await expect(page.getByText("1 match", { exact: true })).toBeVisible();

  // --- No-match state (distinct from the no-categories-at-all state) ---
  await page
    .getByRole("searchbox", { name: "Search categories" })
    .fill("zzz-no-such-category");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const emptyRegion = page.locator(".admin-record-empty");
  await expect(emptyRegion).toContainText("No categories match");
  await expect(emptyRegion).toContainText("zzz-no-such-category");
  await expect(page.getByText("0 matches")).toBeVisible();

  // --- Clear search returns the full list -------------------------------
  await page.getByRole("link", { name: "Clear search", exact: true }).click();
  await expect(page).toHaveURL("/admin/categories");
  await expect(recordRow(page, "Materials")).toBeVisible();
  await expect(recordRow(page, "Test E2E Category Search A")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Clear search", exact: true })
  ).toHaveCount(0);
});

test("seeded fixtures are preserved and no test category remains", async () => {
  expect(await readFixtureCounts()).toEqual({
    categories: 5,
    professions: 10,
    items: 16,
    recipes: 8,
    recipeIngredients: 15,
  });
  expect(await countE2eTestCategories()).toBe(0);
});
