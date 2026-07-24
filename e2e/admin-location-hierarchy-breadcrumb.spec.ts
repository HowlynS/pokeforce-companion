// Coverage for the public Location breadcrumb (Slice 10C — improved
// hierarchy presentation). Runs in the chromium-admin project because
// building a multi-level hierarchy requires the real admin create/edit
// forms — the assertions themselves are against the PUBLIC location
// pages, which need no authentication. Every fixture created here uses
// the test-e2e-location- prefix and is removed by the existing
// deleteE2eTestLocationRecords cleanup.

import { expect, test, type Page } from "@playwright/test";
import { selectAdminOption } from "./helpers/admin-select";
import {
  countE2eTestLocationRecords,
  deleteE2eTestLocationRecords,
} from "./helpers/database-cleanup";

// Browser error hygiene: any uncaught page error fails the test. Serial
// single-worker execution makes this module-level state safe.
let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(async () => {
  await deleteE2eTestLocationRecords();
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

test.beforeAll(async () => {
  await deleteE2eTestLocationRecords();
  expect(await countE2eTestLocationRecords()).toBe(0);
});

test.afterAll(async () => {
  const remaining = await deleteE2eTestLocationRecords();
  expect(remaining).toBe(0);
});

function breadcrumb(page: Page) {
  return page.getByRole("navigation", { name: "Breadcrumb" });
}

async function createLocationThroughForm(
  page: Page,
  data: { name: string; slug: string; type: string; parentName?: string }
) {
  await page.goto("/admin/locations/new");
  await page.getByLabel("Name", { exact: true }).fill(data.name);
  await page.getByLabel(/^Page address/).fill(data.slug);
  await selectAdminOption(
    page.getByRole("combobox", { name: "Type", exact: true }),
    data.type
  );
  if (data.parentName) {
    await selectAdminOption(
      page.getByRole("combobox", { name: "Parent location", exact: true }),
      data.parentName
    );
  }
  await page
    .getByRole("button", { name: "Create Location", exact: true })
    .click();
  await expect(page).toHaveURL(`/admin/locations/${data.slug}/edit`);
}

test("a root location shows Locations -> Current Location, with no ancestor links", async ({
  page,
}) => {
  const ROOT = {
    name: "Test E2E Location Breadcrumb Root",
    slug: "test-e2e-location-breadcrumb-root",
    type: "Region",
  };
  await createLocationThroughForm(page, ROOT);

  await page.goto(`/locations/${ROOT.slug}`);
  const crumb = breadcrumb(page);
  await expect(crumb).toBeVisible();
  await expect(crumb.getByRole("link", { name: "Locations", exact: true })).toHaveAttribute(
    "href",
    "/locations"
  );
  // Only the root "Locations" link and the current (non-linked) name — no
  // ancestor links at all for a root location.
  await expect(crumb.getByRole("link")).toHaveCount(1);
  await expect(crumb.getByText(ROOT.name, { exact: true })).toBeVisible();
  // The current location's own name is not itself a link.
  await expect(
    crumb.getByRole("link", { name: ROOT.name, exact: true })
  ).toHaveCount(0);
});

test("a child location shows its parent in the breadcrumb, linked to the parent's own page", async ({
  page,
}) => {
  const PARENT = {
    name: "Test E2E Location Breadcrumb Parent",
    slug: "test-e2e-location-breadcrumb-parent",
    type: "Region",
  };
  const CHILD = {
    name: "Test E2E Location Breadcrumb Child",
    slug: "test-e2e-location-breadcrumb-child",
    type: "Town",
  };
  await createLocationThroughForm(page, PARENT);
  await createLocationThroughForm(page, { ...CHILD, parentName: PARENT.name });

  await page.goto(`/locations/${CHILD.slug}`);
  const crumb = breadcrumb(page);
  const parentLink = crumb.getByRole("link", { name: PARENT.name, exact: true });
  await expect(parentLink).toBeVisible();
  await expect(parentLink).toHaveAttribute("href", `/locations/${PARENT.slug}`);

  // Keyboard reachability: a real, focusable anchor that navigates on Enter.
  await parentLink.focus();
  await expect(parentLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(`/locations/${PARENT.slug}`);
});

test("a three-level hierarchy shows the full ancestor chain, root-first, with the current location not linked", async ({
  page,
}) => {
  const REGION = {
    name: "Test E2E Location Breadcrumb Region",
    slug: "test-e2e-location-breadcrumb-region",
    type: "Region",
  };
  const TOWN = {
    name: "Test E2E Location Breadcrumb Town",
    slug: "test-e2e-location-breadcrumb-town",
    type: "Town",
  };
  const BUILDING = {
    name: "Test E2E Location Breadcrumb Building",
    slug: "test-e2e-location-breadcrumb-building",
    type: "Building or interior",
  };
  await createLocationThroughForm(page, REGION);
  await createLocationThroughForm(page, { ...TOWN, parentName: REGION.name });
  await createLocationThroughForm(page, {
    ...BUILDING,
    parentName: TOWN.name,
  });

  await page.goto(`/locations/${BUILDING.slug}`);
  const crumb = breadcrumb(page);

  const locationsLink = crumb.getByRole("link", { name: "Locations", exact: true });
  const regionLink = crumb.getByRole("link", { name: REGION.name, exact: true });
  const townLink = crumb.getByRole("link", { name: TOWN.name, exact: true });

  await expect(locationsLink).toHaveAttribute("href", "/locations");
  await expect(regionLink).toHaveAttribute("href", `/locations/${REGION.slug}`);
  await expect(townLink).toHaveAttribute("href", `/locations/${TOWN.slug}`);

  // Root-first reading order: Locations, then Region, then Town, then the
  // current (unlinked) Building name.
  const linksInOrder = await crumb.getByRole("link").allTextContents();
  expect(linksInOrder).toEqual(["Locations", REGION.name, TOWN.name]);

  // The current location itself is never one of the breadcrumb's links.
  await expect(
    crumb.getByRole("link", { name: BUILDING.name, exact: true })
  ).toHaveCount(0);
  await expect(crumb.getByText(BUILDING.name, { exact: true })).toBeVisible();
});

test("direct children render in deterministic name order, and no Sub-locations section appears without any", async ({
  page,
}) => {
  const PARENT = {
    name: "Test E2E Location Breadcrumb Children Parent",
    slug: "test-e2e-location-breadcrumb-children-parent",
    type: "Region",
  };
  const CHILD_ZEBRA = {
    name: "Test E2E Location Breadcrumb Zebra Town",
    slug: "test-e2e-location-breadcrumb-zebra",
    type: "Town",
  };
  const CHILD_ALPHA = {
    name: "Test E2E Location Breadcrumb Alpha Town",
    slug: "test-e2e-location-breadcrumb-alpha",
    type: "Town",
  };
  await createLocationThroughForm(page, PARENT);

  // No children yet: the section is entirely absent.
  await page.goto(`/locations/${PARENT.slug}`);
  await expect(
    page.getByRole("heading", { level: 2, name: "Sub-locations", exact: true })
  ).toHaveCount(0);

  // Created out of alphabetical order, so a correct rendered order can
  // only come from the page's own explicit ordering, never creation order.
  await createLocationThroughForm(page, {
    ...CHILD_ZEBRA,
    parentName: PARENT.name,
  });
  await createLocationThroughForm(page, {
    ...CHILD_ALPHA,
    parentName: PARENT.name,
  });

  await page.goto(`/locations/${PARENT.slug}`);
  await expect(
    page.getByRole("heading", { level: 2, name: "Sub-locations", exact: true })
  ).toBeVisible();

  const childHeadings = page.getByRole("heading", { level: 3 });
  const names = await childHeadings.allTextContents();
  const alphaIndex = names.indexOf(CHILD_ALPHA.name);
  const zebraIndex = names.indexOf(CHILD_ZEBRA.name);
  expect(alphaIndex).toBeGreaterThanOrEqual(0);
  expect(zebraIndex).toBeGreaterThanOrEqual(0);
  expect(alphaIndex).toBeLessThan(zebraIndex);

  const childLink = page
    .getByRole("link")
    .filter({ has: page.getByRole("heading", { level: 3, name: CHILD_ALPHA.name, exact: true }) });
  await expect(childLink).toHaveAttribute("href", `/locations/${CHILD_ALPHA.slug}`);
  await childLink.click();
  await expect(page).toHaveURL(`/locations/${CHILD_ALPHA.slug}`);
});

test("no Game Version or verification information appears in or around the breadcrumb", async ({
  page,
}) => {
  const PARENT = {
    name: "Test E2E Location Breadcrumb No Verification Parent",
    slug: "test-e2e-location-breadcrumb-no-verification-parent",
    type: "Region",
  };
  const CHILD = {
    name: "Test E2E Location Breadcrumb No Verification Child",
    slug: "test-e2e-location-breadcrumb-no-verification-child",
    type: "Town",
  };
  await createLocationThroughForm(page, PARENT);
  await createLocationThroughForm(page, { ...CHILD, parentName: PARENT.name });

  await page.goto(`/locations/${CHILD.slug}`);
  await expect(breadcrumb(page)).toBeVisible();
  await expect(page.getByText(/verified/i)).toHaveCount(0);
  await expect(page.getByText(/game version/i)).toHaveCount(0);
});

test("the Locations root link opens the public locations list, which links back to a location's own page", async ({
  page,
}) => {
  const LOCATION = {
    name: "Test E2E Location Breadcrumb List Entry",
    slug: "test-e2e-location-breadcrumb-list-entry",
    type: "Dungeon",
  };
  await createLocationThroughForm(page, LOCATION);

  await page.goto(`/locations/${LOCATION.slug}`);
  await breadcrumb(page).getByRole("link", { name: "Locations", exact: true }).click();
  await expect(page).toHaveURL("/locations");
  await expect(
    page.getByRole("heading", { level: 1, name: "Locations", exact: true })
  ).toBeVisible();

  const listLink = page
    .getByRole("link")
    .filter({ has: page.getByRole("heading", { level: 3, name: LOCATION.name, exact: true }) });
  await expect(listLink).toHaveAttribute("href", `/locations/${LOCATION.slug}`);
});
