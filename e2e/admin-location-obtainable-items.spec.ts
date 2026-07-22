// Coverage for the public "Obtainable Items" section on /locations/[slug]
// (Slice 10A — Route Hub obtainable-item foundation). Runs in the
// chromium-admin project (authenticated) because building each fixture
// requires the real admin create forms for Item, Location, Profession, and
// AcquisitionSource — the assertions themselves are against the PUBLIC
// location page, which needs no authentication. Every fixture created here
// uses the test-e2e-acqsrc- prefixes shared with admin-item-sources.spec.ts
// and admin-item-how-to-obtain.spec.ts, and is removed by the same
// guard-first, prefix-scoped cleanup.

import { expect, test, type Page } from "@playwright/test";
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

// The public card renders its title as an h3 inside the card link.
function cardTitle(page: Page, name: string) {
  return page.getByRole("heading", { level: 3, name, exact: true });
}

function cardLink(page: Page, name: string) {
  return page.getByRole("link").filter({ has: cardTitle(page, name) });
}

async function createTemporaryItem(
  page: Page,
  data: { name: string; slug: string }
) {
  await page.goto("/admin/items/new");
  await page.getByLabel("Name", { exact: true }).fill(data.name);
  await page.getByLabel(/^Page address/).fill(data.slug);
  await page.getByRole("button", { name: "Create item", exact: true }).click();
  await expect(page).toHaveURL("/admin/items?success=created");
}

