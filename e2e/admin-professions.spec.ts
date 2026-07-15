// Authenticated Profession admin lifecycle against the REAL application
// and the isolated Supabase test project. Runs in the chromium-admin
// project with the storage state saved by auth.setup.ts. All temporary
// Profession rows use the test-e2e-profession slug prefix, the temporary
// Item/Recipe rows for the relation-blocked test use the separate
// test-e2e-profession-relation- prefix, and everything is removed by
// guard-first, prefix-scoped cleanup in beforeAll/afterEach/afterAll — a
// mid-test failure can never strand a row. Seeded fixtures are read but
// never modified; the duplicate test only borrows a seeded NAME to trigger
// the existing server-side rejection, and the relation test links a
// temporary Recipe only to a temporary Profession. No image file is ever
// provided: the optional image input stays empty, so no Storage object is
// written or deleted.

import { expect, test, type Page } from "@playwright/test";
import {
  countE2eTestProfessionRecords,
  createTemporaryRecipeForProfession,
  deleteE2eTestProfessionRecords,
  readFixtureCounts,
  removeTemporaryRecipeForProfession,
} from "./helpers/database-cleanup";

const INITIAL = {
  name: "Test E2E Profession",
  slug: "test-e2e-profession",
  description: "Created by the authenticated Profession browser test.",
} as const;

const EDITED = {
  name: "Test E2E Profession Updated",
  slug: "test-e2e-profession-updated",
  description: "Updated by the authenticated Profession browser test.",
} as const;

// A separate temporary Profession for the relation-blocked deletion test,
// so that test never depends on the lifecycle test's data.
const BLOCKED = {
  name: "Test E2E Profession Blocked",
  slug: "test-e2e-profession-blocked",
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
  // temporary relation Recipe/Item rows first, then test Professions.
  await deleteE2eTestProfessionRecords();
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

test.beforeAll(async () => {
  // Remove stale rows from interrupted earlier runs; the guard inside the
  // helper throws here if the environment is not the verified test project.
  await deleteE2eTestProfessionRecords();
  expect(await countE2eTestProfessionRecords()).toBe(0);
});

test.afterAll(async () => {
  const remaining = await deleteE2eTestProfessionRecords();
  // afterEach should already have removed everything — fail loudly if not.
  expect(remaining).toBe(0);
});

// The public profession card renders its title as an h3 inside the card link.
function cardLink(page: Page, name: string) {
  return page
    .getByRole("link")
    .filter({ has: page.getByRole("heading", { level: 3, name, exact: true }) });
}

// The admin table row for a profession, located by its exact Name cell.
function adminRow(page: Page, name: string) {
  return page
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name, exact: true }) });
}

// Fills the create form on /admin/professions (the page must already be
// open) and submits it. The optional image input is deliberately left
// untouched: creation must succeed with no image.
async function createProfessionThroughForm(
  page: Page,
  data: { name: string; slug: string; description: string }
) {
  await page.getByLabel("Name", { exact: true }).fill(data.name);
  await page.getByLabel(/^Slug/).fill(data.slug);
  await page.getByLabel(/^Description/).fill(data.description);
  await page
    .getByRole("button", { name: "Create Profession", exact: true })
    .click();

  await expect(page).toHaveURL("/admin/professions?success=created");
  await expect(page.getByRole("status")).toHaveText("Profession created.");
  await expect(
    page.getByRole("cell", { name: data.name, exact: true })
  ).toBeVisible();
}

