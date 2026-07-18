// Authenticated Profession admin CRUD and validation coverage against the
// REAL application and the isolated Supabase test project. Runs in the
// chromium-admin project with the storage state saved by auth.setup.ts.
// All temporary Profession rows use the test-e2e-profession slug prefix,
// the temporary Item/Recipe rows for the relation-blocked test use the
// separate test-e2e-profession-relation- prefix, and everything is
// removed by guard-first, prefix-scoped cleanup in
// beforeAll/afterEach/afterAll — a mid-test failure can never strand a
// row. Seeded fixtures are read but never modified; the duplicate test
// only borrows a seeded NAME to trigger the existing server-side
// rejection, and the relation test links a temporary Recipe only to a
// temporary Profession. No image file is ever provided: the optional
// image input stays empty, so no Storage object is written or deleted.

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

// One row of the shared Profession record list (Slice 9D.1), located by
// its exact primary text inside the list's navigation landmark. The row
// link itself opens the edit route — there is no separate per-row
// Edit/Delete action any more (Delete is reached from the edit page's
// toolbar).
function recordRow(page: Page, name: string) {
  return page
    .getByRole("navigation", { name: "Professions records" })
    .getByRole("link")
    .filter({ has: page.getByText(name, { exact: true }) });
}

// Fills the create form on /admin/professions/new (the page must already
// be open — the dedicated creation route since Slice 9D.1) and submits
// it. The optional image input is deliberately left untouched: creation
// must succeed with no image.
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
  await expect(recordRow(page, data.name)).toBeVisible();
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

  // The workspace landing state: the record list with its create link —
  // the embedded creation form is gone from this page (Slice 9D.1,
  // following the Item workspace's Slice 9B.4 and Recipe workspace's
  // Slice 9C.1 precedent).
  await expect(
    page.getByRole("link", { name: "+ New profession", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create Profession", exact: true })
  ).toHaveCount(0);
  await expect(page.getByLabel("Name", { exact: true })).toHaveCount(0);

  // A representative pair of seeded professions appear as record-list
  // rows (the full deterministic set of ten is asserted by the dedicated
  // profession-coverage test in admin-name-feedback.spec.ts and
  // public-navigation.spec.ts).
  await expect(recordRow(page, "Smithing")).toBeVisible();
  await expect(recordRow(page, "Alchemy")).toBeVisible();
});

