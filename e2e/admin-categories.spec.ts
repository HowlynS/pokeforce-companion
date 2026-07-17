// Authenticated Category admin lifecycle against the REAL application and
// the isolated Supabase test project. Runs in the chromium-admin project
// with the storage state saved by auth.setup.ts. All temporary rows use
// the test-e2e-category slug prefix and are removed by guard-first,
// prefix-scoped cleanup in beforeAll/afterEach/afterAll — a mid-test
// failure can never strand a row. Seeded fixtures are read but never
// modified; the duplicate test only borrows a seeded NAME to trigger the
// existing server-side rejection.

import { expect, test, type Page } from "@playwright/test";
import {
  countE2eTestCategories,
  deleteE2eTestCategories,
  readFixtureCounts,
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

// Browser error hygiene: any uncaught page error fails the test. Serial
// single-worker execution makes this module-level state safe.
let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(async () => {
  // Defensive prefix-scoped cleanup even when a test failed mid-lifecycle.
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

// The admin table row for a category, located by its exact Name cell.
function adminRow(page: Page, name: string) {
  return page
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name, exact: true }) });
}

test("authenticated admin access uses the saved storage state", async ({
  page,
}) => {
  await page.goto("/admin");

  // No redirect to /login: the saved state authenticates the request.
  await expect(page).toHaveURL("/admin");
  await expect(
    page.getByRole("heading", { level: 1, name: "Admin", exact: true })
  ).toBeVisible();
  await expect(page.getByText(/^Signed in as/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Manage Categories/ })
  ).toBeVisible();
});

test("category create/edit/delete lifecycle through the real admin UI", async ({
  page,
}) => {
  // --- Create ---------------------------------------------------------
  await page.goto("/admin");
  await page.getByRole("link", { name: /Manage Categories/ }).click();
  await expect(page).toHaveURL("/admin/categories");
  await expect(
    page.getByRole("heading", { level: 1, name: "Category Management" })
  ).toBeVisible();

  await page.getByLabel("Name", { exact: true }).fill(INITIAL.name);
  await page.getByLabel(/^Slug/).fill(INITIAL.slug);
  await page.getByLabel(/^Description/).fill(INITIAL.description);
  await page.getByRole("button", { name: "Create Category", exact: true }).click();

  await expect(page).toHaveURL("/admin/categories?success=created");
  await expect(page.getByRole("status")).toHaveText("Category created.");
  await expect(
    page.getByRole("cell", { name: INITIAL.name, exact: true })
  ).toBeVisible();

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
  await page.goto("/admin/categories");
  await adminRow(page, INITIAL.name).getByRole("link", { name: "Edit" }).click();
  await expect(page).toHaveURL(`/admin/categories/${INITIAL.slug}/edit`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Edit Category" })
  ).toBeVisible();
  await expect(page.getByText(`Update details for "${INITIAL.name}".`)).toBeVisible();

  await page.getByLabel("Name", { exact: true }).fill(EDITED.name);
  await page.getByLabel("Slug", { exact: true }).fill(EDITED.slug);
  await page.getByLabel(/^Description/).fill(EDITED.description);
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();

  await expect(page).toHaveURL("/admin/categories?success=updated");
  await expect(page.getByRole("status")).toHaveText("Category updated.");
  await expect(
    page.getByRole("cell", { name: EDITED.name, exact: true })
  ).toBeVisible();

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

  // --- Delete ---------------------------------------------------------
  await page.goto("/admin/categories");
  await adminRow(page, EDITED.name).getByRole("link", { name: "Delete" }).click();
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
  await expect(
    page.getByRole("cell", { name: EDITED.name, exact: true })
  ).toHaveCount(0);

  // Gone from the public site as well.
  const deletedResponse = await page.goto(`/categories/${EDITED.slug}`);
  expect(deletedResponse?.status()).toBe(404);

  await page.goto("/categories");
  await expect(cardLink(page, EDITED.name)).toHaveCount(0);
});

test("creating a category with a seeded name is rejected server-side", async ({
  page,
}) => {
  await page.goto("/admin/categories");

  // Seeded name "Materials" in different casing: the server's
  // case-insensitive duplicate check must reject it. The slug carries the
  // test prefix so cleanup would catch the row if creation ever slipped
  // through.
  await page.getByLabel("Name", { exact: true }).fill("materials");
  await page.getByLabel(/^Slug/).fill("test-e2e-category-duplicate");
  await page.getByRole("button", { name: "Create Category", exact: true }).click();

  await expect(page).toHaveURL("/admin/categories?error=duplicate_name");
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
