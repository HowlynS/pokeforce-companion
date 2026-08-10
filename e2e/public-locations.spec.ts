import { expect, test, type Page } from "@playwright/test";
import {
  createE2ePublicLocationDirectoryFixtures,
  deleteE2ePublicLocationDirectoryFixtures,
} from "./helpers/database-cleanup";

let pageErrors: string[] = [];

test.beforeAll(async () => {
  await createE2ePublicLocationDirectoryFixtures();
});

test.afterAll(async () => {
  await deleteE2ePublicLocationDirectoryFixtures();
});

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(() => {
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
}

test("Locations catalogue renders the real root/type hierarchy without NPC data", async ({
  page,
}) => {
  await page.goto("/locations");

  await expect(page.getByRole("heading", { level: 1, name: "Locations" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Test E2E Northwind Region" }),
  ).toHaveAttribute(
    "href",
    "/locations/test-e2e-location-public-directory-region",
  );
  await expect(
    page.getByRole("heading", { level: 3, name: "Route", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: /Test E2E Long Caravan Route Through the Amber Highlands/,
    }),
  ).toBeVisible();
  await expect(page.getByText(/NPC/i)).toHaveCount(0);

  await page.getByRole("button", { name: "Collapse Route" }).click();
  await expect(
    page.getByRole("link", {
      name: /Test E2E Long Caravan Route Through the Amber Highlands/,
    }),
  ).toBeHidden();
  await page.getByRole("button", { name: "Expand Route" }).click();
  await expect(
    page.getByRole("link", {
      name: /Test E2E Long Caravan Route Through the Amber Highlands/,
    }),
  ).toBeVisible();
});

test("Location search and type filter are real GET controls", async ({ page }) => {
  await page.goto("/locations");

  const search = page.getByRole("searchbox", { name: "Find a location by name..." });
  await search.fill("Special Auction");
  await search.press("Enter");
  await expect(page).toHaveURL(/q=Special(?:\+|%20)Auction/);
  await expect(page.getByText("Test E2E Brassmarket Township")).toHaveCount(0);
  await expect(page.getByText(/Special Auction Annex/).first()).toBeVisible();

  await page.goto("/locations");
  await page.getByRole("button", { name: "Filter" }).click();
  await page.getByLabel("Route", { exact: true }).check();
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/type=ROUTE/);
  await expect(page.getByText(/Long Caravan Route/).first()).toBeVisible();
  await expect(page.getByText("Test E2E Brassmarket Township")).toHaveCount(0);
});

test("Locations catalogue has no horizontal overflow at all calibration widths", async ({
  page,
}) => {
  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 2560, height: 1440 },
    { width: 3440, height: 1440 },
    { width: 1000, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/locations");
    await expectNoHorizontalOverflow(page);
  }
});

test("Location detail renders direct children in the handoff grid/list directory", async ({
  page,
}) => {
  await page.goto("/locations/test-e2e-location-public-directory-region");

  await expect(
    page.getByRole("heading", { level: 1, name: "Test E2E Northwind Region" }),
  ).toBeVisible();
  const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
  await expect(breadcrumb.getByRole("link", { name: "Home" })).toHaveAttribute(
    "href",
    "/",
  );
  await expect(breadcrumb.getByRole("link", { name: "Locations" })).toHaveAttribute(
    "href",
    "/locations",
  );
  await expect(
    page.getByRole("heading", { level: 2, name: "Location Details" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Sub-locations" }),
  ).toBeVisible();
  await expect(page.getByText("3", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "List", exact: true }).click();
  await expect(page.locator(".location-detail-child-list-row")).toHaveCount(3);
  await page.getByRole("button", { name: "Sub-locations", exact: true }).click();
  await expect(page.locator(".location-detail-child-list-row")).toHaveCount(0);

  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.reload();
    await expectNoHorizontalOverflow(page);
  }
});
