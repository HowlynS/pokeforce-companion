// Browser coverage for the Slice 9H visual-consistency pass against the
// REAL application. This suite deliberately does NOT re-prove ground
// already covered exhaustively elsewhere (aria-current wiring, tab
// navigation, record-list behavior, delete reachability) — it targets
// only what THIS slice actually changed: the editor chrome's accent
// unifying from purple to the same gold used across the rest of the
// admin shell, native controls adopting the dark color-scheme, and a
// consolidated one-h1 sweep across representative routes. No screenshot
// or pixel-diff infrastructure is used — computed-style reads are the
// narrowest check that can catch an accidental revert to the old purple
// accent, and are deliberately limited to the two properties this slice
// actually recolored.

import { expect, test, type Page } from "@playwright/test";

const GOLD_ACCENT_RGB = "rgb(250, 204, 21)";
const OLD_PURPLE_ACCENT_RGB = "rgb(139, 92, 246)";

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

function tabNav(page: Page) {
  return page.getByRole("navigation", { name: "Item editor sections" });
}

test("the active editor tab uses the gold accent, never the retired purple admin accent", async ({
  page,
}) => {
  // Seeded fixture only — read, never modified.
  await page.goto("/admin/items/iron-ore/edit");

  const activeTab = tabNav(page).locator('[aria-current="page"]');
  await expect(activeTab).toHaveText("General");

  const borderBottomColor = await activeTab.evaluate(
    (el) => getComputedStyle(el).borderBottomColor
  );
  expect(borderBottomColor).toBe(GOLD_ACCENT_RGB);
  expect(borderBottomColor).not.toBe(OLD_PURPLE_ACCENT_RGB);
});

test("the selected record-list row uses the gold accent, never the retired purple admin accent", async ({
  page,
}) => {
  await page.goto("/admin/items/iron-ore/edit");

  const selectedRow = page
    .getByRole("navigation", { name: "Items records" })
    .locator('[aria-current="page"]');
  await expect(selectedRow).toBeVisible();

  const borderLeftColor = await selectedRow.evaluate(
    (el) => getComputedStyle(el).borderLeftColor
  );
  expect(borderLeftColor).toBe(GOLD_ACCENT_RGB);
  expect(borderLeftColor).not.toBe(OLD_PURPLE_ACCENT_RGB);
});

test("the document declares a dark color-scheme, so native controls (selects, checkboxes) match the dark admin UI", async ({
  page,
}) => {
  await page.goto("/admin/locations/new");

  const colorScheme = await page.evaluate(
    () => getComputedStyle(document.documentElement).colorScheme
  );
  expect(colorScheme).toContain("dark");
});

test("exactly one h1 renders across representative admin routes", async ({
  page,
}) => {
  const routes = [
    "/admin",
    "/admin/items/iron-ore/edit",
    "/admin/items/iron-ore/recipes",
    "/admin/recipes/iron-sword/edit",
    "/admin/recipes/iron-sword/ingredients",
    "/admin/professions/smithing/edit",
    "/admin/professions/smithing/recipes",
    "/admin/categories/materials/edit",
    "/admin/categories/materials/items",
    "/admin/items/new",
    "/admin/items/iron-ore/delete",
    "/admin/settings/game-versions",
  ];

  for (const route of routes) {
    await page.goto(route);
    await expect(
      page.getByRole("heading", { level: 1 }),
      `expected exactly one h1 on ${route}`
    ).toHaveCount(1);
  }
});
