// Authenticated coverage for the Phase B1 (System B) Page-address field —
// live auto-generation from Name, manual-override tracking, the "Use
// name" reset control, and live slug-availability feedback — across all
// five slug-based resources (Item/Recipe/Profession/Category share one
// table-driven block against stable seeded fixtures; Location gets its
// own block since prisma/seed.ts seeds no Location rows at all). Mirrors
// admin-name-feedback.spec.ts's own structure and non-destructive design:
// no form submission in THIS file ever succeeds for a mutating purpose —
// the one submission each resource attempts intentionally collides with a
// seeded slug, which the authoritative server action rejects, so no row
// is ever created, updated, or removed by the table-driven block. The
// final test proves the seeded fixtures are unchanged. The Location block
// is the only one that creates/deletes its own temporary rows (no seed to
// read from), using the existing guard-first
// deleteE2eTestLocationRecords cleanup already relied on elsewhere.

import { expect, test, type Page } from "@playwright/test";
import {
  countE2eTestLocationRecords,
  deleteE2eTestLocationRecords,
  readFixtureCounts,
} from "./helpers/database-cleanup";

type ResourceCase = {
  label: string;
  createUrl: string;
  editUrl: string;
  slugRegionId: string;
  seededSlug: string;
  otherSeededSlug: string;
  uniqueName: string;
  slugTakenText: string;
  createButton: string;
  duplicateErrorUrl: string;
  fillRequiredFields?: (page: Page) => Promise<void>;
};

const RESOURCES: ResourceCase[] = [
  {
    label: "Item",
    createUrl: "/admin/items/new",
    editUrl: "/admin/items/iron-ore/edit",
    slugRegionId: "#item-slug-availability",
    seededSlug: "iron-ore",
    otherSeededSlug: "copper-ore",
    uniqueName: "Test E2E Unique Item Slug Feedback",
    slugTakenText: "An item with that page address already exists.",
    createButton: "Create item",
    duplicateErrorUrl: "/admin/items/new?error=duplicate",
  },
  {
    label: "Category",
    createUrl: "/admin/categories/new",
    editUrl: "/admin/categories/materials/edit",
    slugRegionId: "#category-slug-availability",
    seededSlug: "materials",
    otherSeededSlug: "tools",
    uniqueName: "Test E2E Unique Category Slug Feedback",
    slugTakenText: "A category with that page address already exists.",
    createButton: "Create Category",
    duplicateErrorUrl: "/admin/categories/new?error=duplicate",
  },
  {
    label: "Profession",
    createUrl: "/admin/professions/new",
    editUrl: "/admin/professions/smithing/edit",
    slugRegionId: "#profession-slug-availability",
    seededSlug: "smithing",
    otherSeededSlug: "alchemy",
    uniqueName: "Test E2E Unique Profession Slug Feedback",
    slugTakenText: "A profession with that page address already exists.",
    createButton: "Create Profession",
    duplicateErrorUrl: "/admin/professions/new?error=duplicate",
  },
  {
    label: "Recipe",
    createUrl: "/admin/recipes/new",
    editUrl: "/admin/recipes/iron-sword/edit",
    slugRegionId: "#recipe-slug-availability",
    seededSlug: "iron-sword",
    otherSeededSlug: "charcoal",
    uniqueName: "Test E2E Unique Recipe Slug Feedback",
    slugTakenText: "A recipe with that page address already exists.",
    createButton: "Create Recipe",
    duplicateErrorUrl: "/admin/recipes/new?error=duplicate",
    fillRequiredFields: async (page) => {
      await page
        .getByRole("combobox", { name: "Resulting item", exact: true })
        .selectOption({ label: "Iron Ingot" });
      const group = page.getByRole("group", {
        name: "Ingredients (fill at least one row)",
      });
      await group.getByRole("combobox").nth(0).selectOption({ label: "Iron Ore" });
      await group.getByRole("spinbutton").nth(0).fill("1");
    },
  },
];

