// Coverage for the Location group in public global search (Slice 10E —
// search discovery extension). Runs in the chromium-admin project
// (authenticated) because the fixture is created through the real admin
// Location create form; the assertions themselves are against the PUBLIC
// /search page, which needs no authentication. Uses the existing
// test-e2e-location prefix and its shared cleanup helpers from
// admin-locations.spec.ts's own suite — no new prefix or cleanup surface.

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

// The public card renders its title as an h3 inside the card link.
function cardLink(page: Page, name: string) {
  return page
    .getByRole("link")
    .filter({ has: page.getByRole("heading", { level: 3, name, exact: true }) });
}

test("a location matching by name appears in search results and links to its public detail page", async ({
  page,
}) => {
  const LOCATION = {
    name: "Test E2E Location Search Probe",
    slug: "test-e2e-location-search-probe",
    type: "Region",
  };

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
  await expect(page).toHaveURL(`/admin/locations/${LOCATION.slug}/edit`);

  await page.goto(
    `/search?q=${encodeURIComponent("Test E2E Location Search Probe")}`
  );

  await expect(
    page.getByRole("heading", { level: 2, name: "Locations (1)", exact: true })
  ).toBeVisible();
  const card = cardLink(page, LOCATION.name);
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute("href", `/locations/${LOCATION.slug}`);

  await card.click();
  await expect(page).toHaveURL(`/locations/${LOCATION.slug}`);
  await expect(
    page.getByRole("heading", { level: 1, name: LOCATION.name, exact: true })
  ).toBeVisible();
});

test("an unrelated query is unaffected by the location group", async ({
  page,
}) => {
  // No fixture created here: proves the new Location query never changes
  // an existing group's results when nothing Location-related matches.
  await page.goto("/search?q=iron");

  await expect(
    page.getByRole("heading", { level: 2, name: "Items (3)", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: /^Locations/ })
  ).toHaveCount(0);
});
