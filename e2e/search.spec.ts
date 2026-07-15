// Non-destructive browser coverage for the public global search: the
// header entry point, the /search page states, and result links. Read-only:
// nothing signs in and only GET forms are submitted, so no record, Auth
// user, or Storage object is touched. Runs unauthenticated in the public
// chromium project (the filename carries no admin- prefix). Seeded
// names/slugs come from prisma/seed.ts.

import { expect, test, type Page } from "@playwright/test";

// Browser error hygiene: any uncaught page error fails the test. Serial
// single-worker execution makes this module-level state safe.
let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(() => {
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

// The card component renders its title as an h3 inside the card link.
function cardLink(page: Page, name: string) {
  return page
    .getByRole("link")
    .filter({ has: page.getByRole("heading", { level: 3, name, exact: true }) });
}

// Both the header and the /search page contain a search form; scope every
// locator to its landmark so the two never collide.
function headerSearchInput(page: Page) {
  return page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("searchbox", { name: "Search query" });
}

function pageSearchInput(page: Page) {
  return page.getByRole("main").getByRole("searchbox", { name: "Search query" });
}

test("the header search form reaches /search with the submitted query", async ({
  page,
}) => {
  await page.goto("/");

  await headerSearchInput(page).fill("iron");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Search", exact: true })
    .click();

  await expect(page).toHaveURL("/search?q=iron");
  await expect(
    page.getByRole("heading", { level: 2, name: "Search", exact: true })
  ).toBeVisible();
  await expect(cardLink(page, "Iron Ore")).toBeVisible();
});

test("visiting /search without a query shows the empty-query guidance", async ({
  page,
}) => {
  await page.goto("/search");

  await expect(
    page.getByRole("heading", { level: 3, name: "Start searching" })
  ).toBeVisible();
  await expect(pageSearchInput(page)).toHaveValue("");

  // Submitting the still-empty page form stays in the guidance state.
  await page
    .getByRole("main")
    .getByRole("button", { name: "Search", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { level: 3, name: "Start searching" })
  ).toBeVisible();
});

test("a seeded query returns grouped items and recipes with counts", async ({
  page,
}) => {
  await page.goto("/search?q=iron");

  // Items group: Iron Ingot, Iron Ore, Iron Sword.
  await expect(
    page.getByRole("heading", { level: 2, name: "Items (3)", exact: true })
  ).toBeVisible();
  await expect(cardLink(page, "Iron Ore")).toBeVisible();
  await expect(cardLink(page, "Iron Ore")).toHaveAttribute(
    "href",
    "/items/iron-ore"
  );

  // Recipes group: Iron Ingot and Iron Sword. The two same-named cards
  // (item + recipe) are told apart by their hrefs.
  await expect(
    page.getByRole("heading", { level: 2, name: "Recipes (2)", exact: true })
  ).toBeVisible();
  await expect(cardLink(page, "Iron Sword")).toHaveCount(2);

  // No profession or category matches "iron": those groups are omitted.
  await expect(
    page.getByRole("heading", { level: 2, name: /^Professions/ })
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 2, name: /^Categories/ })
  ).toHaveCount(0);

  // The submitted query is retained in the page form.
  await expect(pageSearchInput(page)).toHaveValue("iron");
});

test("a result card links to the existing public detail page", async ({
  page,
}) => {
  await page.goto("/search?q=whetstone");

  await cardLink(page, "Whetstone").click();

  await expect(page).toHaveURL("/items/whetstone");
  await expect(
    page.getByRole("heading", { level: 2, name: "Whetstone", exact: true })
  ).toBeVisible();
});

test("matching is case-insensitive", async ({ page }) => {
  await page.goto("/search?q=IRON");

  await expect(
    page.getByRole("heading", { level: 2, name: "Items (3)", exact: true })
  ).toBeVisible();
  await expect(cardLink(page, "Iron Ore")).toBeVisible();
});

test("surrounding whitespace is trimmed from the query", async ({ page }) => {
  await page.goto("/search");

  await pageSearchInput(page).fill("  iron  ");
  await page
    .getByRole("main")
    .getByRole("button", { name: "Search", exact: true })
    .click();

  // The trimmed query still matches, and the input shows the trimmed value.
  await expect(cardLink(page, "Iron Ore")).toBeVisible();
  await expect(pageSearchInput(page)).toHaveValue("iron");
});

test("descriptions are searched where the field exists", async ({ page }) => {
  // "potions" appears only in the Consumables category description and the
  // Alchemy profession description.
  await page.goto("/search?q=potions");

  await expect(
    page.getByRole("heading", { level: 2, name: "Professions (1)", exact: true })
  ).toBeVisible();
  await expect(cardLink(page, "Alchemy")).toHaveAttribute(
    "href",
    "/professions/alchemy"
  );
  await expect(
    page.getByRole("heading", { level: 2, name: "Categories (1)", exact: true })
  ).toBeVisible();
  await expect(cardLink(page, "Consumables")).toHaveAttribute(
    "href",
    "/categories/consumables"
  );
});

test("a query with no matches shows the no-results message with the query", async ({
  page,
}) => {
  await page.goto("/search?q=test-e2e-no-such-thing");

  await expect(
    page.getByRole("heading", { level: 3, name: "No results" })
  ).toBeVisible();
  await expect(
    page.getByText('Nothing matched "test-e2e-no-such-thing".')
  ).toBeVisible();
  await expect(pageSearchInput(page)).toHaveValue("test-e2e-no-such-thing");
});
