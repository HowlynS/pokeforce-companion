// Browser coverage for the admin dashboard against the REAL application:
// /admin renders a restrained resource-summary workspace (not an
// analytics dashboard) — six resource modules (Items, Recipes,
// Professions, Categories, Locations, Game Versions), each a linked
// summary plus an attached create action (Visual Pass II Section 8) —
// instead of the old "Manage X" card grid. The former separate Game
// Version ContextPanel and the Quick Actions section are both gone: Game
// Versions is now a sixth module in the same grid, and each module's own
// attached action replaces Quick Actions' row of links. The signed-in
// account card and Sign out control moved into the sidebar (proven in
// admin-shell.spec.ts, not here). Sidebar wiring, active-state marking,
// and the secondary-settings-only reachability of Game Versions are
// already exhaustively covered by admin-shell.spec.ts and
// admin-game-versions.spec.ts; this suite only proves the dashboard's OWN
// content — counts, hide-empty behavior, canonical navigation targets,
// and the absence of any chart/trend/analytics UI.
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

test("the dashboard renders exactly one h1 and a resource module per completed workspace, including Game Versions", async ({
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
    { name: "Game Versions", href: "/admin/settings/game-versions" },
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

  // Exactly one summary link per resource — no duplicate-link ambiguity
  // (each module's attached create action carries a DIFFERENT href, so it
  // never collides with this count).
  for (const resource of resources) {
    await expect(
      dashboardMain(page).locator(`a[href="${resource.href}"]`)
    ).toHaveCount(1);
  }
});

test("each module's attached create action links directly to its resource's canonical create route", async ({
  page,
}) => {
  await page.goto("/admin");

  // The former separate "Quick create actions" nav is gone — each
  // resource module now carries its OWN attached create action instead
  // (Visual Pass II Section 8).
  await expect(
    page.getByRole("navigation", { name: "Quick create actions" })
  ).toHaveCount(0);

  const createLinks: Array<{ label: string; href: string }> = [
    { label: "Create item", href: "/admin/items/new" },
    { label: "Create recipe", href: "/admin/recipes/new" },
    { label: "Create profession", href: "/admin/professions/new" },
    { label: "Create category", href: "/admin/categories/new" },
    { label: "Create location", href: "/admin/locations/new" },
    {
      label: "Create game version",
      href: "/admin/settings/game-versions#create-game-version",
    },
  ];

  for (const link of createLinks) {
    const anchor = dashboardMain(page).getByRole("link", {
      name: link.label,
      exact: true,
    });
    await expect(anchor).toHaveAttribute("href", link.href);
  }

  // Acquisition Sources are Item-owned and explicitly excluded from
  // quick-create — there is no source-creation shortcut on the dashboard.
  // Scoped to the attached create-action links specifically: the Items
  // module's own SUMMARY text legitimately mentions "acquisition
  // sources" as supporting context, which is not a create shortcut.
  await expect(
    dashboardMain(page)
      .locator(".admin-dashboard-card-action")
      .filter({ hasText: /source/i })
  ).toHaveCount(0);
});

test("the Game Versions module shows the current version by name and a total count, with no internal id exposed", async ({
  page,
}) => {
  await page.goto("/admin");

  const card = summaryCard(page, "/admin/settings/game-versions");
  await expect(card).toBeVisible();

  // The persistent fixture is the current version for the whole suite.
  await expect(card).toContainText(E2E_CURRENT_GAME_VERSION_NAME);
  await expect(card).toContainText(/\d+/);

  // No raw database id anywhere on the dashboard.
  await expect(dashboardMain(page).locator('input[type="hidden"]')).toHaveCount(0);
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
  await page.getByLabel(/^Page address/).fill("test-e2e-item-dashboard-count");
  await page.getByRole("button", { name: "Create item", exact: true }).click();
  await expect(page).toHaveURL(
    "/admin/items/test-e2e-item-dashboard-count/edit"
  );

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
