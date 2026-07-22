// Authenticated coverage for the Location Acquisition Sources tab (Slice
// 9F.4): a real, read-only tab inside the Location workspace showing
// every Acquisition Source that names the selected Location, each
// linking to the EXISTING Item-owned source edit route. No inline source
// editing, unlink control, or create-source form exists on this tab, so
// there is nothing here that duplicates admin-item-sources.spec.ts's own
// CRUD coverage. Mirrors admin-category-items.spec.ts's (Slice 9E.3)
// structure exactly, adapted to the Location -> AcquisitionSource
// relationship (and grouped by AcquisitionType rather than a flat list).
//
// Runs in the chromium-admin project with the storage state saved by
// auth.setup.ts. Every temporary Location/Item/AcquisitionSource reuses
// the existing test-e2e-acqsrc-location-/test-e2e-acqsrc-item- slug
// prefixes already relied on by admin-item-sources.spec.ts and
// admin-item-how-to-obtain.spec.ts, so cleanup
// (deleteE2eTestAcquisitionRecords) is already guard-first and
// exhaustive — no new cleanup surface is introduced.

import { expect, test, type Page } from "@playwright/test";
import {
  countE2eTestAcquisitionRecords,
  deleteE2eTestAcquisitionRecords,
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

// One row of the shared Location record list, located by its exact
// primary text inside the list's navigation landmark.
function recordRow(page: Page, name: string) {
  return page
    .getByRole("navigation", { name: "Locations records" })
    .getByRole("link")
    .filter({ has: page.getByText(name, { exact: true }) });
}

function tabNav(page: Page) {
  return page.getByRole("navigation", { name: "Location editor sections" });
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

test("opening the Acquisition Sources tab directly shows the linked sources, grouped by type then item name, inside the Location workspace", async ({
  page,
}) => {
  const LOCATION = {
    name: "Test E2E Acqsrc Location Sources Tab",
    slug: "test-e2e-acqsrc-location-sources-tab",
    type: "Region",
  };
  const ZEBRA_ITEM = {
    name: "Test E2E Acqsrc Item Sources Tab Zebra Fish",
    slug: "test-e2e-acqsrc-item-sources-tab-zebra",
  };
  const ALPHA_ITEM = {
    name: "Test E2E Acqsrc Item Sources Tab Alpha Fish",
    slug: "test-e2e-acqsrc-item-sources-tab-alpha",
  };
  const ORE_ITEM = {
    name: "Test E2E Acqsrc Item Sources Tab Middle Ore",
    slug: "test-e2e-acqsrc-item-sources-tab-ore",
  };
  await createTemporaryLocation(page, LOCATION);
  await createTemporaryItem(page, ZEBRA_ITEM);
  await createTemporaryItem(page, ALPHA_ITEM);
  await createTemporaryItem(page, ORE_ITEM);

  // Created out of alphabetical order, so the page's own ordering — not
  // insertion order — is what determines row order within a type group.
  // FISHING is declared before MINING in the AcquisitionType enum, so the
  // two Fishing rows must render before the Mining row regardless.
  await addSourceThroughForm(page, ZEBRA_ITEM.slug, {
    type: "Fishing",
    locationName: LOCATION.name,
  });
  await addSourceThroughForm(page, ALPHA_ITEM.slug, {
    type: "Fishing",
    locationName: LOCATION.name,
    sourceLabel: "Riverbank",
    quantity: "1-2",
    notes: "Best at dawn.",
  });
  await addSourceThroughForm(page, ORE_ITEM.slug, {
    type: "Mining",
    locationName: LOCATION.name,
  });

  await page.goto(`/admin/locations/${LOCATION.slug}/sources`);

  // One h1: the location's own name; the record list stays visible with
  // this location selected; the Acquisition Sources tab is marked active.
  await expect(
    page.getByRole("heading", { level: 1, name: LOCATION.name, exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Locations records" })
  ).toBeVisible();
  await expect(recordRow(page, LOCATION.name)).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(
    tabNav(page).getByRole("link", {
      name: "Acquisition Sources",
      exact: true,
    })
  ).toHaveAttribute("aria-current", "page");

  // Relationship-count badge (Phase B sub-slice): the active Acquisition
  // Sources tab shows its own count (3 linked sources), while General
  // carries no badge at all. The badge is aria-hidden, so the exact-name
  // role query above keeps matching the tab by its plain label alone.
  await expect(
    tabNav(page).getByRole("link", {
      name: "Acquisition Sources",
      exact: true,
    })
  ).toContainText("3");
  await expect(
    tabNav(page).getByRole("link", { name: "General", exact: true })
  ).not.toContainText(/[0-9]/);

  const table = page.getByRole("table");
  await expect(table).toBeVisible();
  const rows = table.getByRole("row");
  // Header row plus exactly three data rows.
  await expect(rows).toHaveCount(4);

  const firstDataRow = rows.nth(1);
  const secondDataRow = rows.nth(2);
  const thirdDataRow = rows.nth(3);

  // Alpha Fish (Fishing, sparse-free) sorts before Zebra Fish (Fishing)
  // within the same type group, and both Fishing rows sort before the
  // Mining row.
  await expect(
    firstDataRow.getByRole("link", { name: ALPHA_ITEM.name, exact: true })
  ).toBeVisible();
  await expect(
    secondDataRow.getByRole("link", { name: ZEBRA_ITEM.name, exact: true })
  ).toBeVisible();
  await expect(
    thirdDataRow.getByRole("link", { name: ORE_ITEM.name, exact: true })
  ).toBeVisible();

  // Type labels render as a column.
  await expect(
    firstDataRow.getByRole("cell", { name: "Fishing", exact: true })
  ).toBeVisible();
  await expect(
    thirdDataRow.getByRole("cell", { name: "Mining", exact: true })
  ).toBeVisible();

  // Optional facts render only when present: the Alpha row has all four,
  // the Zebra and Ore rows have none.
  await expect(
    firstDataRow.getByText("Source: Riverbank", { exact: true })
  ).toBeVisible();
  await expect(
    firstDataRow.getByText("Quantity: 1-2", { exact: true })
  ).toBeVisible();
  await expect(
    firstDataRow.getByText("Notes: Best at dawn.", { exact: true })
  ).toBeVisible();
  await expect(secondDataRow.getByText(/^Source:/)).toHaveCount(0);
  await expect(secondDataRow.getByText(/^Quantity:/)).toHaveCount(0);
  await expect(secondDataRow.getByText(/^Notes:/)).toHaveCount(0);
  await expect(secondDataRow.getByText(/^Profession:/)).toHaveCount(0);
  // No placeholder dash and exactly two cells per row (Item, Type) — no
  // rigid optional column exists.
  await expect(page.getByText("—", { exact: true })).toHaveCount(0);
  await expect(secondDataRow.getByRole("cell")).toHaveCount(2);

  // The source link goes to the EXISTING Item-owned source edit route —
  // no inline editing lives on this tab, and no Location `q` is carried
  // onto the Item workspace URL.
  const sourceLink = firstDataRow.getByRole("link", {
    name: ALPHA_ITEM.name,
    exact: true,
  });
  await expect(sourceLink).toHaveAttribute(
    "href",
    new RegExp(`^/admin/items/${ALPHA_ITEM.slug}/sources/[^/]+/edit$`)
  );
  await sourceLink.click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/items/${ALPHA_ITEM.slug}/sources/[^/]+/edit$`)
  );
  expect(page.url()).not.toContain("q=");
  await expect(
    page.getByRole("heading", { level: 1, name: "Edit Acquisition Source" })
  ).toBeVisible();
});

test("switching locations while on the Acquisition Sources tab preserves the tab and q", async ({
  page,
}) => {
  const LOCATION_A = {
    name: "Test E2E Acqsrc Location Sources Switch A",
    slug: "test-e2e-acqsrc-location-sources-switch-a",
    type: "Region",
  };
  const LOCATION_B = {
    name: "Test E2E Acqsrc Location Sources Switch B",
    slug: "test-e2e-acqsrc-location-sources-switch-b",
    type: "Region",
  };
  const ITEM = {
    name: "Test E2E Acqsrc Item Sources Switch",
    slug: "test-e2e-acqsrc-item-sources-switch",
  };
  await createTemporaryLocation(page, LOCATION_A);
  await createTemporaryLocation(page, LOCATION_B);
  await createTemporaryItem(page, ITEM);
  await addSourceThroughForm(page, ITEM.slug, {
    type: "Foraging",
    locationName: LOCATION_A.name,
  });

  // A shared, distinguishing query so only these two temporary locations
  // match.
  await page.goto("/admin/locations");
  await page
    .getByRole("searchbox", { name: "Search locations" })
    .fill("test e2e acqsrc location sources switch");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(recordRow(page, LOCATION_A.name)).toBeVisible();
  await expect(recordRow(page, LOCATION_B.name)).toBeVisible();

  await recordRow(page, LOCATION_A.name).click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/locations/${LOCATION_A.slug}/edit\\?q=`)
  );

  await tabNav(page)
    .getByRole("link", { name: "Acquisition Sources", exact: true })
    .click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/locations/${LOCATION_A.slug}/sources\\?q=`)
  );
  await expect(recordRow(page, LOCATION_A.name)).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(
    page.getByRole("cell", { name: ITEM.name, exact: true })
  ).toBeVisible();

  // Switching records while ON the Acquisition Sources tab opens the
  // OTHER location's Acquisition Sources tab — not its General tab —
  // with q intact.
  await recordRow(page, LOCATION_B.name).click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/locations/${LOCATION_B.slug}/sources\\?q=`)
  );
  await expect(
    page.getByRole("heading", { level: 1, name: LOCATION_B.name, exact: true })
  ).toBeVisible();
  await expect(
    tabNav(page).getByRole("link", {
      name: "Acquisition Sources",
      exact: true,
    })
  ).toHaveAttribute("aria-current", "page");
  await expect(recordRow(page, LOCATION_B.name)).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(recordRow(page, LOCATION_A.name)).not.toHaveAttribute(
    "aria-current",
    "page"
  );
  // Location B has no linked source: a valid empty tab state, not an
  // error.
  await expect(
    page.getByText("No acquisition sources reference this location yet")
  ).toBeVisible();
});

