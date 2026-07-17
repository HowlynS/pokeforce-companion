// Browser coverage for the Slice 9B.1 shared admin shell against the REAL
// application: the persistent sidebar wraps authenticated admin routes,
// carries exactly the six approved primary destinations, marks the active
// section (including on child routes), never appears on public pages, and
// keeps Game Versions reachable only through the dashboard's secondary
// settings link. Runs in the chromium-admin project with the storage state
// saved by auth.setup.ts. Read-only: every visit targets seeded fixtures
// (iron-ore, iron-sword, smithing, materials) or list pages, so no cleanup
// hooks are needed. The fine-grained active-state mapping (every child
// route shape, boundary cases, settings routes) is unit-tested in
// src/lib/admin/admin-nav.test.ts — this spec proves the wiring in a real
// browser, not every mapping.

import { expect, test, type Page } from "@playwright/test";

const PRIMARY_DESTINATIONS = [
  { label: "Dashboard", href: "/admin" },
  { label: "Items", href: "/admin/items" },
  { label: "Recipes", href: "/admin/recipes" },
  { label: "Professions", href: "/admin/professions" },
  { label: "Categories", href: "/admin/categories" },
  { label: "Locations", href: "/admin/locations" },
] as const;

// Browser error hygiene: any uncaught page error fails the test. Serial
// single-worker execution makes this module-level state safe.
let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(async () => {
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

function sidebar(page: Page) {
  return page.getByRole("navigation", { name: "Admin navigation" });
}

function activeLink(page: Page) {
  return sidebar(page).locator('a[aria-current="page"]');
}

test("the sidebar carries exactly the six primary destinations with their approved targets", async ({
  page,
}) => {
  await page.goto("/admin");

  const links = sidebar(page).getByRole("link");
  await expect(links).toHaveCount(PRIMARY_DESTINATIONS.length);

  for (const [index, destination] of PRIMARY_DESTINATIONS.entries()) {
    const link = links.nth(index);
    await expect(link).toHaveText(destination.label);
    await expect(link).toHaveAttribute("href", destination.href);
  }

  // Excluded destinations never join primary navigation: Game Versions
  // stays a secondary settings link on the dashboard body, and
  // Acquisition Sources stay contextual under their owning item.
  await expect(
    sidebar(page).getByRole("link", { name: /game version/i })
  ).toHaveCount(0);
  await expect(
    sidebar(page).getByRole("link", { name: /source/i })
  ).toHaveCount(0);

  // The secondary settings path itself still works from the dashboard.
  await expect(
    page.getByRole("link", { name: "Game Versions", exact: true })
  ).toBeVisible();
});

test("the sidebar persists across admin sections and marks the active one", async ({
  page,
}) => {
  await page.goto("/admin");
  await expect(activeLink(page)).toHaveText("Dashboard");

  // Each destination reached through the sidebar itself: the shell stays
  // present and the active marker follows, one section at a time.
  for (const destination of PRIMARY_DESTINATIONS.slice(1)) {
    await sidebar(page)
      .getByRole("link", { name: destination.label, exact: true })
      .click();
    await expect(page).toHaveURL(destination.href);
    await expect(activeLink(page)).toHaveText(destination.label);
  }
});

test("child routes keep their section active", async ({ page }) => {
  // Seeded fixtures only — read, never modified.
  await page.goto("/admin/items/iron-ore/edit");
  await expect(activeLink(page)).toHaveText("Items");

  // Acquisition sources are contextual under their owning item.
  await page.goto("/admin/items/iron-ore/sources");
  await expect(activeLink(page)).toHaveText("Items");

  await page.goto("/admin/recipes/iron-sword/edit");
  await expect(activeLink(page)).toHaveText("Recipes");

  await page.goto("/admin/professions/smithing/edit");
  await expect(activeLink(page)).toHaveText("Professions");

  await page.goto("/admin/categories/materials/edit");
  await expect(activeLink(page)).toHaveText("Categories");
});

test("the secondary settings routes render inside the shell with no primary section active", async ({
  page,
}) => {
  await page.goto("/admin/settings/game-versions");

  await expect(sidebar(page)).toBeVisible();
  await expect(activeLink(page)).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 1, name: "Game Versions" })
  ).toBeVisible();
});

test("public pages never receive the admin shell, even for a signed-in admin", async ({
  page,
}) => {
  for (const publicPath of ["/", "/items", "/items/iron-ore"]) {
    await page.goto(publicPath);
    await expect(sidebar(page)).toHaveCount(0);
  }
});
