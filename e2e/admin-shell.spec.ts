// Browser coverage for the shared admin shell against the REAL
// application: the persistent sidebar wraps authenticated admin routes,
// carries exactly the seven approved primary destinations (Game Versions
// promoted to primary in the Visual Pass, sub-slice 8), marks the active
// section (including on child routes), and never appears on public
// pages. Runs in the chromium-admin project with the storage state saved
// by auth.setup.ts. Read-only: every visit targets seeded fixtures
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
  { label: "Game Versions", href: "/admin/settings/game-versions" },
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

test("the sidebar carries exactly the seven primary destinations with their approved targets", async ({
  page,
}) => {
  await page.goto("/admin");

  const links = sidebar(page).getByRole("link");
  await expect(links).toHaveCount(PRIMARY_DESTINATIONS.length);

  for (const [index, destination] of PRIMARY_DESTINATIONS.entries()) {
    const link = links.nth(index);
    await expect(link).toHaveText(destination.label);
    await expect(link).toHaveAttribute("href", destination.href);
    // Each destination carries exactly one decorative icon — aria-hidden,
    // so it never becomes part of the link's own accessible name (proven
    // above by the exact-text match against the label alone).
    await expect(link.locator("svg.admin-nav-icon")).toHaveCount(1);
    await expect(link.locator("svg.admin-nav-icon")).toHaveAttribute(
      "aria-hidden",
      "true"
    );
  }

  // Acquisition Sources still never joins primary navigation — it stays
  // contextual under its owning item.
  await expect(
    sidebar(page).getByRole("link", { name: /source/i })
  ).toHaveCount(0);

  // Game Versions is reachable from both the sidebar and the dashboard's
  // own Game Versions module. Visual Pass II Section 8 restructured that
  // module into a linked summary carrying count/context text alongside
  // the heading, so its accessible name is no longer exactly "Game
  // Versions" — the link itself (and its href) is otherwise unchanged.
  await expect(
    sidebar(page).getByRole("link", { name: "Game Versions", exact: true })
  ).toBeVisible();
  const dashboardGameVersionsLink = page
    .locator(".admin-workspace-main")
    .locator('a[href="/admin/settings/game-versions"]');
  await expect(dashboardGameVersionsLink).toBeVisible();
  await expect(
    dashboardGameVersionsLink.getByRole("heading", {
      level: 3,
      name: "Game Versions",
      exact: true,
    })
  ).toBeVisible();
});

test("the active destination's icon and label both turn gold; keyboard focus stays visible", async ({
  page,
}) => {
  await page.goto("/admin/items");

  const active = activeLink(page);
  await expect(active).toHaveText("Items");
  const activeColor = await active.evaluate(
    (el) => getComputedStyle(el).color
  );
  const activeIconColor = await active
    .locator("svg.admin-nav-icon")
    .evaluate((el) => getComputedStyle(el).color);
  // The icon has no color of its own — it inherits currentColor from the
  // active link, so both computed colors must match exactly.
  expect(activeIconColor).toBe(activeColor);

  // Keyboard focus on a nav link is still visible (the shared
  // a:focus-visible outline rule), unaffected by the added icon markup.
  // Focused directly (rather than counting Tab presses) so the assertion
  // does not depend on how many focusable elements precede the sidebar.
  const recipesLink = sidebar(page).getByRole("link", {
    name: "Recipes",
    exact: true,
  });
  await recipesLink.focus();
  await expect(recipesLink).toBeFocused();
  const { outlineStyle, outlineColor } = await recipesLink.evaluate((el) => {
    const style = getComputedStyle(el);
    return { outlineStyle: style.outlineStyle, outlineColor: style.outlineColor };
  });
  expect(outlineStyle).toBe("solid");
  expect(outlineColor).toBe("rgb(250, 204, 21)");
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

  // Game Versions (Visual Pass sub-slice 8): a primary destination now,
  // active on nested routes too.
  await page.goto("/admin/settings/game-versions");
  await expect(activeLink(page)).toHaveText("Game Versions");
});

test("the Game Versions settings routes render inside the shell with Game Versions active", async ({
  page,
}) => {
  await page.goto("/admin/settings/game-versions");

  await expect(sidebar(page)).toBeVisible();
  await expect(activeLink(page)).toHaveText("Game Versions");
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

test("the sidebar carries a signed-in account card with a working Sign out control, positioned above primary navigation", async ({
  page,
}) => {
  // Visual Pass II Section 8: moved here from the Dashboard's own main
  // content — present on every admin route, not just /admin.
  await page.goto("/admin/items");

  const account = page.locator(".admin-sidebar-account");
  await expect(account).toBeVisible();
  // A real email address, never a placeholder or the record's database id.
  await expect(account).toContainText(/@/);

  const signOut = account.getByRole("button", { name: "Sign out", exact: true });
  await expect(signOut).toBeVisible();

  // Structurally between the brand lockup and the primary nav — never
  // inside the main content area.
  const accountBox = await account.boundingBox();
  const brandBox = await page.locator(".admin-sidebar-brand").boundingBox();
  const navBox = await sidebar(page).boundingBox();
  expect(accountBox).not.toBeNull();
  expect(brandBox).not.toBeNull();
  expect(navBox).not.toBeNull();
  expect(accountBox!.y).toBeGreaterThanOrEqual(brandBox!.y + brandBox!.height);
  expect(accountBox!.y).toBeLessThanOrEqual(navBox!.y);
  await expect(page.locator(".admin-workspace-main")).not.toContainText(
    "Sign out"
  );
});
