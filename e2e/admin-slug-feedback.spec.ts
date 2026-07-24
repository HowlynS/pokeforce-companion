// Authenticated coverage for the Phase B1 (System B) Page-address field —
// edit-mode synchronization revised in the Admin Visual/UX Correction pass
// (Part 11) — live auto-generation from Name, manual-override tracking,
// and live slug-availability feedback — across all five slug-based
// resources (Item/Recipe/Profession/Category share one table-driven block
// against stable seeded fixtures; Location gets its own block since
// prisma/seed.ts seeds no Location rows at all). Mirrors
// admin-name-feedback.spec.ts's own structure and non-destructive design:
// no form submission in THIS file ever succeeds for a mutating purpose on
// the table-driven block (the one submission each resource attempts
// intentionally collides with a seeded slug, which the authoritative
// server action rejects, so no row is ever created, updated, or removed).
// The final test proves the seeded fixtures are unchanged. The Location
// block is the only one that creates/deletes its own temporary rows (no
// seed to read from), using the existing guard-first
// deleteE2eTestLocationRecords cleanup already relied on elsewhere.
//
// Part 11 removed the visible "Use name" reset control entirely (no test
// in this file references it) and changed edit-mode's STARTING behavior:
// edit now starts in auto-generation mode too, showing the PERSISTED Page
// address until Name actually changes, then tracking Name live exactly
// like create — manual override remains the one-way escape hatch on both.

import { expect, test, type Page } from "@playwright/test";
import { selectAdminOption } from "./helpers/admin-select";
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
      await selectAdminOption(
        page.getByRole("combobox", { name: "Resulting item", exact: true }),
        "Iron Ingot"
      );
      const group = page.getByRole("group", {
        name: "Ingredients (fill at least one row)",
      });
      await selectAdminOption(group.getByRole("combobox").nth(0), "Iron Ore");
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