let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(async () => {
  // Unconditional (pass or fail), matching the rest of the suite's own
  // guard-first pattern: a mid-test failure in the Location test below
  // can never strand a temporary row. A harmless no-op for every other
  // resource's tests here, which never create real Location rows.
  await deleteE2eTestLocationRecords();
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

test.beforeAll(async () => {
  // Removes stale rows from any earlier interrupted run before this file
  // creates its own.
  await deleteE2eTestLocationRecords();
  expect(await countE2eTestLocationRecords()).toBe(0);
});

function nameInput(page: Page) {
  return page.getByLabel("Name", { exact: true });
}

function slugInput(page: Page) {
  return page.getByLabel(/^Page address/);
}

function useNameButton(page: Page) {
  return page.getByRole("button", { name: "Use name", exact: true });
}

for (const resource of RESOURCES) {
  test(`${resource.label} create form: Page address auto-generates from Name, manual edit stops it, and Use name resumes it`, async ({
    page,
  }) => {
    await page.goto(resource.createUrl);

    // Auto-generation follows Name live.
    await nameInput(page).fill("Test E2E Slug Autogen Demo");
    await expect(slugInput(page)).toHaveValue("test-e2e-slug-autogen-demo");
    await nameInput(page).fill("Test E2E Slug Autogen Demo Two");
    await expect(slugInput(page)).toHaveValue("test-e2e-slug-autogen-demo-two");

    // Manually editing the Page address stops it from following Name.
    await slugInput(page).fill("my-own-custom-address");
    await nameInput(page).fill("Test E2E Slug Autogen Demo Three");
    await expect(slugInput(page)).toHaveValue("my-own-custom-address");

    // Deleting the manual value entirely does not silently resume
    // auto-generation.
    await slugInput(page).fill("");
    await nameInput(page).fill("Test E2E Slug Autogen Demo Four");
    await expect(slugInput(page)).toHaveValue("");

    // "Use name" deliberately resumes auto-generation from the CURRENT
    // Name, and Name changes keep updating it again afterward.
    await useNameButton(page).click();
    await expect(slugInput(page)).toHaveValue(
      "test-e2e-slug-autogen-demo-four"
    );
    await nameInput(page).fill("Test E2E Slug Autogen Demo Five");
    await expect(slugInput(page)).toHaveValue(
      "test-e2e-slug-autogen-demo-five"
    );
  });

  test(`${resource.label} create form: live availability feedback for available and taken Page addresses`, async ({
    page,
  }) => {
    await page.goto(resource.createUrl);
    const feedback = page.locator(resource.slugRegionId);

    await expect(slugInput(page)).toHaveAttribute(
      "aria-describedby",
      resource.slugRegionId.slice(1)
    );
    await expect(feedback).toHaveAttribute("aria-live", "polite");
    await expect(feedback).toHaveText("");

    // A unique manually-entered Page address is available: no visible text.
    await slugInput(page).fill("test-e2e-unique-slug-availability-demo");
    await expect(feedback).toHaveText("Page address is available.");

    // The seeded slug is taken.
    await slugInput(page).fill(resource.seededSlug);
    await expect(feedback).toHaveText(resource.slugTakenText);

    // Blank shows nothing (never checked).
    await slugInput(page).fill("");
    await expect(feedback).toHaveText("");
  });

  test(`${resource.label} create form: rapid typing settles on the latest Page address, never a stale answer`, async ({
    page,
  }) => {
    await page.goto(resource.createUrl);
    const feedback = page.locator(resource.slugRegionId);

    await slugInput(page).fill(resource.seededSlug);
    await slugInput(page).fill("test-e2e-unique-rapid-slug-demo");
    await expect(feedback).toHaveText("Page address is available.");
    await page.waitForTimeout(700);
    await expect(feedback).toHaveText("Page address is available.");
  });

  test(`${resource.label} edit form: Page address starts manual, Name changes never touch the persisted value, and the current slug is accepted`, async ({
    page,
  }) => {
    await page.goto(resource.editUrl);
    const feedback = page.locator(resource.slugRegionId);

    // The persisted slug needs no request at all — it is its own current
    // value — rendering the same blank feedback a valid slug always gets.
    await expect(slugInput(page)).toHaveValue(resource.seededSlug);
    await expect(feedback).toHaveText("");

    // Editing Name must never rewrite the already-persisted Page address —
    // it starts manually controlled, protecting the existing URL.
    await nameInput(page).fill("Some Entirely Different Name");
    await expect(slugInput(page)).toHaveValue(resource.seededSlug);

    // A DIFFERENT existing record's slug is still detected as taken.
    await slugInput(page).fill(resource.otherSeededSlug);
    await expect(feedback).toHaveText(resource.slugTakenText);

    // Explicitly asking to regenerate from Name works deliberately on edit
    // too.
    await useNameButton(page).click();
    await expect(slugInput(page)).toHaveValue(
      "some-entirely-different-name"
    );
  });

  test(`${resource.label} duplicate Page address submission remains rejected server-side`, async ({
    page,
  }) => {
    await page.goto(resource.createUrl);

    await nameInput(page).fill(resource.uniqueName);
    await slugInput(page).fill(resource.seededSlug);
    await expect(
      page.locator(resource.slugRegionId)
    ).toHaveText(resource.slugTakenText);
    await resource.fillRequiredFields?.(page);

    // Submit despite the live warning: the server action, not the client
    // feedback, is the protection.
    await page
      .getByRole("button", { name: resource.createButton, exact: true })
      .click();

    await expect(page).toHaveURL(resource.duplicateErrorUrl);
    await expect(
      page.getByRole("alert").filter({
        hasText: /already exists/,
      })
    ).toBeVisible();
  });
}

test("blank and structurally invalid Page addresses never claim availability", async ({
  page,
}) => {
  await page.goto("/admin/items/new");
  const feedback = page.locator("#item-slug-availability");

  await expect(feedback).toHaveText("");

  await slugInput(page).fill("!!!");
  await expect(feedback).toHaveText(
    "Enter a valid slug using lowercase letters, numbers, and hyphens."
  );
  await expect(feedback).not.toHaveText("Page address is available.");

  await slugInput(page).fill("");
  await expect(feedback).toHaveText("");
});

test("the Page address feedback row has a fixed height that never moves the Description field, on both create and edit", async ({
  page,
}) => {
  await page.goto("/admin/items/new");
  // Let web fonts finish loading before the first measurement — a
  // font-swap reflow shortly after navigation is unrelated to this
  // field's own layout and would otherwise read as a false positive here.
  await page.evaluate(() => document.fonts.ready);
  const descriptionBefore = await page
    .getByLabel(/^Description/)
    .boundingBox();

  await nameInput(page).fill("Test E2E Fixed Height Demo");
  await slugInput(page).fill("iron-ore"); // triggers the longest "taken" message
  await expect(page.locator("#item-slug-availability")).toHaveText(
    "An item with that page address already exists."
  );
  const descriptionAfter = await page.getByLabel(/^Description/).boundingBox();

  expect(descriptionAfter?.y).toBe(descriptionBefore?.y);
});

test("Location create/edit: Page address auto-generation, manual override, reset, and availability (no seeded fixture — created and torn down here)", async ({
  page,
}) => {
  const PARENT = {
    name: "Test E2E Location Slug Feedback Parent",
    slug: "test-e2e-location-slug-feedback-parent",
  };

  // --- Create: same auto-generation/manual-override/reset contract -------
  await page.goto("/admin/locations/new");
  await nameInput(page).fill(PARENT.name);
  await expect(slugInput(page)).toHaveValue(PARENT.slug);

  await slugInput(page).fill("custom-location-address");
  await nameInput(page).fill("Test E2E Location Slug Feedback Parent Two");
  await expect(slugInput(page)).toHaveValue("custom-location-address");

  await useNameButton(page).click();
  await expect(slugInput(page)).toHaveValue(
    "test-e2e-location-slug-feedback-parent-two"
  );

  // Actually create it with the intended fixed name/slug pair for the
  // edit half below.
  await nameInput(page).fill(PARENT.name);
  await slugInput(page).fill(PARENT.slug);
  await page
    .getByRole("combobox", { name: "Type", exact: true })
    .selectOption({ label: "Region" });
  await page
    .getByRole("button", { name: "Create Location", exact: true })
    .click();
  await expect(page).toHaveURL("/admin/locations?success=created");

  // --- A second Location to exercise "another record's slug is taken" ---
  await page.goto("/admin/locations/new");
  const CHILD = {
    name: "Test E2E Location Slug Feedback Other",
    slug: "test-e2e-location-slug-feedback-other",
  };
  await nameInput(page).fill(CHILD.name);
  await page
    .getByRole("combobox", { name: "Type", exact: true })
    .selectOption({ label: "Town" });
  await page
    .getByRole("button", { name: "Create Location", exact: true })
    .click();
  await expect(page).toHaveURL("/admin/locations?success=created");

  // --- Edit: manual from the start, Name never touches the persisted
  // slug, another record's slug is taken, reset works deliberately -------
  await page.goto(`/admin/locations/${PARENT.slug}/edit`);
  const feedback = page.locator("#location-slug-availability");

  await expect(slugInput(page)).toHaveValue(PARENT.slug);
  await expect(feedback).toHaveText("");

  await nameInput(page).fill("Something Else Entirely");
  await expect(slugInput(page)).toHaveValue(PARENT.slug);

  await slugInput(page).fill(CHILD.slug);
  await expect(feedback).toHaveText(
    "A location with that page address already exists."
  );

  await useNameButton(page).click();
  await expect(slugInput(page)).toHaveValue("something-else-entirely");
});

test("seeded fixtures are unchanged — the table-driven suite never wrote anything", async () => {
  expect(await readFixtureCounts()).toEqual({
    categories: 5,
    professions: 10,
    items: 16,
    recipes: 8,
    recipeIngredients: 15,
  });
});