test("a location with no acquisition sources shows a valid empty state", async ({
  page,
}) => {
  const LOCATION = {
    name: "Test E2E Acqsrc Location Sources Empty",
    slug: "test-e2e-acqsrc-location-sources-empty",
    type: "Town",
  };
  await createTemporaryLocation(page, LOCATION);

  await page.goto(`/admin/locations/${LOCATION.slug}/sources`);
  await expect(
    page.getByRole("heading", { level: 1, name: LOCATION.name, exact: true })
  ).toBeVisible();
  await expect(
    page.getByText("No acquisition sources reference this location yet")
  ).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);

  // Relationship-count badge: zero linked sources still renders the
  // visible digit 0 on the Acquisition Sources tab, never omitted.
  await expect(
    tabNav(page).getByRole("link", {
      name: "Acquisition Sources",
      exact: true,
    })
  ).toContainText("0");
});

test("General and Hierarchy remain real links from the Acquisition Sources tab, and no Location tab is disabled", async ({
  page,
}) => {
  const LOCATION = {
    name: "Test E2E Acqsrc Location Sources Nav",
    slug: "test-e2e-acqsrc-location-sources-nav",
    type: "Building or interior",
  };
  await createTemporaryLocation(page, LOCATION);

  await page.goto(`/admin/locations/${LOCATION.slug}/sources`);
  await expect(
    tabNav(page).getByRole("link", {
      name: "Acquisition Sources",
      exact: true,
    })
  ).toHaveAttribute("aria-current", "page");
  await expect(tabNav(page).locator('[aria-current="page"]')).toHaveCount(1);

  // The Metadata tab was removed (Visual Pass sub-slice 4) — every
  // remaining Location tab (General, Hierarchy, Acquisition Sources) is
  // a real link; none is a disabled placeholder.
  await expect(tabNav(page).getByRole("link")).toHaveCount(3);
  await expect(tabNav(page).locator('[aria-disabled="true"]')).toHaveCount(0);

  await tabNav(page).getByRole("link", { name: "General", exact: true }).click();
  await expect(page).toHaveURL(`/admin/locations/${LOCATION.slug}/edit`);
  await expect(
    tabNav(page).getByRole("link", { name: "General", exact: true })
  ).toHaveAttribute("aria-current", "page");

  await tabNav(page)
    .getByRole("link", { name: "Hierarchy", exact: true })
    .click();
  await expect(page).toHaveURL(`/admin/locations/${LOCATION.slug}/hierarchy`);
  await expect(
    tabNav(page).getByRole("link", { name: "Hierarchy", exact: true })
  ).toHaveAttribute("aria-current", "page");

  await tabNav(page)
    .getByRole("link", { name: "Acquisition Sources", exact: true })
    .click();
  await expect(page).toHaveURL(`/admin/locations/${LOCATION.slug}/sources`);
  await expect(
    tabNav(page).getByRole("link", {
      name: "Acquisition Sources",
      exact: true,
    })
  ).toHaveAttribute("aria-current", "page");
});

