// Coverage for the public "How to obtain" section on /items/[slug] (Slice
// 8E). Runs in the chromium-admin project (authenticated) because building
// each fixture requires the real admin create forms for Item, Location,
// Profession, Recipe, and AcquisitionSource — the assertions themselves are
// against the PUBLIC item page, which needs no authentication. Every
// fixture created here uses the test-e2e-acqsrc- prefixes shared with
// admin-item-sources.spec.ts and is removed by the same guard-first,
// prefix-scoped cleanup (which also handles the Recipe the
// crafting-coexistence test creates, since Recipe.resultingItemId is
// ON DELETE RESTRICT).

import { expect, test, type Page } from "@playwright/test";
import { selectAdminOption } from "./helpers/admin-select";
import {
  countE2eTestAcquisitionRecords,
  deleteE2eTestAcquisitionRecords,
} from "./helpers/database-cleanup";

// Browser error hygiene: any uncaught page error fails the test. Serial
// single-worker execution makes this module-level state safe.
let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(async () => {
  await deleteE2eTestAcquisitionRecords();
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

test.beforeAll(async () => {
  await deleteE2eTestAcquisitionRecords();
  expect(await countE2eTestAcquisitionRecords()).toBe(0);
});

test.afterAll(async () => {
  const remaining = await deleteE2eTestAcquisitionRecords();
  expect(remaining).toBe(0);
});

// The public card renders its title as an h3 inside the card link (or a
// plain h3 inside a non-link <article> when the card has no href).
function cardTitle(page: Page, name: string) {
  return page.getByRole("heading", { level: 3, name, exact: true });
}

function cardLink(page: Page, name: string) {
  return page.getByRole("link").filter({ has: cardTitle(page, name) });
}

async function createTemporaryItem(page: Page, data: { name: string; slug: string }) {
  await page.goto("/admin/items/new");
  await page.getByLabel("Name", { exact: true }).fill(data.name);
  await page.getByLabel(/^Page address/).fill(data.slug);
  await page.getByRole("button", { name: "Create item", exact: true }).click();
  await expect(page).toHaveURL("/admin/items?success=created");
}

async function addSourceThroughForm(
  page: Page,
  itemSlug: string,
  data: {
    type: string;
    locationName?: string;
    professionName?: string;
    sourceLabel?: string;
    quantity?: string;
    notes?: string;
  }
) {
  await page.goto(`/admin/items/${itemSlug}/sources`);
  await selectAdminOption(
    page.getByRole("combobox", { name: "Type", exact: true }),
    data.type
  );
  if (data.locationName) {
    await selectAdminOption(
      page.getByRole("combobox", { name: "Location (optional)", exact: true }),
      data.locationName
    );
  }
  if (data.professionName) {
    await selectAdminOption(
      page.getByRole("combobox", { name: "Profession (optional)", exact: true }),
      data.professionName
    );
  }
  if (data.sourceLabel) {
    await page.getByLabel(/^Source label/).fill(data.sourceLabel);
  }
  if (data.quantity) {
    await page.getByLabel(/^Quantity/).fill(data.quantity);
  }
  if (data.notes) {
    await page.getByLabel(/^Notes/).fill(data.notes);
  }
  await page.getByRole("button", { name: "Add Source", exact: true }).click();
  await expect(page).toHaveURL(
    `/admin/items/${itemSlug}/sources?success=created`
  );
}

test("no How to obtain heading appears when an item has zero acquisition sources", async ({
  page,
}) => {
  const ITEM = {
    name: "Test E2E Acqsrc Item Zero Sources",
    slug: "test-e2e-acqsrc-item-zero",
  };
  await createTemporaryItem(page, ITEM);

  await page.goto(`/items/${ITEM.slug}`);
  await expect(
    page.getByRole("heading", { level: 1, name: ITEM.name, exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "How to obtain", exact: true })
  ).toHaveCount(0);
});

test("a single partial source (type only) renders cleanly with no empty text", async ({
  page,
}) => {
  const ITEM = {
    name: "Test E2E Acqsrc Item Partial",
    slug: "test-e2e-acqsrc-item-partial",
  };
  await createTemporaryItem(page, ITEM);
  await addSourceThroughForm(page, ITEM.slug, { type: "Foraging" });

  await page.goto(`/items/${ITEM.slug}`);
  await expect(
    page.getByRole("heading", { level: 2, name: "How to obtain", exact: true })
  ).toBeVisible();
  // The type label doubles as both the group label and (with nothing else
  // populated) the card's own title.
  await expect(page.getByText("Foraging").first()).toBeVisible();
  // No stray labelled-but-empty facts for the fields that were never set.
  await expect(page.getByText("Profession:", { exact: false })).toHaveCount(0);
  await expect(page.getByText("Quantity:", { exact: false })).toHaveCount(0);
  await expect(page.getByText("Notes:", { exact: false })).toHaveCount(0);
  await expect(page.getByText("Source:", { exact: false })).toHaveCount(0);
});

test("multiple acquisition types group and label correctly, each with its own sources", async ({
  page,
}) => {
  const ITEM = {
    name: "Test E2E Acqsrc Item Multi Type",
    slug: "test-e2e-acqsrc-item-multi-type",
  };
  await createTemporaryItem(page, ITEM);
  await addSourceThroughForm(page, ITEM.slug, {
    type: "Foraging",
    sourceLabel: "Forest Clearing",
  });
  await addSourceThroughForm(page, ITEM.slug, {
    type: "Mining",
    sourceLabel: "Old Quarry",
  });
  await addSourceThroughForm(page, ITEM.slug, {
    type: "Mining",
    sourceLabel: "Deep Cavern",
  });

  await page.goto(`/items/${ITEM.slug}`);
  await expect(
    page.getByRole("heading", { level: 2, name: "How to obtain", exact: true })
  ).toBeVisible();

  // Both type labels are present as group labels...
  await expect(page.getByText("Foraging", { exact: true })).toBeVisible();
  await expect(page.getByText("Mining", { exact: true })).toBeVisible();
  // ...and every individual source card renders, including both sources
  // that share the Mining type.
  await expect(cardTitle(page, "Forest Clearing")).toBeVisible();
  await expect(cardTitle(page, "Old Quarry")).toBeVisible();
  await expect(cardTitle(page, "Deep Cavern")).toBeVisible();
});

test("a source's location links to its public location page", async ({
  page,
}) => {
  const ITEM = {
    name: "Test E2E Acqsrc Item Location Link",
    slug: "test-e2e-acqsrc-item-location-link",
  };
  const LOCATION = {
    name: "Test E2E Acqsrc Location Link",
    slug: "test-e2e-acqsrc-location-link",
    type: "Route",
  };
  await createTemporaryItem(page, ITEM);

  await page.goto("/admin/locations/new");
  await page.getByLabel("Name", { exact: true }).fill(LOCATION.name);
  await page.getByLabel(/^Page address/).fill(LOCATION.slug);
  await selectAdminOption(
    page.getByRole("combobox", { name: "Type", exact: true }),
    LOCATION.type
  );
  await page
    .getByRole("button", { name: "Create Location", exact: true })
    .click();
  await expect(page).toHaveURL("/admin/locations?success=created");

  await addSourceThroughForm(page, ITEM.slug, {
    type: "Fishing",
    locationName: LOCATION.name,
  });

  await page.goto(`/items/${ITEM.slug}`);
  const locationCard = cardLink(page, LOCATION.name);
  await expect(locationCard).toBeVisible();
  await expect(locationCard).toHaveAttribute(
    "href",
    `/locations/${LOCATION.slug}`
  );

  await locationCard.click();
  await expect(page).toHaveURL(`/locations/${LOCATION.slug}`);
  await expect(
    page.getByRole("heading", { level: 1, name: LOCATION.name, exact: true })
  ).toBeVisible();
});

test("optional profession, source label, quantity, and notes render only when populated", async ({
  page,
}) => {
  const ITEM = {
    name: "Test E2E Acqsrc Item Optional Fields",
    slug: "test-e2e-acqsrc-item-optional",
  };
  const PROFESSION = {
    name: "Test E2E Acqsrc Profession Optional",
    slug: "test-e2e-acqsrc-profession-optional",
  };
  await createTemporaryItem(page, ITEM);

  await page.goto("/admin/professions/new");
  await page.getByLabel("Name", { exact: true }).fill(PROFESSION.name);
  await page.getByLabel(/^Page address/).fill(PROFESSION.slug);
  await page
    .getByRole("button", { name: "Create Profession", exact: true })
    .click();
  await expect(page).toHaveURL("/admin/professions?success=created");

  // One source with every optional field populated...
  await addSourceThroughForm(page, ITEM.slug, {
    type: "Cooking",
    professionName: PROFESSION.name,
    sourceLabel: "Camp Kitchen",
    quantity: "1-2",
    notes: "Requires a lit campfire.",
  });
  // ...and a sibling in a DIFFERENT type with none of them set.
  await addSourceThroughForm(page, ITEM.slug, { type: "Event" });

  await page.goto(`/items/${ITEM.slug}`);

  const populatedCard = cardTitle(page, "Camp Kitchen");
  await expect(populatedCard).toBeVisible();
  await expect(
    page.getByText(`Profession: ${PROFESSION.name}`)
  ).toBeVisible();
  await expect(page.getByText("Quantity: 1-2")).toBeVisible();
  await expect(
    page.getByText("Notes: Requires a lit campfire.")
  ).toBeVisible();

  // The sparse Event-type source falls back to the type label as its own
  // card title (in addition to the group label above it, which uses the
  // same text — checked precisely by role so the two are not conflated).
  await expect(cardTitle(page, "Event")).toBeVisible();
});

test("acquisition sources are never described as an exhaustive list", async ({
  page,
}) => {
  // Deliberately avoids the words "exhaustive"/"sources"/"complete" in its
  // own name — the assertion below searches the whole page for exactly
  // those words, and the item's own name would otherwise create a false
  // match that has nothing to do with the section's actual wording.
  const ITEM = {
    name: "Test E2E Acqsrc Item No Claim",
    slug: "test-e2e-acqsrc-item-no-claim",
  };
  await createTemporaryItem(page, ITEM);
  await addSourceThroughForm(page, ITEM.slug, { type: "Reward" });

  await page.goto(`/items/${ITEM.slug}`);
  await expect(
    page.getByRole("heading", { level: 2, name: "How to obtain", exact: true })
  ).toBeVisible();
  await expect(
    page.getByText(/all (known )?sources|complete list|exhaustive/i)
  ).toHaveCount(0);
});

test("a CRAFTING acquisition source coexists with the structured Produced by recipe section", async ({
  page,
}) => {
  const ITEM = {
    name: "Test E2E Acqsrc Item Craftable",
    slug: "test-e2e-acqsrc-item-craftable",
  };
  const RECIPE = {
    name: "Test E2E Acqsrc Recipe Craftable",
    slug: "test-e2e-acqsrc-recipe-craftable",
  };
  await createTemporaryItem(page, ITEM);

  // A real recipe that produces the item — the structured relation this
  // section must never replace. The creation form lives on
  // /admin/recipes/new (Slice 9C.1).
  await page.goto("/admin/recipes/new");
  await page.getByLabel("Name", { exact: true }).fill(RECIPE.name);
  await page.getByLabel(/^Page address/).fill(RECIPE.slug);
  await selectAdminOption(
    page.getByRole("combobox", { name: "Resulting item", exact: true }),
    ITEM.name
  );
  const ingredientGroup = page.getByRole("group", {
    name: "Ingredients (fill at least one row)",
  });
  await selectAdminOption(
    ingredientGroup.getByRole("combobox").first(),
    "Iron Ore"
  );
  await ingredientGroup.getByRole("spinbutton").first().fill("1");
  await page
    .getByRole("button", { name: "Create Recipe", exact: true })
    .click();
  await expect(page).toHaveURL("/admin/recipes?success=created");

  // A supplementary, loosely-known CRAFTING acquisition source.
  await addSourceThroughForm(page, ITEM.slug, {
    type: "Crafting",
    notes: "Also craftable at any workbench.",
  });

  await page.goto(`/items/${ITEM.slug}`);

  // Both sections are present and distinct.
  await expect(
    page.getByRole("heading", { level: 2, name: "Produced by", exact: true })
  ).toBeVisible();
  await expect(cardLink(page, RECIPE.name)).toBeVisible();

  await expect(
    page.getByRole("heading", { level: 2, name: "How to obtain", exact: true })
  ).toBeVisible();
  // Checked precisely by role: the group label and the card's own
  // fallback title both read "Crafting" here (no other identifying fact
  // was set), so a plain text search would be ambiguous between them.
  await expect(cardTitle(page, "Crafting")).toBeVisible();
  await expect(
    page.getByText("Notes: Also craftable at any workbench.")
  ).toBeVisible();
});

// --- Slice 10B: Item -> Location bidirectional navigation audit ---------

test("a source with a location AND a source label still exposes a working location link", async ({
  page,
}) => {
  const ITEM = {
    name: "Test E2E Acqsrc Item Location Plus Label",
    slug: "test-e2e-acqsrc-item-location-plus-label",
  };
  const LOCATION = {
    name: "Test E2E Acqsrc Location Plus Label",
    slug: "test-e2e-acqsrc-location-plus-label",
    type: "Route",
  };
  await createTemporaryItem(page, ITEM);

  await page.goto("/admin/locations/new");
  await page.getByLabel("Name", { exact: true }).fill(LOCATION.name);
  await page.getByLabel(/^Page address/).fill(LOCATION.slug);
  await selectAdminOption(
    page.getByRole("combobox", { name: "Type", exact: true }),
    LOCATION.type
  );
  await page
    .getByRole("button", { name: "Create Location", exact: true })
    .click();
  await expect(page).toHaveURL("/admin/locations?success=created");

  await addSourceThroughForm(page, ITEM.slug, {
    type: "Fishing",
    locationName: LOCATION.name,
    sourceLabel: "Old Pier",
  });

  await page.goto(`/items/${ITEM.slug}`);
  // The location, not the source label, is still the strongest identifying
  // fact and the card's own link target — the source label becomes an
  // additional description fact instead of replacing the link.
  const locationCard = cardLink(page, LOCATION.name);
  await expect(locationCard).toBeVisible();
  await expect(locationCard).toHaveAttribute(
    "href",
    `/locations/${LOCATION.slug}`
  );
  await expect(page.getByText("Source: Old Pier")).toBeVisible();
});

test("a source with a location, profession, quantity, and notes all set still exposes a working location link", async ({
  page,
}) => {
  const ITEM = {
    name: "Test E2E Acqsrc Item Location Plus All",
    slug: "test-e2e-acqsrc-item-location-plus-all",
  };
  const LOCATION = {
    name: "Test E2E Acqsrc Location Plus All",
    slug: "test-e2e-acqsrc-location-plus-all",
    type: "Town",
  };
  const PROFESSION = {
    name: "Test E2E Acqsrc Profession Location Plus All",
    slug: "test-e2e-acqsrc-profession-location-plus-all",
  };
  await createTemporaryItem(page, ITEM);

  await page.goto("/admin/locations/new");
  await page.getByLabel("Name", { exact: true }).fill(LOCATION.name);
  await page.getByLabel(/^Page address/).fill(LOCATION.slug);
  await selectAdminOption(
    page.getByRole("combobox", { name: "Type", exact: true }),
    LOCATION.type
  );
  await page
    .getByRole("button", { name: "Create Location", exact: true })
    .click();
  await expect(page).toHaveURL("/admin/locations?success=created");

  await page.goto("/admin/professions/new");
  await page.getByLabel("Name", { exact: true }).fill(PROFESSION.name);
  await page.getByLabel(/^Page address/).fill(PROFESSION.slug);
  await page
    .getByRole("button", { name: "Create Profession", exact: true })
    .click();
  await expect(page).toHaveURL("/admin/professions?success=created");

  await addSourceThroughForm(page, ITEM.slug, {
    type: "Cooking",
    locationName: LOCATION.name,
    professionName: PROFESSION.name,
    quantity: "1-2",
    notes: "Best at dawn.",
  });

  await page.goto(`/items/${ITEM.slug}`);
  const locationCard = cardLink(page, LOCATION.name);
  await expect(locationCard).toBeVisible();
  await expect(locationCard).toHaveAttribute(
    "href",
    `/locations/${LOCATION.slug}`
  );
  await expect(page.getByText(`Profession: ${PROFESSION.name}`)).toBeVisible();
  await expect(page.getByText("Quantity: 1-2")).toBeVisible();
  await expect(page.getByText("Notes: Best at dawn.")).toBeVisible();

  // Keyboard reachability: the location link is a real, focusable anchor
  // that navigates on Enter, not merely mouse-clickable.
  await locationCard.focus();
  await expect(locationCard).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(`/locations/${LOCATION.slug}`);
});

test("multiple distinct sources at the same location remain understandable and both link correctly", async ({
  page,
}) => {
  const ITEM = {
    name: "Test E2E Acqsrc Item Same Location Multi",
    slug: "test-e2e-acqsrc-item-same-location-multi",
  };
  const LOCATION = {
    name: "Test E2E Acqsrc Location Same Multi",
    slug: "test-e2e-acqsrc-location-same-multi",
    type: "Dungeon",
  };
  await createTemporaryItem(page, ITEM);

  await page.goto("/admin/locations/new");
  await page.getByLabel("Name", { exact: true }).fill(LOCATION.name);
  await page.getByLabel(/^Page address/).fill(LOCATION.slug);
  await selectAdminOption(
    page.getByRole("combobox", { name: "Type", exact: true }),
    LOCATION.type
  );
  await page
    .getByRole("button", { name: "Create Location", exact: true })
    .click();
  await expect(page).toHaveURL("/admin/locations?success=created");

  // Two distinct sources at the SAME location — same type, different
  // notes. The Item page never dedupes by location (only the Location
  // page's own Obtainable Items section dedupes by item), so both remain
  // their own cards; they must stay distinguishable via their own facts.
  await addSourceThroughForm(page, ITEM.slug, {
    type: "Mining",
    locationName: LOCATION.name,
    notes: "Common near the entrance.",
  });
  await addSourceThroughForm(page, ITEM.slug, {
    type: "Mining",
    locationName: LOCATION.name,
    notes: "Rare in the deepest chamber.",
  });

  await page.goto(`/items/${ITEM.slug}`);
  const locationCards = page.getByRole("link").filter({
    has: cardTitle(page, LOCATION.name),
  });
  await expect(locationCards).toHaveCount(2);
  for (const card of await locationCards.all()) {
    await expect(card).toHaveAttribute("href", `/locations/${LOCATION.slug}`);
  }
  await expect(page.getByText("Common near the entrance.", { exact: false })).toBeVisible();
  await expect(
    page.getByText("Rare in the deepest chamber.", { exact: false })
  ).toBeVisible();
});

test("no game version or verification information appears in the how to obtain section", async ({
  page,
}) => {
  const ITEM = {
    name: "Test E2E Acqsrc Item No Verification Text",
    slug: "test-e2e-acqsrc-item-no-verification-text",
  };
  await createTemporaryItem(page, ITEM);
  await addSourceThroughForm(page, ITEM.slug, { type: "Foraging" });

  await page.goto(`/items/${ITEM.slug}`);
  await expect(
    page.getByRole("heading", { level: 2, name: "How to obtain", exact: true })
  ).toBeVisible();
  await expect(page.getByText(/verified/i)).toHaveCount(0);
  await expect(page.getByText(/game version/i)).toHaveCount(0);
});