test("Create profession opens the dedicated creation route", async ({
  page,
}) => {
  await page.goto("/admin/professions");
  await page
    .getByRole("link", { name: "+ New profession", exact: true })
    .click();

  await expect(page).toHaveURL("/admin/professions/new");
  await expect(
    page.getByRole("heading", { level: 1, name: "Create Profession" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create Profession", exact: true })
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

  await page
    .getByRole("link", { name: "+ New profession", exact: true })
    .click();
  await expect(page).toHaveURL("/admin/professions/new");
  await createProfessionThroughForm(page, INITIAL);

  // Public detail page renders the new profession with the no-image
  // fallback. It has no recipes, so the entire Recipes section (heading
  // and empty state alike) is omitted; the Details card still says
  // "Recipes: 0".
  await page.goto(`/professions/${INITIAL.slug}`);
  await expect(
    page.getByRole("heading", { level: 1, name: INITIAL.name, exact: true })
  ).toBeVisible();
  await expect(page.getByText(INITIAL.description)).toBeVisible();
  await expect(page.getByText("No image available")).toBeVisible();
  await expect(page.getByText("Recipes: 0")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Recipes", exact: true })
  ).toHaveCount(0);
  await expect(page.getByText("No recipes yet")).toHaveCount(0);

  // Public list card appears and points at the detail route.
  await page.goto("/professions");
  const createdCard = cardLink(page, INITIAL.name);
  await expect(createdCard).toBeVisible();
  await expect(createdCard).toHaveAttribute(
    "href",
    `/professions/${INITIAL.slug}`
  );

  // --- Edit (name, slug, and description; image untouched) -------------
  // Quick switching: the record-list row itself is the edit link, and the
  // open record is marked selected (aria-current) in the list.
  await page.goto("/admin/professions");
  await recordRow(page, INITIAL.name).click();
  await expect(page).toHaveURL(`/admin/professions/${INITIAL.slug}/edit`);
  await expect(recordRow(page, INITIAL.name)).toHaveAttribute(
    "aria-current",
    "page"
  );
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
  await expect(recordRow(page, EDITED.name)).toBeVisible();

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

  // --- Delete -------------------------------------------------------------
  // Delete is reached from the edit page's toolbar (the old table's
  // per-row Delete link is gone).
  await page.goto("/admin/professions");
  await recordRow(page, EDITED.name).click();
  await expect(page).toHaveURL(`/admin/professions/${EDITED.slug}/edit`);
  await page
    .getByRole("link", { name: "Delete Profession", exact: true })
    .click();
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
  await expect(recordRow(page, EDITED.name)).toHaveCount(0);

  // Gone from the public site as well.
  const deletedResponse = await page.goto(`/professions/${EDITED.slug}`);
  expect(deletedResponse?.status()).toBe(404);

  await page.goto("/professions");
  await expect(cardLink(page, EDITED.name)).toHaveCount(0);
});

test("creating a profession with a seeded name is rejected server-side", async ({
  page,
}) => {
  await page.goto("/admin/professions/new");

  // Seeded name "Smithing" in different casing with surrounding
  // whitespace: the server trims the name and its duplicate check is
  // case-insensitive, so this must be rejected. The slug carries the test
  // prefix so cleanup would catch the row if creation ever slipped through.
  await page.getByLabel("Name", { exact: true }).fill("  sMiThInG  ");
  await page.getByLabel(/^Slug/).fill("test-e2e-profession-duplicate");
  await page
    .getByRole("button", { name: "Create Profession", exact: true })
    .click();

  await expect(page).toHaveURL(
    "/admin/professions/new?error=duplicate_name"
  );
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
  await page.goto("/admin/professions/new");
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

  // The profession survived, in the admin list (record-list secondary
  // context now shows "1 recipe") and on the public site, where the
  // temporary recipe is rendered through the real relation.
  await page.goto("/admin/professions");
  const blockedRow = recordRow(page, BLOCKED.name);
  await expect(blockedRow).toBeVisible();
  await expect(blockedRow.getByText("1 recipe", { exact: true })).toBeVisible();
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
  await expect(recordRow(page, BLOCKED.name)).toHaveCount(0);

  const deletedResponse = await page.goto(`/professions/${BLOCKED.slug}`);
  expect(deletedResponse?.status()).toBe(404);
});

test("record-list search filters, preserves the query across switching, and clears", async ({
  page,
}) => {
  // Two temporary professions sharing the test prefix, so one query
  // matches both while seeded records stay out of the way.
  await page.goto("/admin/professions/new");
  await createProfessionThroughForm(page, {
    name: "Test E2E Profession Search A",
    slug: "test-e2e-profession-search-a",
    description: "First search fixture.",
  });
  await page.goto("/admin/professions/new");
  await createProfessionThroughForm(page, {
    name: "Test E2E Profession Search B",
    slug: "test-e2e-profession-search-b",
    description: "Second search fixture.",
  });

  // --- Search by NAME (trimmed, case-insensitive) -----------------------
  await page.goto("/admin/professions");
  await page
    .getByRole("searchbox", { name: "Search professions" })
    .fill("  test e2e profession search  ");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/professions\?q=/);
  await expect(recordRow(page, "Test E2E Profession Search A")).toBeVisible();
  await expect(recordRow(page, "Test E2E Profession Search B")).toBeVisible();
  // Seeded records are filtered out server-side.
  await expect(recordRow(page, "Smithing")).toHaveCount(0);
  await expect(page.getByText("2 matches")).toBeVisible();

  // --- Quick switching keeps the query applied --------------------------
  // Row hrefs carry the TRIMMED query, %20-encoded by the server helper.
  await recordRow(page, "Test E2E Profession Search A").click();
  await expect(page).toHaveURL(
    "/admin/professions/test-e2e-profession-search-a/edit?q=test%20e2e%20profession%20search"
  );
  await expect(
    recordRow(page, "Test E2E Profession Search A")
  ).toHaveAttribute("aria-current", "page");

  // Switch directly to the second match: the list stays filtered, the
  // selection follows, and the first record is no longer marked.
  await recordRow(page, "Test E2E Profession Search B").click();
  await expect(page).toHaveURL(
    "/admin/professions/test-e2e-profession-search-b/edit?q=test%20e2e%20profession%20search"
  );
  await expect(
    recordRow(page, "Test E2E Profession Search B")
  ).toHaveAttribute("aria-current", "page");
  await expect(
    recordRow(page, "Test E2E Profession Search A")
  ).not.toHaveAttribute("aria-current", "page");

  // The create action, and this edit page's own Cancel/Delete links, keep
  // the search context too.
  await expect(
    page.getByRole("link", { name: "+ New profession", exact: true })
  ).toHaveAttribute(
    "href",
    "/admin/professions/new?q=test%20e2e%20profession%20search"
  );
  await expect(
    page.getByRole("link", { name: "Cancel", exact: true })
  ).toHaveAttribute(
    "href",
    "/admin/professions?q=test%20e2e%20profession%20search"
  );
  await expect(
    page.getByRole("link", { name: "Delete Profession", exact: true })
  ).toHaveAttribute(
    "href",
    "/admin/professions/test-e2e-profession-search-b/delete?q=test%20e2e%20profession%20search"
  );

  // --- Search by SLUG ---------------------------------------------------
  await page.goto("/admin/professions");
  await page
    .getByRole("searchbox", { name: "Search professions" })
    .fill("test-e2e-profession-search-b");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(recordRow(page, "Test E2E Profession Search B")).toBeVisible();
  await expect(recordRow(page, "Test E2E Profession Search A")).toHaveCount(0);
  await expect(page.getByText("1 match", { exact: true })).toBeVisible();

  // --- No-match state (distinct from the no-professions-at-all state) ---
  await page
    .getByRole("searchbox", { name: "Search professions" })
    .fill("zzz-no-such-profession");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const emptyRegion = page.locator(".admin-record-empty");
  await expect(emptyRegion).toContainText("No professions match");
  await expect(emptyRegion).toContainText("zzz-no-such-profession");
  await expect(page.getByText("0 matches")).toBeVisible();

  // --- Clear search returns the full list -------------------------------
  await page.getByRole("link", { name: "Clear search", exact: true }).click();
  await expect(page).toHaveURL("/admin/professions");
  await expect(recordRow(page, "Smithing")).toBeVisible();
  await expect(recordRow(page, "Test E2E Profession Search A")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Clear search", exact: true })
  ).toHaveCount(0);
});

test("seeded fixtures are preserved and no test profession remains", async () => {
  expect(await readFixtureCounts()).toEqual({
    categories: 5,
    professions: 10,
    items: 16,
    recipes: 8,
    recipeIngredients: 15,
  });
  expect(await countE2eTestProfessionRecords()).toBe(0);
});