test("authenticated profession admin access uses the saved storage state", async ({
  page,
}) => {
  await page.goto("/admin/professions");

  // No redirect to /login: the saved state authenticates the request.
  await expect(page).toHaveURL("/admin/professions");
  await expect(
    page.getByRole("heading", { level: 1, name: "Profession Management" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create Profession", exact: true })
  ).toBeVisible();

  // Both seeded professions appear in the admin table.
  await expect(
    page.getByRole("cell", { name: "Blacksmithing", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Alchemy", exact: true })
  ).toBeVisible();
});

test("profession create/edit/delete lifecycle through the real admin UI", async ({
  page,
}) => {
  // --- Create (with the optional image input left empty) ---------------
  await page.goto("/admin");
  await page.getByRole("link", { name: /Manage Professions/ }).click();
  await expect(page).toHaveURL("/admin/professions");
  await expect(
    page.getByRole("heading", { level: 1, name: "Profession Management" })
  ).toBeVisible();

  await createProfessionThroughForm(page, INITIAL);

  // Public detail page renders the new profession with the no-image
  // fallback and the empty recipes state.
  await page.goto(`/professions/${INITIAL.slug}`);
  await expect(
    page.getByRole("heading", { level: 1, name: INITIAL.name, exact: true })
  ).toBeVisible();
  await expect(page.getByText(INITIAL.description)).toBeVisible();
  await expect(page.getByText("No image available")).toBeVisible();
  await expect(page.getByText("No recipes yet")).toBeVisible();

  // Public list card appears and points at the detail route.
  await page.goto("/professions");
  const createdCard = cardLink(page, INITIAL.name);
  await expect(createdCard).toBeVisible();
  await expect(createdCard).toHaveAttribute(
    "href",
    `/professions/${INITIAL.slug}`
  );

  // --- Edit (name, slug, and description; image untouched) -------------
  await page.goto("/admin/professions");
  await adminRow(page, INITIAL.name).getByRole("link", { name: "Edit" }).click();
  await expect(page).toHaveURL(`/admin/professions/${INITIAL.slug}/edit`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Edit Profession" })
  ).toBeVisible();
  await expect(
    page.getByText(`Update details for "${INITIAL.name}".`)
  ).toBeVisible();

  await page.getByLabel("Name", { exact: true }).fill(EDITED.name);
  await page.getByLabel("Slug", { exact: true }).fill(EDITED.slug);
  await page.getByLabel(/^Description/).fill(EDITED.description);
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();

  await expect(page).toHaveURL("/admin/professions?success=updated");
  await expect(page.getByRole("status")).toHaveText("Profession updated.");
  await expect(
    page.getByRole("cell", { name: EDITED.name, exact: true })
  ).toBeVisible();

  // The slug changed, so the original public route must be gone...
  const staleResponse = await page.goto(`/professions/${INITIAL.slug}`);
  expect(staleResponse?.status()).toBe(404);

  // ...and the new public detail page renders the edited values.
  await page.goto(`/professions/${EDITED.slug}`);
  await expect(
    page.getByRole("heading", { level: 1, name: EDITED.name, exact: true })
  ).toBeVisible();
  await expect(page.getByText(EDITED.description)).toBeVisible();

  await page.goto("/professions");
  const editedCard = cardLink(page, EDITED.name);
  await expect(editedCard).toBeVisible();
  await expect(editedCard).toHaveAttribute(
    "href",
    `/professions/${EDITED.slug}`
  );

  // --- Delete -----------------------------------------------------------
  await page.goto("/admin/professions");
  await adminRow(page, EDITED.name).getByRole("link", { name: "Delete" }).click();
  await expect(page).toHaveURL(`/admin/professions/${EDITED.slug}/delete`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Delete Profession" })
  ).toBeVisible();
  // The confirmation identifies exactly this profession by name and slug.
  await expect(page.getByText(`(${EDITED.slug})`)).toBeVisible();
  await expect(page.getByText("Linked recipes: 0")).toBeVisible();

  await page
    .getByRole("button", { name: "Delete Permanently", exact: true })
    .click();

  await expect(page).toHaveURL("/admin/professions?success=deleted");
  await expect(page.getByRole("status")).toHaveText("Profession deleted.");
  await expect(
    page.getByRole("cell", { name: EDITED.name, exact: true })
  ).toHaveCount(0);

  // Gone from the public site as well.
  const deletedResponse = await page.goto(`/professions/${EDITED.slug}`);
  expect(deletedResponse?.status()).toBe(404);

  await page.goto("/professions");
  await expect(cardLink(page, EDITED.name)).toHaveCount(0);
});

test("creating a profession with a seeded name is rejected server-side", async ({
  page,
}) => {
  await page.goto("/admin/professions");

  // Seeded name "Blacksmithing" in different casing with surrounding
  // whitespace: the server trims the name and its duplicate check is
  // case-insensitive, so this must be rejected. The slug carries the test
  // prefix so cleanup would catch the row if creation ever slipped through.
  await page.getByLabel("Name", { exact: true }).fill("  blacksmithing  ");
  await page.getByLabel(/^Slug/).fill("test-e2e-profession-duplicate");
  await page
    .getByRole("button", { name: "Create Profession", exact: true })
    .click();

  await expect(page).toHaveURL("/admin/professions?error=duplicate_name");
  // Next.js injects a hidden route-announcer div that also has role=alert,
  // so the application's alert is located by its exact readable text.
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "A profession with that name already exists." })
  ).toBeVisible();

  // Back on a safe form state, and nothing was written.
  await expect(
    page.getByRole("button", { name: "Create Profession", exact: true })
  ).toBeVisible();
  expect(await countE2eTestProfessionRecords()).toBe(0);
});

test("deletion is blocked while a recipe references the profession", async ({
  page,
}) => {
  // The temporary Profession is created through the real admin UI; only
  // the Recipe relation (and its required resulting Item) is set up through
  // the guarded database helper, because Item/Recipe admin browser
  // workflows are out of scope for this suite.
  await page.goto("/admin/professions");
  await createProfessionThroughForm(page, BLOCKED);

  // Open the confirmation page while the profession is still unreferenced:
  // it shows a zero count and offers the delete button.
  await page.goto(`/admin/professions/${BLOCKED.slug}/delete`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Delete Profession" })
  ).toBeVisible();
  await expect(page.getByText("Linked recipes: 0")).toBeVisible();
  const deleteButton = page.getByRole("button", {
    name: "Delete Permanently",
    exact: true,
  });
  await expect(deleteButton).toBeVisible();

  // Link a temporary Recipe to the profession AFTER the page loaded, then
  // confirm deletion: the server action re-checks the relation immediately
  // before deleting, so the stale confirmation page must not slip through.
  await createTemporaryRecipeForProfession(BLOCKED.slug);
  await deleteButton.click();

  await expect(page).toHaveURL(
    `/admin/professions/${BLOCKED.slug}/delete?error=linked_recipes`
  );
  await expect(
    page.getByRole("alert").filter({
      hasText:
        "This profession cannot be deleted because it is assigned to 1 recipe.",
    })
  ).toBeVisible();

  // The re-rendered confirmation page also blocks statically: the count is
  // shown, the warning explains the rule, and the delete button is gone.
  await expect(page.getByText("Linked recipes: 1")).toBeVisible();
  await expect(
    page.getByText("Reassign or remove those recipes first.")
  ).toBeVisible();
  await expect(deleteButton).toHaveCount(0);

  // The profession survived, in the admin list and on the public site,
  // where the temporary recipe is rendered through the real relation.
  await page.goto("/admin/professions");
  await expect(
    page.getByRole("cell", { name: BLOCKED.name, exact: true })
  ).toBeVisible();
  await page.goto(`/professions/${BLOCKED.slug}`);
  await expect(
    page.getByRole("heading", { level: 1, name: BLOCKED.name, exact: true })
  ).toBeVisible();
  await expect(
    cardLink(page, "Test E2E Profession Relation Recipe")
  ).toBeVisible();

  // Safely remove ONLY the temporary Recipe/Item rows, then delete the
  // profession through the real confirmation flow.
  expect(await removeTemporaryRecipeForProfession()).toBe(2);

  await page.goto(`/admin/professions/${BLOCKED.slug}/delete`);
  await expect(page.getByText("Linked recipes: 0")).toBeVisible();
  await page
    .getByRole("button", { name: "Delete Permanently", exact: true })
    .click();

  await expect(page).toHaveURL("/admin/professions?success=deleted");
  await expect(page.getByRole("status")).toHaveText("Profession deleted.");
  await expect(
    page.getByRole("cell", { name: BLOCKED.name, exact: true })
  ).toHaveCount(0);

  const deletedResponse = await page.goto(`/professions/${BLOCKED.slug}`);
  expect(deletedResponse?.status()).toBe(404);
});

test("seeded fixtures are preserved and no test profession remains", async () => {
  expect(await readFixtureCounts()).toEqual({
    categories: 5,
    professions: 2,
    items: 16,
    recipes: 8,
    recipeIngredients: 15,
  });
  expect(await countE2eTestProfessionRecords()).toBe(0);
});
