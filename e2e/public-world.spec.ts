import { expect, test, type Page } from "@playwright/test";
import {
  E2E_PUBLIC_LOCATION_DIRECTORY_SLUG_PREFIX,
  createE2ePublicLocationDirectoryFixtures,
  deleteE2ePublicLocationDirectoryFixtures,
} from "./helpers/database-cleanup";

// World Navigation is a presentation layer over the real Location containment
// tree and the Shops attached to those Locations, so it reuses the Locations
// directory fixture rather than seeding a parallel world.
const REGION_SLUG = `${E2E_PUBLIC_LOCATION_DIRECTORY_SLUG_PREFIX}-region`;
const REGION_NAME = "Test E2E Northwind Region";
const TOWN_SLUG = `${E2E_PUBLIC_LOCATION_DIRECTORY_SLUG_PREFIX}-town`;
const TOWN_NAME = "Test E2E Brassmarket Township";

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
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth
      )
    )
    .toBe(true);
}

test("World Navigation renders the real containment tree and selects through the URL", async ({
  page,
}) => {
  await page.goto("/world");

  await expect(
    page.getByRole("heading", { level: 1, name: "World Navigation", exact: true })
  ).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);

  // The topmost real Location is the region heading; no invented World or
  // Region record sits behind it.
  const tree = page.getByRole("navigation", { name: "World locations" });
  await expect(tree.getByRole("link", { name: REGION_NAME })).toBeVisible();

  // Selecting a nested Location is a real, linkable, server-rendered URL.
  await page.goto(`/world?location=${TOWN_SLUG}`);
  await expect(
    page.locator(".world-tree-row--selected .world-tree-label")
  ).toHaveText(TOWN_NAME);
  await expect(
    page.getByRole("heading", { level: 2, name: TOWN_NAME, exact: true })
  ).toBeVisible();

  // Every ancestor of the selection is revealed, so the path stays navigable.
  await expect(page.locator(".world-detail-path")).toContainText(REGION_NAME);

  // The detail pane links out to the canonical Location page.
  await expect(page.getByRole("link", { name: /View full page/ })).toHaveAttribute(
    "href",
    `/locations/${TOWN_SLUG}`
  );
});

test("World Navigation never invents NPC data and hides empty relationships", async ({
  page,
}) => {
  await page.goto(`/world?location=${REGION_SLUG}`);

  // NPC is not a production resource: the handoff's "NPCs Present" panel is
  // omitted entirely rather than stubbed.
  await expect(page.getByText(/NPC/i)).toHaveCount(0);

  // Location facts are always meaningful, so that panel always renders.
  await expect(
    page.getByRole("heading", { level: 3, name: "Location facts", exact: true })
  ).toBeVisible();

  // A region with no directly assigned Shops omits the Shops panel entirely
  // rather than rendering an empty one.
  await expect(
    page.getByRole("heading", { level: 3, name: "Shops", exact: true })
  ).toHaveCount(0);
});

test("the World filter is a real server-rendered GET query", async ({ page }) => {
  await page.goto("/world");

  const search = page.getByRole("search", { name: "Filter locations" });
  await search.getByRole("searchbox").fill(TOWN_NAME);
  await search.getByRole("button", { name: "Filter locations" }).click();

  await expect(page).toHaveURL(/[?&]q=/);
  const tree = page.getByRole("navigation", { name: "World locations" });
  await expect(tree.getByRole("link", { name: TOWN_NAME })).toBeVisible();

  await page.goto("/world?q=Test%20E2E%20No%20Such%20Place");
  await expect(page.locator(".world-sidebar-empty")).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "World locations" })
  ).toHaveCount(0);
});

test("World Navigation has no horizontal overflow at the calibration widths", async ({
  page,
}) => {
  for (const [width, height] of [
    [1920, 1080],
    [2560, 1440],
    [3440, 1440],
    [1000, 1100],
    [390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto(`/world?location=${TOWN_SLUG}`);
    await expectNoHorizontalOverflow(page);
  }
});
