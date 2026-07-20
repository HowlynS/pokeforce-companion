// Browser coverage for the Slice 9G.1 admin dashboard against the REAL
// application: /admin now renders a restrained resource-summary workspace
// (not an analytics dashboard) — five resource summary cards, a Game
// Version status panel, and a quick-actions section — instead of the old
// "Manage X" card grid. Sidebar wiring, active-state marking, and the
// secondary-settings-only reachability of Game Versions are already
// exhaustively covered by admin-shell.spec.ts and admin-game-versions.spec.ts;
// this suite only proves the dashboard's OWN content — counts, hide-empty
// behavior, canonical navigation targets, and the absence of any
// chart/trend/analytics UI.
//
// Runs in the chromium-admin project with the storage state saved by
// auth.setup.ts. The one temporary Item this suite creates uses the
// existing test-e2e-item slug prefix; no new cleanup surface is
// introduced.

import { expect, test, type Page } from "@playwright/test";
import {
  E2E_CURRENT_GAME_VERSION_NAME,
  countE2eTestItemRecords,
  deleteE2eTestItemRecords,
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
  await deleteE2eTestItemRecords();
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

test.beforeAll(async () => {
  await deleteE2eTestItemRecords();
  expect(await countE2eTestItemRecords()).toBe(0);
});

test.afterAll(async () => {
  const remaining = await deleteE2eTestItemRecords();
  expect(remaining).toBe(0);
});

// The dashboard's own content region, excluding the persistent sidebar —
// the sidebar carries its own "/admin/items"-style links, so summary-card
// assertions must be scoped here to avoid matching the nav instead.
function dashboardMain(page: Page) {
  return page.locator(".admin-workspace-main");
}

function summaryCard(page: Page, href: string) {
  return dashboardMain(page).locator(`a[href="${href}"]`);
}

async function readItemCount(page: Page): Promise<number> {
  const text = await summaryCard(page, "/admin/items").innerText();
  const match = text.match(/(\d+)/);
  if (!match) throw new Error(`no count found in Items card: "${text}"`);
  return Number(match[1]);
}

test("the dashboard renders exactly one h1 and a resource summary card per completed workspace", async ({
  page,
}) => {
  await page.goto("/admin");

  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(
    page.getByRole("heading", { level: 1, name: "Dashboard", exact: true })
  ).toBeVisible();

  const resources: Array<{ name: string; href: string }> = [
    { name: "Items", href: "/admin/items" },
    { name: "Recipes", href: "/admin/recipes" },
    { name: "Professions", href: "/admin/professions" },
    { name: "Categories", href: "/admin/categories" },
    { name: "Locations", href: "/admin/locations" },
  ];

  for (const resource of resources) {
    const card = summaryCard(page, resource.href);
    await expect(card).toBeVisible();
    await expect(
      card.getByRole("heading", { level: 3, name: resource.name, exact: true })
    ).toBeVisible();
    // The count itself is real, digit-only text — never a placeholder dash.
    await expect(card).toContainText(/\d+/);
    await expect(card).not.toContainText("—");
  }

  // Exactly one card per resource — no duplicate-link ambiguity.
  for (const resource of resources) {
    await expect(
      dashboardMain(page).locator(`a[href="${resource.href}"]`)
    ).toHaveCount(1);
  }
});

test("quick actions link directly to each resource's canonical create route", async ({
  page,
}) => {
  await page.goto("/admin");

  const quickActions = page.getByRole("navigation", {
    name: "Quick create actions",
  });
  await expect(quickActions).toBeVisible();

  const createLinks: Array<{ label: string; href: string }> = [
    { label: "Create Item", href: "/admin/items/new" },
    { label: "Create Recipe", href: "/admin/recipes/new" },
    { label: "Create Profession", href: "/admin/professions/new" },
    { label: "Create Category", href: "/admin/categories/new" },
    { label: "Create Location", href: "/admin/locations/new" },
  ];

  for (const link of createLinks) {
    const anchor = quickActions.getByRole("link", {
      name: link.label,
      exact: true,
    });
    await expect(anchor).toHaveAttribute("href", link.href);
  }

  // Acquisition Sources are Item-owned and explicitly excluded from
  // quick-create — there is no source-creation shortcut on the dashboard.
  await expect(
    quickActions.getByRole("link", { name: /source/i })
  ).toHaveCount(0);
});

test("the Game Version panel shows the current version by name, a total count, and links to management, with no internal id exposed", async ({
  page,
}) => {
  await page.goto("/admin");

  const panel = page
    .locator(".admin-panel")
    .filter({
      has: page.getByRole("heading", { level: 2, name: "Game Version", exact: true }),
    });
  await expect(panel).toBeVisible();

  // The persistent fixture is the current version for the whole suite.
  await expect(panel).toContainText(E2E_CURRENT_GAME_VERSION_NAME);
  await expect(panel).toContainText(/\d+/);

  await expect(
    panel.getByRole("link", { name: "Game Versions", exact: true })
  ).toHaveAttribute("href", "/admin/settings/game-versions");

  // No raw database id anywhere in the panel.
  await expect(panel.locator('input[type="hidden"]')).toHaveCount(0);
});

test("the dashboard contains no chart, graph, or fabricated analytics", async ({
  page,
}) => {
  await page.goto("/admin");

  const main = dashboardMain(page);
  await expect(main.locator("canvas")).toHaveCount(0);
  await expect(main.locator("svg")).toHaveCount(0);
  await expect(main.getByText(/%/)).toHaveCount(0);
  await expect(main.getByText(/recent activity/i)).toHaveCount(0);
  await expect(main.getByText(/trend/i)).toHaveCount(0);

  // Strictly navigational and read-only: no dashboard mutation form.
  await expect(main.locator("form")).toHaveCount(0);
});

test("the Items summary count reflects a real record created and removed through the admin UI", async ({
  page,
}) => {
  await page.goto("/admin");
  const baseline = await readItemCount(page);

  await page.goto("/admin/items/new");
  await page.getByLabel("Name", { exact: true }).fill("Test E2E Item Dashboard Count");
  await page.getByLabel(/^Slug/).fill("test-e2e-item-dashboard-count");
  await page.getByRole("button", { name: "Create item", exact: true }).click();
  await expect(page).toHaveURL("/admin/items?success=created");

  await page.goto("/admin");
  expect(await readItemCount(page)).toBe(baseline + 1);

  await deleteE2eTestItemRecords();

  await page.goto("/admin");
  expect(await readItemCount(page)).toBe(baseline);
});

test("seeded fixtures are preserved and no test item remains", async () => {
  expect(await readFixtureCounts()).toEqual({
    categories: 5,
    professions: 10,
    items: 16,
    recipes: 8,
    recipeIngredients: 15,
  });
  expect(await countE2eTestItemRecords()).toBe(0);
});
