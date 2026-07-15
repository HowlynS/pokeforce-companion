// Non-destructive browser coverage for the homepage, main navigation, and
// the four public list pages. Read-only: nothing signs in, no form is
// submitted, and no record, Auth user, or Storage object is touched.
// Selectors are accessible roles, headings, and link names — never CSS
// classes. Seeded names/slugs come from prisma/seed.ts.

import { expect, test, type Page } from "@playwright/test";

// Browser error hygiene (Group 9): any uncaught page error fails the test.
// Serial single-worker execution makes this module-level state safe.
let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(() => {
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

// The card component renders its title as an h3 inside the card link, so a
// card is located by its exact heading — stable against styling changes.
function cardLink(page: Page, name: string) {
  return page
    .getByRole("link")
    .filter({ has: page.getByRole("heading", { level: 3, name, exact: true }) });
}

test.describe("homepage", () => {
  test("renders the shell, heading, and main landmark", async ({ page }) => {
    await page.goto("/");

    // The page title is the one h1; the shell's brand lockup is a home
    // link (containing the product name and tagline), not a heading.
    await expect(
      page.getByRole("heading", { level: 1, name: "PokeForce Companion" })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Crafting Wiki Companion/ })
    ).toHaveAttribute("href", "/");
    await expect(page.getByRole("main")).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Main navigation" })
    ).toBeVisible();
  });
});

const NAV_TARGETS = [
  { label: "Items", path: "/items", heading: "Items" },
  { label: "Recipes", path: "/recipes", heading: "Recipes" },
  { label: "Professions", path: "/professions", heading: "Professions" },
  { label: "Categories", path: "/categories", heading: "Categories" },
] as const;

test.describe("main navigation", () => {
  for (const target of NAV_TARGETS) {
    test(`the ${target.label} link opens ${target.path}`, async ({ page }) => {
      await page.goto("/");

      await page
        .getByRole("navigation", { name: "Main navigation" })
        .getByRole("link", { name: target.label, exact: true })
        .click();

      await expect(page).toHaveURL(target.path);
      await expect(
        page.getByRole("heading", { level: 1, name: target.heading, exact: true })
      ).toBeVisible();
    });
  }
});

// One deterministic seeded record per list page, with its expected detail
// route (exact names and slugs from prisma/seed.ts).
const LIST_PAGES = [
  {
    path: "/items",
    heading: "Items",
    seededName: "Iron Ore",
    detailHref: "/items/iron-ore",
  },
  {
    path: "/recipes",
    heading: "Recipes",
    seededName: "Iron Sword",
    detailHref: "/recipes/iron-sword",
  },
  {
    path: "/professions",
    heading: "Professions",
    seededName: "Blacksmithing",
    detailHref: "/professions/blacksmithing",
  },
  {
    path: "/categories",
    heading: "Categories",
    seededName: "Materials",
    detailHref: "/categories/materials",
  },
] as const;

test.describe("public list pages", () => {
  for (const listPage of LIST_PAGES) {
    test(`${listPage.path} lists the seeded "${listPage.seededName}" record`, async ({
      page,
    }) => {
      await page.goto(listPage.path);

      await expect(
        page.getByRole("heading", { level: 1, name: listPage.heading, exact: true })
      ).toBeVisible();

      const card = cardLink(page, listPage.seededName);
      await expect(card).toBeVisible();
      await expect(card).toHaveAttribute("href", listPage.detailHref);
    });
  }
});
