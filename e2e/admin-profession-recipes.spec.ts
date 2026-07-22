// Authenticated coverage for the Profession Recipes tab (Slice 9D.3): a
// real, read-only tab inside the Profession workspace showing every
// Recipe linked to the selected Profession, each linking to the EXISTING
// Recipe admin edit route. No inline recipe editing, unlink control, or
// create-recipe form exists on this tab, so there is nothing here that
// duplicates admin-recipes.spec.ts's own CRUD coverage. Mirrors
// admin-item-recipes.spec.ts's (Slice 9B.7) structure exactly, adapted to
// a single relationship direction (Profession -> Recipe).
//
// Runs in the chromium-admin project with the storage state saved by
// auth.setup.ts. Every temporary Profession uses the test-e2e-profession
// slug prefix; the Recipe/Item fixtures reuse the existing
// test-e2e-profession-relation- DB helpers already relied on by
// admin-professions.spec.ts's blocked-deletion test, so cleanup
// (deleteE2eTestProfessionRecords) is already guard-first and exhaustive —
// no new cleanup surface is introduced.

import { expect, test, type Page } from "@playwright/test";
import {
  countE2eTestProfessionRecords,
  createTemporaryRecipeForProfessionsTab,
  deleteE2eTestProfessionRecords,
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
  await deleteE2eTestProfessionRecords();
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

test.beforeAll(async () => {
  await deleteE2eTestProfessionRecords();
  expect(await countE2eTestProfessionRecords()).toBe(0);
});

test.afterAll(async () => {
  const remaining = await deleteE2eTestProfessionRecords();
  expect(remaining).toBe(0);
});

// One row of the shared Profession record list, located by its exact
// primary text inside the list's navigation landmark.
function recordRow(page: Page, name: string) {
  return page
    .getByRole("navigation", { name: "Professions records" })
    .getByRole("link")
    .filter({ has: page.getByText(name, { exact: true }) });
}

function tabNav(page: Page) {
  return page.getByRole("navigation", { name: "Profession editor sections" });
}

async function createTemporaryProfession(
  page: Page,
  data: { name: string; slug: string }
) {
  await page.goto("/admin/professions/new");
  await page.getByLabel("Name", { exact: true }).fill(data.name);
  await page.getByLabel(/^Slug/).fill(data.slug);
  await page
    .getByRole("button", { name: "Create Profession", exact: true })
    .click();
  await expect(page).toHaveURL("/admin/professions?success=created");
}

test("opening the Recipes tab directly shows the linked recipes inside the Profession workspace", async ({
  page,
}) => {
  const PROFESSION = {
    name: "Test E2E Profession Recipes Tab",
    slug: "test-e2e-profession-recipes-tab",
  };
  await createTemporaryProfession(page, PROFESSION);
  // Created out of alphabetical order, so the page's own ordering — not
  // insertion order — is what determines row order. Only the second
  // recipe carries a Required level, proving the hide-empty behavior.
  await createTemporaryRecipeForProfessionsTab(PROFESSION.slug, {
    suffix: "zeta",
    recipeName: "Zeta Test E2E Profession Recipes Tab Recipe",
    resultingQuantity: 3,
  });
  await createTemporaryRecipeForProfessionsTab(PROFESSION.slug, {
    suffix: "alpha",
    recipeName: "Alpha Test E2E Profession Recipes Tab Recipe",
    resultingQuantity: 1,
    requiredLevel: 9,
  });

  await page.goto(`/admin/professions/${PROFESSION.slug}/recipes`);

  // One h1: the profession's own name; the record list stays visible with
  // this profession selected; the Recipes tab is marked active.
  await expect(
    page.getByRole("heading", { level: 1, name: PROFESSION.name, exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Professions records" })
  ).toBeVisible();
  await expect(recordRow(page, PROFESSION.name)).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(
    tabNav(page).getByRole("link", { name: "Recipes", exact: true })
  ).toHaveAttribute("aria-current", "page");

  const table = page.getByRole("table");
  await expect(table).toBeVisible();
  const rows = table.getByRole("row");
  // Header row plus exactly two data rows.
  await expect(rows).toHaveCount(3);

  // Alphabetical order: "Alpha..." renders before "Zeta...", even though
  // it was created second. The recipe name is located via its LINK (the
  // cell's own accessible name also concatenates the Required level detail
  // line when present, so an exact cell-name match would be wrong here).
  const firstDataRow = rows.nth(1);
  const secondDataRow = rows.nth(2);
  await expect(
    firstDataRow.getByRole("link", {
      name: "Alpha Test E2E Profession Recipes Tab Recipe",
      exact: true,
    })
  ).toBeVisible();
  await expect(
    secondDataRow.getByRole("link", {
      name: "Zeta Test E2E Profession Recipes Tab Recipe",
      exact: true,
    })
  ).toBeVisible();

  // Three cells per row: Recipe, Resulting Item, Quantity. No separate
  // Profession column exists — the current Profession is already the page
  // context.
  await expect(firstDataRow.getByRole("cell")).toHaveCount(3);
  await expect(
    firstDataRow.getByRole("cell", {
      name: "Test E2E Profession Recipes Tab Result alpha",
      exact: true,
    })
  ).toBeVisible();
  await expect(
    firstDataRow.getByRole("cell", { name: "1", exact: true })
  ).toBeVisible();
  // Required level IS set on this row: a labeled detail line renders.
  await expect(
    firstDataRow.getByText("Required level: 9", { exact: true })
  ).toBeVisible();

  // The other row has no Required level: no placeholder dash, no
  // "Required level:" label, and no blank cell of its own — the row still
  // has exactly three cells.
  await expect(secondDataRow.getByRole("cell")).toHaveCount(3);
  await expect(
    secondDataRow.getByRole("cell", {
      name: "Test E2E Profession Recipes Tab Result zeta",
      exact: true,
    })
  ).toBeVisible();
  await expect(
    secondDataRow.getByRole("cell", { name: "3", exact: true })
  ).toBeVisible();
  await expect(secondDataRow.getByText("Required level:")).toHaveCount(0);
  await expect(secondDataRow.getByText("—", { exact: true })).toHaveCount(0);

  // The recipe link goes to the EXISTING Recipe admin edit route — no
  // inline editing lives on this tab.
  const recipeLink = firstDataRow.getByRole("link", {
    name: "Alpha Test E2E Profession Recipes Tab Recipe",
    exact: true,
  });
  await expect(recipeLink).toHaveAttribute(
    "href",
    /^\/admin\/recipes\/.+\/edit$/
  );
  await recipeLink.click();
  await expect(page).toHaveURL(/\/admin\/recipes\/.+\/edit$/);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Alpha Test E2E Profession Recipes Tab Recipe",
      exact: true,
    })
  ).toBeVisible();
});

