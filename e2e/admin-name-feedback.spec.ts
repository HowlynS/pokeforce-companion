// Authenticated coverage for the live duplicate-name feedback on the REAL
// Category, Profession, and Recipe create/edit forms (the Item suite lives
// in admin-item-name-feedback.spec.ts). Runs in the chromium-admin project
// with the storage state saved by auth.setup.ts. NON-DESTRUCTIVE by design:
// no form submission ever succeeds (each resource's single submission
// attempt uses a seeded duplicate name, which the authoritative server
// action rejects), so no row, Auth user, or Storage object is ever created
// or removed — the final test proves it. Seeded names come from
// prisma/seed.ts.

import { expect, test, type Page } from "@playwright/test";
import { readFixtureCounts } from "./helpers/database-cleanup";

// Shared live-region texts (the taken text is per-resource below).
const AVAILABLE_TEXT = "This name is available.";
const CURRENT_TEXT = "This is the current name.";

type ResourceCase = {
  label: string;
  createUrl: string;
  editUrl: string;
  regionId: string;
  seededName: string;
  // The same seeded name with scrambled casing and surrounding whitespace.
  seededVariant: string;
  // A DIFFERENT seeded record's name, for the edit-conflict case.
  otherSeededName: string;
  // Never submitted anywhere; only typed to observe the available state.
  uniqueName: string;
  takenText: string;
  createButton: string;
  duplicateErrorUrl: string;
  // Extra required fields so a Recipe submission passes parsing and reaches
  // the duplicate check; a no-op for the other resources.
  fillRequiredFields?: (page: Page) => Promise<void>;
};

const RESOURCES: ResourceCase[] = [
  {
    label: "Category",
    createUrl: "/admin/categories",
    editUrl: "/admin/categories/materials/edit",
    regionId: "#category-name-availability",
    seededName: "Materials",
    seededVariant: "  mAtErIaLs  ",
    otherSeededName: "Tools",
    uniqueName: "Test E2E Unique Category Feedback",
    takenText: "A category with that name already exists.",
    createButton: "Create Category",
    duplicateErrorUrl: "/admin/categories?error=duplicate_name",
  },
  {
    label: "Profession",
    createUrl: "/admin/professions/new",
    editUrl: "/admin/professions/smithing/edit",
    regionId: "#profession-name-availability",
    seededName: "Smithing",
    seededVariant: "  sMiThInG  ",
    otherSeededName: "Alchemy",
    uniqueName: "Test E2E Unique Profession Feedback",
    takenText: "A profession with that name already exists.",
    createButton: "Create Profession",
    duplicateErrorUrl: "/admin/professions/new?error=duplicate_name",
  },
  {
    label: "Recipe",
    createUrl: "/admin/recipes/new",
    editUrl: "/admin/recipes/iron-sword/edit",
    regionId: "#recipe-name-availability",
    seededName: "Iron Sword",
    seededVariant: "  iRoN sWoRd  ",
    otherSeededName: "Charcoal",
    uniqueName: "Test E2E Unique Recipe Feedback",
    takenText: "A recipe with that name already exists.",
    createButton: "Create Recipe",
    duplicateErrorUrl: "/admin/recipes/new?error=duplicate_name",
    // Recipe parsing requires a resulting item and one ingredient row
    // before the action's duplicate check runs; seeded records are only
    // REFERENCED, never modified.
    fillRequiredFields: async (page) => {
      await page
        .getByRole("combobox", { name: "Resulting item", exact: true })
        .selectOption({ label: "Iron Ingot" });
      const group = page.getByRole("group", {
        name: "Ingredients (fill at least one row)",
      });
      await group
        .getByRole("combobox")
        .nth(0)
        .selectOption({ label: "Iron Ore" });
      await group.getByRole("spinbutton").nth(0).fill("1");
    },
  },
];

// Browser error hygiene: any uncaught page error fails the test. Serial
// single-worker execution makes this module-level state safe.
let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(() => {
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

function nameInput(page: Page) {
  return page.getByLabel("Name", { exact: true });
}

for (const resource of RESOURCES) {
  test(`${resource.label} create form reports availability accessibly`, async ({
    page,
  }) => {
    await page.goto(resource.createUrl);
    const feedback = page.locator(resource.regionId);

    // The polite live region is associated with the Name input and empty
    // while the name is blank (no request fires).
    await expect(nameInput(page)).toHaveAttribute(
      "aria-describedby",
      resource.regionId.slice(1)
    );
    await expect(feedback).toHaveAttribute("aria-live", "polite");
    await expect(feedback).toHaveText("");

    // A unique name reports available; the words carry the meaning.
    await nameInput(page).fill(resource.uniqueName);
    await expect(feedback).toHaveText(AVAILABLE_TEXT);

    // The seeded name with scrambled casing and whitespace is a duplicate,
    // using the resource's exact server wording.
    await nameInput(page).fill(resource.seededVariant);
    await expect(feedback).toHaveText(resource.takenText);

    // Clearing returns to the empty region.
    await nameInput(page).fill("");
    await expect(feedback).toHaveText("");
  });

  test(`${resource.label} edit form excludes itself and resolves rapid typing`, async ({
    page,
  }) => {
    await page.goto(resource.editUrl);
    const feedback = page.locator(resource.regionId);

    // The prefilled saved name needs no request at all, and casing or
    // whitespace variants of the OWN name stay "current".
    await expect(nameInput(page)).toHaveValue(resource.seededName);
    await expect(feedback).toHaveText(CURRENT_TEXT);
    await nameInput(page).fill(`  ${resource.seededName.toUpperCase()} `);
    await expect(feedback).toHaveText(CURRENT_TEXT);

    // Another existing record's name is detected as a duplicate.
    await nameInput(page).fill(resource.otherSeededName);
    await expect(feedback).toHaveText(resource.takenText);

    // Rapid typing: a duplicate immediately replaced by a unique name must
    // settle on the LATEST value and stay stable (stale answers dropped).
    await nameInput(page).fill(resource.otherSeededName);
    await nameInput(page).fill(resource.uniqueName);
    await expect(feedback).toHaveText(AVAILABLE_TEXT);
    await page.waitForTimeout(700);
    await expect(feedback).toHaveText(AVAILABLE_TEXT);
  });

  test(`${resource.label} duplicate submission remains rejected server-side`, async ({
    page,
  }) => {
    await page.goto(resource.createUrl);

    await nameInput(page).fill(resource.seededVariant);
    await page.locator(resource.regionId).getByText(resource.takenText);
    await resource.fillRequiredFields?.(page);

    // Submit despite the live warning: the server action, not the client
    // feedback, is the protection — the trimmed, case-insensitive
    // duplicate is rejected exactly as before and no row is created.
    await page
      .getByRole("button", { name: resource.createButton, exact: true })
      .click();

    await expect(page).toHaveURL(resource.duplicateErrorUrl);
    await expect(
      page.getByRole("alert").filter({ hasText: resource.takenText })
    ).toBeVisible();
  });
}

test("seeded fixtures are unchanged — the suite never wrote anything", async () => {
  expect(await readFixtureCounts()).toEqual({
    categories: 5,
    professions: 10,
    items: 16,
    recipes: 8,
    recipeIngredients: 15,
  });
});