test("the Acquisition Sources tab renders no form, mutation control, or image/verification/hierarchy control", async ({
  page,
}) => {
  const LOCATION = {
    name: "Test E2E Acqsrc Location Sources ReadOnly",
    slug: "test-e2e-acqsrc-location-sources-readonly",
    type: "Dungeon",
  };
  const ITEM = {
    name: "Test E2E Acqsrc Item Sources ReadOnly",
    slug: "test-e2e-acqsrc-item-sources-readonly",
  };
  await createTemporaryLocation(page, LOCATION);
  await createTemporaryItem(page, ITEM);
  await addSourceThroughForm(page, ITEM.slug, {
    type: "Crafting",
    locationName: LOCATION.name,
  });

  await page.goto(`/admin/locations/${LOCATION.slug}/sources`);

  // Strictly read-only, scoped to the workspace's main content region:
  // the record list's own search form (a plain GET, not a mutation) is
  // outside this region and is expected to stay on-screen, matching the
  // Category Items tab's precedent for this exact assertion shape.
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
  await expect(main.getByText("Parent Location", { exact: true })).toHaveCount(
    0
  );
  await expect(main.getByText("Delete Location")).toHaveCount(0);
});

test("an unknown location slug fails safely on the sources route", async ({
  page,
}) => {
  const response = await page.goto(
    "/admin/locations/test-e2e-acqsrc-location-does-not-exist/sources"
  );
  expect(response?.status()).toBe(404);
});

test("seeded fixtures are preserved and no test acquisition record remains", async () => {
  expect(await readFixtureCounts()).toEqual({
    categories: 5,
    professions: 10,
    items: 16,
    recipes: 8,
    recipeIngredients: 15,
  });
  expect(await countE2eTestAcquisitionRecords()).toBe(0);
});