test("switching professions while on the Recipes tab preserves the tab and q", async ({
  page,
}) => {
  const PROFESSION_A = {
    name: "Test E2E Profession Recipes Switch A",
    slug: "test-e2e-profession-recipes-switch-a",
  };
  const PROFESSION_B = {
    name: "Test E2E Profession Recipes Switch B",
    slug: "test-e2e-profession-recipes-switch-b",
  };
  await createTemporaryProfession(page, PROFESSION_A);
  await createTemporaryProfession(page, PROFESSION_B);
  await createTemporaryRecipeForProfessionsTab(PROFESSION_A.slug, {
    suffix: "switch",
    recipeName: "Test E2E Profession Recipes Switch Recipe",
  });

  // A shared, distinguishing query so only these two temporary professions
  // match.
  await page.goto("/admin/professions");
  await page
    .getByRole("searchbox", { name: "Search professions" })
    .fill("test e2e profession recipes switch");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(recordRow(page, PROFESSION_A.name)).toBeVisible();
  await expect(recordRow(page, PROFESSION_B.name)).toBeVisible();

  await recordRow(page, PROFESSION_A.name).click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/professions/${PROFESSION_A.slug}/edit\\?q=`)
  );

  await tabNav(page).getByRole("link", { name: "Recipes", exact: true }).click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/professions/${PROFESSION_A.slug}/recipes\\?q=`)
  );
  await expect(recordRow(page, PROFESSION_A.name)).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(
    page.getByRole("cell", {
      name: "Test E2E Profession Recipes Switch Recipe",
      exact: true,
    })
  ).toBeVisible();

  // Switching records while ON the Recipes tab opens the OTHER
  // profession's Recipes tab — not its General tab — with q intact.
  await recordRow(page, PROFESSION_B.name).click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/professions/${PROFESSION_B.slug}/recipes\\?q=`)
  );
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: PROFESSION_B.name,
      exact: true,
    })
  ).toBeVisible();
  await expect(
    tabNav(page).getByRole("link", { name: "Recipes", exact: true })
  ).toHaveAttribute("aria-current", "page");
  await expect(recordRow(page, PROFESSION_B.name)).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(recordRow(page, PROFESSION_A.name)).not.toHaveAttribute(
    "aria-current",
    "page"
  );
  // Profession B has no linked recipe: a valid empty tab state, not an
  // error.
  await expect(
    page.getByText("No recipes use this profession yet")
  ).toBeVisible();
});

test("a profession with no linked recipe shows a valid empty state", async ({
  page,
}) => {
  const PROFESSION = {
    name: "Test E2E Profession Recipes Empty",
    slug: "test-e2e-profession-recipes-empty",
  };
  await createTemporaryProfession(page, PROFESSION);

  await page.goto(`/admin/professions/${PROFESSION.slug}/recipes`);
  await expect(
    page.getByRole("heading", { level: 1, name: PROFESSION.name, exact: true })
  ).toBeVisible();
  await expect(
    page.getByText("No recipes use this profession yet")
  ).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
});

test("General remains a real link from the Recipes tab, and no Profession tab is disabled", async ({
  page,
}) => {
  const PROFESSION = {
    name: "Test E2E Profession Recipes Nav",
    slug: "test-e2e-profession-recipes-nav",
  };
  await createTemporaryProfession(page, PROFESSION);

  await page.goto(`/admin/professions/${PROFESSION.slug}/recipes`);
  await expect(
    tabNav(page).getByRole("link", { name: "Recipes", exact: true })
  ).toHaveAttribute("aria-current", "page");
  await expect(tabNav(page).locator('[aria-current="page"]')).toHaveCount(1);

  // The Metadata tab was removed (Visual Pass sub-slice 4) — every
  // remaining Profession tab (General, Recipes) is a real link; none is
  // a disabled placeholder.
  await expect(tabNav(page).getByRole("link")).toHaveCount(2);
  await expect(tabNav(page).locator('[aria-disabled="true"]')).toHaveCount(0);

  await tabNav(page).getByRole("link", { name: "General", exact: true }).click();
  await expect(page).toHaveURL(`/admin/professions/${PROFESSION.slug}/edit`);
  await expect(
    tabNav(page).getByRole("link", { name: "General", exact: true })
  ).toHaveAttribute("aria-current", "page");

  await tabNav(page).getByRole("link", { name: "Recipes", exact: true }).click();
  await expect(page).toHaveURL(`/admin/professions/${PROFESSION.slug}/recipes`);
  await expect(
    tabNav(page).getByRole("link", { name: "Recipes", exact: true })
  ).toHaveAttribute("aria-current", "page");
});

test("the Recipes tab renders no form, mutation control, or image/verification control", async ({
  page,
}) => {
  const PROFESSION = {
    name: "Test E2E Profession Recipes ReadOnly",
    slug: "test-e2e-profession-recipes-readonly",
  };
  await createTemporaryProfession(page, PROFESSION);
  await createTemporaryRecipeForProfessionsTab(PROFESSION.slug, {
    suffix: "readonly",
    recipeName: "Test E2E Profession Recipes ReadOnly Recipe",
  });

  await page.goto(`/admin/professions/${PROFESSION.slug}/recipes`);

  // Strictly read-only, scoped to the workspace's main content region:
  // the record list's own search form (a plain GET, not a mutation) is
  // outside this region and is expected to stay on-screen, matching the
  // Item/Recipe Metadata tabs' precedent for this exact assertion shape.
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
  await expect(main.getByText("Delete Profession")).toHaveCount(0);
});

test("an unknown profession slug fails safely on the recipes route", async ({
  page,
}) => {
  const response = await page.goto(
    "/admin/professions/test-e2e-profession-recipes-does-not-exist/recipes"
  );
  expect(response?.status()).toBe(404);
});

test("seeded fixtures are preserved and no test profession or relation record remains", async () => {
  expect(await readFixtureCounts()).toEqual({
    categories: 5,
    professions: 10,
    items: 16,
    recipes: 8,
    recipeIngredients: 15,
  });
  expect(await countE2eTestProfessionRecords()).toBe(0);
});
