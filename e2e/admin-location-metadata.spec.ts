// Coverage for the retired Location "Metadata" tab (Visual Pass sub-slice
// 4): type/parent were already visible on General/Hierarchy, the
// sub-location and Acquisition Source counts were already shown by the
// Hierarchy and Acquisition Sources tabs' own counts, and Verification/
// Timestamps duplicated General's own aside — so the tab and its route
// were removed rather than kept as a near-empty fourth destination. This
// suite proves the old route redirects safely to General instead of
// 404ing (preserving the active search query), and that the Metadata tab
// no longer appears anywhere in the tab strip.
//
// Runs in the chromium-admin project with the storage state saved by
// auth.setup.ts. Every temporary Location uses the test-e2e-location
// slug prefix.

import { expect, test, type Page } from "@playwright/test";
import { selectAdminOption } from "./helpers/admin-select";
import {
  countE2eTestLocationRecords,
  deleteE2eTestLocationRecords,
  readFixtureCounts,
} from "./helpers/database-cleanup";

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
  await selectAdminOption(
    page.getByRole("combobox", { name: "Type", exact: true }),
    data.type
  );
  await page
    .getByRole("button", { name: "Create Location", exact: true })
    .click();
  await expect(page).toHaveURL("/admin/locations?success=created");
}

test("visiting the old Metadata route redirects to General, preserving the search query", async ({
  page,
}) => {
  const LOCATION = {
    name: "Test E2E Location Metadata Redirect",
    slug: "test-e2e-location-metadata-redirect",
    type: "Town",
  };
  await createTemporaryLocation(page, LOCATION);

  await page.goto(`/admin/locations/${LOCATION.slug}/metadata?q=test`);
  await expect(page).toHaveURL(
    `/admin/locations/${LOCATION.slug}/edit?q=test`
  );
  await expect(
    page.getByRole("heading", { level: 1, name: LOCATION.name, exact: true })
  ).toBeVisible();
  await expect(
    tabNav(page).getByRole("link", { name: "General", exact: true })
  ).toHaveAttribute("aria-current", "page");
});

test("the tab strip no longer offers a Metadata destination anywhere", async ({
  page,
}) => {
  const LOCATION = {
    name: "Test E2E Location Metadata Gone",
    slug: "test-e2e-location-metadata-gone",
    type: "Town",
  };
  await createTemporaryLocation(page, LOCATION);

  await page.goto(`/admin/locations/${LOCATION.slug}/edit`);
  await expect(tabNav(page).getByRole("link")).toHaveCount(3);
  await expect(
    tabNav(page).getByRole("link", { name: "Metadata" })
  ).toHaveCount(0);
});

test("an unknown location slug on the old metadata route still fails safely", async ({
  page,
}) => {
  const response = await page.goto(
    "/admin/locations/test-e2e-location-metadata-does-not-exist/metadata"
  );
  expect(response?.status()).toBe(404);
});

test("seeded fixtures are preserved and no test location remains", async () => {
  expect(await readFixtureCounts()).toEqual({
    categories: 5,
    professions: 10,
    items: 16,
    recipes: 8,
    recipeIngredients: 15,
  });
  expect(await countE2eTestLocationRecords()).toBe(0);
});
