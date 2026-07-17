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
    seededName: "Smithing",
    detailHref: "/professions/smithing",
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

// Slice 8B: the deterministic profession set. "Blacksmithing" was renamed
// to "Smithing" in place (same persisted row and recipe relations, see
// migration 20260716152420) rather than existing alongside it.
const EXPECTED_PROFESSIONS = [
  { name: "Alchemy", slug: "alchemy" },
  { name: "Archaeology", slug: "archaeology" },
  { name: "Construction", slug: "construction" },
  { name: "Cooking", slug: "cooking" },
  { name: "Crafting", slug: "crafting" },
  { name: "Farming", slug: "farming" },
  { name: "Fishing", slug: "fishing" },
  { name: "Foraging", slug: "foraging" },
  { name: "Mining", slug: "mining" },
  { name: "Smithing", slug: "smithing" },
] as const;

test.describe("profession coverage (Slice 8B)", () => {
  test("all ten deterministic professions are seeded with correct public links", async ({
    page,
  }) => {
    await page.goto("/professions");

    for (const profession of EXPECTED_PROFESSIONS) {
      const card = cardLink(page, profession.name);
      await expect(card).toBeVisible();
      await expect(card).toHaveAttribute(
        "href",
        `/professions/${profession.slug}`
      );
    }

    // The renamed profession no longer exists under its old name.
    await expect(cardLink(page, "Blacksmithing")).toHaveCount(0);
  });

  test("a sparse profession (no description, no recipes, no image) renders without empty optional content", async ({
    page,
  }) => {
    await page.goto("/professions/foraging");

    await expect(
      page.getByRole("heading", { level: 1, name: "Foraging", exact: true })
    ).toBeVisible();
    // No description was seeded: the shared PageHeader omits the paragraph
    // entirely rather than showing a placeholder.
    await expect(page.getByText("No description available")).toHaveCount(0);
    await expect(page.getByText("No image available")).toBeVisible();
    // No recipes either: the entire Recipes section (heading and empty
    // state alike) is omitted; the Details card still says "Recipes: 0".
    await expect(page.getByText("Recipes: 0")).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: "Recipes", exact: true })
    ).toHaveCount(0);
    await expect(page.getByText("No recipes yet")).toHaveCount(0);
  });
});