async function createTemporaryLocation(
  page: Page,
  data: { name: string; slug: string; type: string }
) {
  await page.goto("/admin/locations/new");
  await page.getByLabel("Name", { exact: true }).fill(data.name);
  await page.getByLabel(/^Page address/).fill(data.slug);
  await page
    .getByRole("combobox", { name: "Type", exact: true })
    .selectOption({ label: data.type });
  await page
    .getByRole("button", { name: "Create Location", exact: true })
    .click();
  await expect(page).toHaveURL("/admin/locations?success=created");
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
  await page
    .getByRole("combobox", { name: "Type", exact: true })
    .selectOption({ label: data.type });
  if (data.locationName) {
    await page
      .getByRole("combobox", { name: "Location (optional)", exact: true })
      .selectOption({ label: data.locationName });
  }
  if (data.professionName) {
    await page
      .getByRole("combobox", { name: "Profession (optional)", exact: true })
      .selectOption({ label: data.professionName });
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

test("no Obtainable Items heading appears when a location has zero acquisition sources", async ({
  page,
}) => {
  const LOCATION = {
    name: "Test E2E Acqsrc Location Zero Sources",
    slug: "test-e2e-acqsrc-location-zero",
    type: "Route",
  };
  await createTemporaryLocation(page, LOCATION);

  await page.goto(`/locations/${LOCATION.slug}`);
  await expect(
    page.getByRole("heading", { level: 1, name: LOCATION.name, exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Obtainable Items", exact: true })
  ).toHaveCount(0);
});

test("a location with a linked acquisition source displays Obtainable Items and links to the item page", async ({
  page,
}) => {
  const LOCATION = {
    name: "Test E2E Acqsrc Location Obtainable",
    slug: "test-e2e-acqsrc-location-obtainable",
    type: "Town",
  };
  const ITEM = {
    name: "Test E2E Acqsrc Item Obtainable",
    slug: "test-e2e-acqsrc-item-obtainable",
  };
  await createTemporaryLocation(page, LOCATION);
  await createTemporaryItem(page, ITEM);
  await addSourceThroughForm(page, ITEM.slug, {
    type: "Fishing",
    locationName: LOCATION.name,
  });

  await page.goto(`/locations/${LOCATION.slug}`);
  await expect(
    page.getByRole("heading", { level: 2, name: "Obtainable Items", exact: true })
  ).toBeVisible();

  const itemCard = cardLink(page, ITEM.name);
  await expect(itemCard).toBeVisible();
  await expect(itemCard).toHaveAttribute("href", `/items/${ITEM.slug}`);

  await itemCard.click();
  await expect(page).toHaveURL(`/items/${ITEM.slug}`);
  await expect(
    page.getByRole("heading", { level: 1, name: ITEM.name, exact: true })
  ).toBeVisible();
});

test("multiple acquisition types appear in canonical enum order, each with its own items", async ({
  page,
}) => {
  const LOCATION = {
    name: "Test E2E Acqsrc Location Multi Type",
    slug: "test-e2e-acqsrc-location-multi-type",
    type: "Region",
  };
  const FORAGED_ITEM = {
    name: "Test E2E Acqsrc Item Multi Foraged",
    slug: "test-e2e-acqsrc-item-multi-foraged",
  };
  const MINED_ITEM = {
    name: "Test E2E Acqsrc Item Multi Mined",
    slug: "test-e2e-acqsrc-item-multi-mined",
  };
  await createTemporaryLocation(page, LOCATION);
  await createTemporaryItem(page, MINED_ITEM);
  await createTemporaryItem(page, FORAGED_ITEM);

  // Added out of enum order (MINING before FORAGING) so a correct group
  // order can only come from the canonical order, never creation order.
  await addSourceThroughForm(page, MINED_ITEM.slug, {
    type: "Mining",
    locationName: LOCATION.name,
  });
  await addSourceThroughForm(page, FORAGED_ITEM.slug, {
    type: "Foraging",
    locationName: LOCATION.name,
  });

  await page.goto(`/locations/${LOCATION.slug}`);
  await expect(
    page.getByRole("heading", { level: 2, name: "Obtainable Items", exact: true })
  ).toBeVisible();

  const foragingLabel = page.getByText("Foraging", { exact: true });
  const miningLabel = page.getByText("Mining", { exact: true });
  await expect(foragingLabel).toBeVisible();
  await expect(miningLabel).toBeVisible();

  const foragingBox = await foragingLabel.boundingBox();
  const miningBox = await miningLabel.boundingBox();
  expect(foragingBox).not.toBeNull();
  expect(miningBox).not.toBeNull();
  // Foraging is declared before Mining in the canonical enum order, so its
  // group label must render above Mining's.
  expect(foragingBox!.y).toBeLessThan(miningBox!.y);

  await expect(cardTitle(page, FORAGED_ITEM.name)).toBeVisible();
  await expect(cardTitle(page, MINED_ITEM.name)).toBeVisible();
});

test("optional source label, profession, quantity, and notes render only when populated", async ({
  page,
}) => {
  const LOCATION = {
    name: "Test E2E Acqsrc Location Optional Fields",
    slug: "test-e2e-acqsrc-location-optional",
    type: "Building or interior",
  };
  const PROFESSION = {
    name: "Test E2E Acqsrc Profession Location Optional",
    slug: "test-e2e-acqsrc-profession-location-optional",
  };
  const POPULATED_ITEM = {
    name: "Test E2E Acqsrc Item Location Populated",
    slug: "test-e2e-acqsrc-item-location-populated",
  };
  const SPARSE_ITEM = {
    name: "Test E2E Acqsrc Item Location Sparse",
    slug: "test-e2e-acqsrc-item-location-sparse",
  };
  await createTemporaryLocation(page, LOCATION);
  await createTemporaryItem(page, POPULATED_ITEM);
  await createTemporaryItem(page, SPARSE_ITEM);

  await page.goto("/admin/professions/new");
  await page.getByLabel("Name", { exact: true }).fill(PROFESSION.name);
  await page.getByLabel(/^Page address/).fill(PROFESSION.slug);
  await page
    .getByRole("button", { name: "Create Profession", exact: true })
    .click();
  await expect(page).toHaveURL("/admin/professions?success=created");

  // One item with every optional field populated...
  await addSourceThroughForm(page, POPULATED_ITEM.slug, {
    type: "Cooking",
    locationName: LOCATION.name,
    professionName: PROFESSION.name,
    sourceLabel: "Camp Kitchen",
    quantity: "1-2",
    notes: "Requires a lit campfire.",
  });
  // ...and a sibling in a DIFFERENT type with none of them set.
  await addSourceThroughForm(page, SPARSE_ITEM.slug, {
    type: "Event",
    locationName: LOCATION.name,
  });

  await page.goto(`/locations/${LOCATION.slug}`);

  await expect(cardTitle(page, POPULATED_ITEM.name)).toBeVisible();
  await expect(page.getByText("Source: Camp Kitchen")).toBeVisible();
  await expect(page.getByText(`Profession: ${PROFESSION.name}`)).toBeVisible();
  await expect(page.getByText("Quantity: 1-2")).toBeVisible();
  await expect(
    page.getByText("Notes: Requires a lit campfire.")
  ).toBeVisible();

  // The sparse item's own card renders with none of the optional facts.
  await expect(cardTitle(page, SPARSE_ITEM.name)).toBeVisible();
});

test("no Game Version or verification information appears on the location page", async ({
  page,
}) => {
  const LOCATION = {
    name: "Test E2E Acqsrc Location No Verification",
    slug: "test-e2e-acqsrc-location-no-verification",
    type: "Dungeon",
  };
  const ITEM = {
    name: "Test E2E Acqsrc Item No Verification",
    slug: "test-e2e-acqsrc-item-no-verification",
  };
  await createTemporaryLocation(page, LOCATION);
  await createTemporaryItem(page, ITEM);
  await addSourceThroughForm(page, ITEM.slug, {
    type: "Reward",
    locationName: LOCATION.name,
  });

  await page.goto(`/locations/${LOCATION.slug}`);
  await expect(
    page.getByRole("heading", { level: 2, name: "Obtainable Items", exact: true })
  ).toBeVisible();

  await expect(page.getByText(/verified/i)).toHaveCount(0);
  await expect(page.getByText(/game version/i)).toHaveCount(0);
});

test("existing description, hierarchy, and notFound behavior remain intact", async ({
  page,
}) => {
  const PARENT = {
    name: "Test E2E Acqsrc Location Parent Intact",
    slug: "test-e2e-acqsrc-location-parent-intact",
    type: "Region",
  };
  const CHILD = {
    name: "Test E2E Acqsrc Location Child Intact",
    slug: "test-e2e-acqsrc-location-child-intact",
    type: "Town",
  };
  await createTemporaryLocation(page, PARENT);

  // The child needs a parent selection, which only the edit form's own
  // General fields expose — reuse the existing creation + edit flow.
  await page.goto("/admin/locations/new");
  await page.getByLabel("Name", { exact: true }).fill(CHILD.name);
  await page.getByLabel(/^Page address/).fill(CHILD.slug);
  await page
    .getByRole("combobox", { name: "Type", exact: true })
    .selectOption({ label: CHILD.type });
  await page
    .getByRole("combobox", { name: "Parent location", exact: true })
    .selectOption({ label: PARENT.name });
  await page
    .getByRole("button", { name: "Create Location", exact: true })
    .click();
  await expect(page).toHaveURL("/admin/locations?success=created");

  // Parent's own detail page still shows its sub-location.
  await page.goto(`/locations/${PARENT.slug}`);
  await expect(
    page.getByRole("heading", { level: 2, name: "Sub-locations", exact: true })
  ).toBeVisible();
  await expect(cardLink(page, CHILD.name)).toBeVisible();

  // Child's own detail page still shows its parent (Slice 10C: via the
  // breadcrumb, not a separate "Parent location" card), with no
  // Obtainable Items section since it has no acquisition sources.
  await page.goto(`/locations/${CHILD.slug}`);
  await expect(
    page.getByRole("heading", { level: 1, name: CHILD.name, exact: true })
  ).toBeVisible();
  const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
  const parentLink = breadcrumb.getByRole("link", { name: PARENT.name, exact: true });
  await expect(parentLink).toBeVisible();
  await expect(parentLink).toHaveAttribute("href", `/locations/${PARENT.slug}`);
  await expect(
    page.getByRole("heading", { level: 2, name: "Obtainable Items", exact: true })
  ).toHaveCount(0);

  // notFound() behavior for an unknown location slug is unchanged.
  const response = await page.goto(
    "/locations/test-e2e-acqsrc-location-does-not-exist"
  );
  expect(response?.status()).toBe(404);
});

// --- Slice 10B: Location -> Item bidirectional navigation audit ---------

test("the item link is a real, focusable anchor that navigates on Enter, not merely mouse-clickable", async ({
  page,
}) => {
  const LOCATION = {
    name: "Test E2E Acqsrc Location Keyboard Nav",
    slug: "test-e2e-acqsrc-location-keyboard-nav",
    type: "Region",
  };
  const ITEM = {
    name: "Test E2E Acqsrc Item Keyboard Nav",
    slug: "test-e2e-acqsrc-item-keyboard-nav",
  };
  await createTemporaryLocation(page, LOCATION);
  await createTemporaryItem(page, ITEM);
  await addSourceThroughForm(page, ITEM.slug, {
    type: "Foraging",
    locationName: LOCATION.name,
  });

  await page.goto(`/locations/${LOCATION.slug}`);
  const itemCard = cardLink(page, ITEM.name);
  await expect(itemCard).toBeVisible();

  await itemCard.focus();
  await expect(itemCard).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(`/items/${ITEM.slug}`);
});