for (const resource of RESOURCES) {
  test(`${resource.label} create form: Page address tracks Name live, including deleting and replacing words, until manually edited`, async ({
    page,
  }) => {
    await page.goto(resource.createUrl);

    // Auto-generation follows Name live from the first keystroke.
    await nameInput(page).fill("Test E2E Slug Autogen Demo");
    await expect(slugInput(page)).toHaveValue("test-e2e-slug-autogen-demo");

    // Deleting a word from Name updates Page address immediately.
    await nameInput(page).fill("Test E2E Slug Autogen");
    await expect(slugInput(page)).toHaveValue("test-e2e-slug-autogen");

    // Replacing a word updates it too.
    await nameInput(page).fill("Test E2E Slug Regenerated");
    await expect(slugInput(page)).toHaveValue("test-e2e-slug-regenerated");

    // Clearing Name entirely clears the automatically generated Page
    // address.
    await nameInput(page).fill("");
    await expect(slugInput(page)).toHaveValue("");

    // Typing Name again resumes auto-generation (nothing was manually
    // edited yet).
    await nameInput(page).fill("Test E2E Slug Autogen Resumed");
    await expect(slugInput(page)).toHaveValue("test-e2e-slug-autogen-resumed");

    // Manually editing the Page address stops it from following Name.
    await slugInput(page).fill("my-own-custom-address");
    await nameInput(page).fill("Test E2E Slug Autogen Final");
    await expect(slugInput(page)).toHaveValue("my-own-custom-address");

    // Clearing the manually-set value does not silently resume
    // auto-generation — manual override is a one-way, final state.
    await slugInput(page).fill("");
    await nameInput(page).fill("Test E2E Slug Autogen After Clear");
    await expect(slugInput(page)).toHaveValue("");

    // No "Use name" control exists anywhere on the page.
    await expect(
      page.getByRole("button", { name: "Use name", exact: true })
    ).toHaveCount(0);
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

  test(`${resource.label} edit form: starts showing the persisted Page address, then tracks Name live (deleting/replacing words) until manually edited`, async ({
    page,
  }) => {
    await page.goto(resource.editUrl);
    const feedback = page.locator(resource.slugRegionId);

    // Initial synchronization state: the PERSISTED slug, needing no
    // request at all — it is its own current value.
    await expect(slugInput(page)).toHaveValue(resource.seededSlug);
    await expect(feedback).toHaveText("");
    await expect(page).toHaveURL(resource.editUrl);

    // Editing Name updates Page address live, in real time — the
    // user-approved Part 11 behavior, even though it proposes a new URL
    // for an existing record. The route itself never changes while
    // typing (saving is still required for the URL to actually change).
    await nameInput(page).fill("Some Entirely Different Name");
    await expect(slugInput(page)).toHaveValue("some-entirely-different-name");
    await expect(page).toHaveURL(resource.editUrl);

    // Deleting a word from the (now-live-tracked) Name keeps updating it.
    await nameInput(page).fill("Some Entirely Different");
    await expect(slugInput(page)).toHaveValue("some-entirely-different");

    // Replacing a word keeps updating it too.
    await nameInput(page).fill("Some Totally Different");
    await expect(slugInput(page)).toHaveValue("some-totally-different");

    // A live-generated candidate that collides with a DIFFERENT record's
    // slug is correctly detected as taken — availability checking keeps
    // working after these automatic changes, not just after a manual
    // edit.
    await nameInput(page).fill(resource.otherSeededSlug);
    await expect(feedback).toHaveText(resource.slugTakenText);

    // Manually editing Page address stops it from following Name any
    // further.
    await slugInput(page).fill("my-manual-edit-address");
    await nameInput(page).fill("Yet Another Name Entirely");
    await expect(slugInput(page)).toHaveValue("my-manual-edit-address");

    // No "Use name" control exists, and no navigation ever occurred
    // purely from typing.
    await expect(
      page.getByRole("button", { name: "Use name", exact: true })
    ).toHaveCount(0);
    await expect(page).toHaveURL(resource.editUrl);
  });

  test(`${resource.label} edit form: returning Name to its original value re-shows the persisted Page address`, async ({
    page,
  }) => {
    await page.goto(resource.editUrl);
    const originalName = await nameInput(page).inputValue();

    await nameInput(page).fill("Temporarily Different Name");
    await expect(slugInput(page)).toHaveValue(
      "temporarily-different-name"
    );

    // Back to the exact original Name: the field is still in auto mode
    // (never manually touched), so it re-derives the persisted slug.
    await nameInput(page).fill(originalName);
    await expect(slugInput(page)).toHaveValue(resource.seededSlug);
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

test("Location create/edit: Page address live tracking, manual override, and availability (no seeded fixture — created and torn down here)", async ({
  page,
}) => {
  const PARENT = {
    name: "Test E2E Location Slug Feedback Parent",
    slug: "test-e2e-location-slug-feedback-parent",
  };

  // --- Create: same live-tracking/manual-override contract ---------------
  await page.goto("/admin/locations/new");
  await nameInput(page).fill(PARENT.name);
  await expect(slugInput(page)).toHaveValue(PARENT.slug);

  // Deleting a word still updates it live.
  await nameInput(page).fill("Test E2E Location Slug Feedback");
  await expect(slugInput(page)).toHaveValue(
    "test-e2e-location-slug-feedback"
  );

  await slugInput(page).fill("custom-location-address");
  await nameInput(page).fill("Test E2E Location Slug Feedback Parent Two");
  await expect(slugInput(page)).toHaveValue("custom-location-address");

  // Actually create it with the intended fixed name/slug pair for the
  // edit half below.
  await nameInput(page).fill(PARENT.name);
  await slugInput(page).fill(PARENT.slug);
  await selectAdminOption(
    page.getByRole("combobox", { name: "Type", exact: true }),
    "Region"
  );
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
  await selectAdminOption(
    page.getByRole("combobox", { name: "Type", exact: true }),
    "Town"
  );
  await page
    .getByRole("button", { name: "Create Location", exact: true })
    .click();
  await expect(page).toHaveURL("/admin/locations?success=created");

  // --- Edit: starts on the persisted slug, tracks Name live, another
  // record's slug is taken, manual edit stops sync -------------------------
  await page.goto(`/admin/locations/${PARENT.slug}/edit`);
  const feedback = page.locator("#location-slug-availability");

  await expect(slugInput(page)).toHaveValue(PARENT.slug);
  await expect(feedback).toHaveText("");

  await nameInput(page).fill("Something Else Entirely");
  await expect(slugInput(page)).toHaveValue("something-else-entirely");

  await slugInput(page).fill(CHILD.slug);
  await expect(feedback).toHaveText(
    "A location with that page address already exists."
  );

  await slugInput(page).fill("my-manual-location-address");
  await nameInput(page).fill("A Name Change After Manual Edit");
  await expect(slugInput(page)).toHaveValue("my-manual-location-address");
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
