// Non-destructive browser coverage for public detail pages, relational
// navigation between them, and the no-image fallback. Read-only against the
// deterministic seed from prisma/seed.ts:
//   Recipe "Iron Sword" -> results in Item "Iron Sword" (category Gear),
//   ingredients Iron Ingot x2 and Leather Strap x1, profession Smithing.
//   Category "Materials" holds Iron Ore; no seeded record has an image.

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

// The card component renders its title as an h3 inside the card link.
function cardLink(page: Page, name: string) {
  return page
    .getByRole("link")
    .filter({ has: page.getByRole("heading", { level: 3, name, exact: true }) });
}

test.describe("public detail pages", () => {
  test("item detail shows details and the producing recipe", async ({ page }) => {
    await page.goto("/items/iron-sword");

    await expect(
      page.getByRole("heading", { level: 1, name: "Iron Sword", exact: true })
    ).toBeVisible();
    // Relational facts rendered as text in the Details card.
    await expect(page.getByText("Category: Gear")).toBeVisible();

    await expect(
      page.getByRole("heading", { level: 2, name: "Produced by" })
    ).toBeVisible();
    const producingRecipe = cardLink(page, "Iron Sword");
    await expect(producingRecipe).toBeVisible();
    await expect(producingRecipe).toHaveAttribute("href", "/recipes/iron-sword");
  });

  test("recipe detail links the resulting item and its ingredients", async ({
    page,
  }) => {
    await page.goto("/recipes/iron-sword");

    await expect(
      page.getByRole("heading", { level: 1, name: "Iron Sword", exact: true })
    ).toBeVisible();

    const resultCard = cardLink(page, "Result: Iron Sword");
    await expect(resultCard).toBeVisible();
    await expect(resultCard).toHaveAttribute("href", "/items/iron-sword");

    await expect(
      page.getByRole("heading", { level: 2, name: "Ingredients" })
    ).toBeVisible();
    const ironIngot = cardLink(page, "Iron Ingot");
    await expect(ironIngot).toHaveAttribute("href", "/items/iron-ingot");
    const leatherStrap = cardLink(page, "Leather Strap");
    await expect(leatherStrap).toHaveAttribute("href", "/items/leather-strap");
  });

  test("profession detail links its recipes", async ({ page }) => {
    await page.goto("/professions/smithing");

    await expect(
      page.getByRole("heading", { level: 1, name: "Smithing", exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: "Recipes", exact: true })
    ).toBeVisible();

    const recipeCard = cardLink(page, "Iron Ingot");
    await expect(recipeCard).toBeVisible();
    await expect(recipeCard).toHaveAttribute("href", "/recipes/iron-ingot");
  });

  test("category detail links its items", async ({ page }) => {
    await page.goto("/categories/materials");

    await expect(
      page.getByRole("heading", { level: 1, name: "Materials", exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: "Items", exact: true })
    ).toBeVisible();

    const itemCard = cardLink(page, "Iron Ore");
    await expect(itemCard).toBeVisible();
    await expect(itemCard).toHaveAttribute("href", "/items/iron-ore");
  });
});

test.describe("relational navigation journeys", () => {
  test("recipe list -> recipe detail -> resulting item detail", async ({
    page,
  }) => {
    await page.goto("/recipes");
    await cardLink(page, "Iron Sword").click();
    await expect(page).toHaveURL("/recipes/iron-sword");

    await cardLink(page, "Result: Iron Sword").click();
    await expect(page).toHaveURL("/items/iron-sword");
    await expect(
      page.getByRole("heading", { level: 1, name: "Iron Sword", exact: true })
    ).toBeVisible();
  });

  test("category list -> category detail -> item detail", async ({ page }) => {
    await page.goto("/categories");
    await cardLink(page, "Materials").click();
    await expect(page).toHaveURL("/categories/materials");

    await cardLink(page, "Iron Ore").click();
    await expect(page).toHaveURL("/items/iron-ore");
    await expect(
      page.getByRole("heading", { level: 1, name: "Iron Ore", exact: true })
    ).toBeVisible();
  });

  test("profession detail -> recipe detail", async ({ page }) => {
    await page.goto("/professions/smithing");
    await cardLink(page, "Iron Sword").click();
    await expect(page).toHaveURL("/recipes/iron-sword");
    await expect(
      page.getByRole("heading", { level: 1, name: "Iron Sword", exact: true })
    ).toBeVisible();
  });
});

test.describe("image fallback", () => {
  test("list cards show the no-image fallback for seeded records", async ({
    page,
  }) => {
    await page.goto("/items");
    // Every seeded record is imageless, so the fallback must be present.
    await expect(page.getByText("No image available").first()).toBeVisible();
  });

  test("detail pages show the no-image fallback for seeded records", async ({
    page,
  }) => {
    await page.goto("/items/iron-ore");
    await expect(
      page.getByRole("heading", { level: 1, name: "Iron Ore", exact: true })
    ).toBeVisible();
    await expect(page.getByText("No image available").first()).toBeVisible();
  });
});
