import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  createE2ePublicProfessionDetailFixture,
  deleteE2ePublicProfessionDetailFixture,
  readE2ePublicProfessionDetailFixtureState,
} from "./helpers/database-cleanup";
import { readValidatedProfessionSpriteBytes } from "./helpers/profession-sprite-fixtures";

const SPRITE_DIRECTORY = path.join(__dirname, "fixtures", "profession-sprites");
const SCREENSHOT_DIRECTORY = path.join(
  process.cwd(),
  "test-results",
  "resource-responsibility-visuals",
);
const VIEWPORTS = [
  { name: "1920x1080", width: 1920, height: 1080 },
  { name: "2560x1440", width: 2560, height: 1440 },
  { name: "3440x1440", width: 3440, height: 1440 },
  { name: "intermediate-1000x1100", width: 1000, height: 1100 },
  { name: "mobile-390x844", width: 390, height: 844 },
] as const;

let fixture: Awaited<ReturnType<typeof createE2ePublicProfessionDetailFixture>>;
let pageErrors: string[] = [];

test.beforeAll(async () => {
  fs.mkdirSync(SCREENSHOT_DIRECTORY, { recursive: true });
  const sprites = readValidatedProfessionSpriteBytes(SPRITE_DIRECTORY);
  fixture = await createE2ePublicProfessionDetailFixture(
    sprites.kilnkeeperCrucible,
    sprites,
  );
});

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(() => {
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

test.afterAll(async () => {
  await deleteE2ePublicProfessionDetailFixture();
  expect(await readE2ePublicProfessionDetailFixtureState()).toEqual({
    professions: 0,
    recipes: 0,
    recipeIngredients: 0,
    items: 0,
    storageObjects: 0,
  });
});

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
}

test("Profession detail exposes its complete linked Recipe directory", async ({
  page,
}) => {
  const professionPath = `/professions/${fixture.profession.slug}`;

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    await page.goto(professionPath);
    await expectNoHorizontalOverflow(page);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: fixture.profession.name,
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.locator(".recipe-output-card--profession-grid"),
    ).toHaveCount(fixture.recipes.length);
    await expect(
      page.getByRole("navigation", { name: /pagination/i }),
    ).toHaveCount(0);
    await page.screenshot({
      path: path.join(
        SCREENSHOT_DIRECTORY,
        `profession-detail-${viewport.name}.png`,
      ),
      fullPage: true,
    });
  }

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(professionPath);
  const recipeCards = page.locator(".recipe-output-card--profession-grid");
  await expect(recipeCards).toHaveCount(fixture.recipes.length);
  await expect(recipeCards.locator("img").first()).toHaveCSS(
    "image-rendering",
    "pixelated",
  );

  const firstRecipe = fixture.recipes[0];
  const recipeLink = page.locator(`a[href="/recipes/${firstRecipe.slug}"]`);
  await expect(recipeLink).toHaveCount(1);
  await expect(recipeLink).toHaveAttribute(
    "aria-label",
    `${firstRecipe.name}, produces \u00d7${firstRecipe.resultQuantityMin}\u2013${firstRecipe.resultQuantityMax} ${firstRecipe.result.name}, category ${fixture.outputCategory.name}, ${fixture.profession.name} level ${firstRecipe.requiredLevel}`,
  );
  await expect(
    page.locator(`a[href="/items/${firstRecipe.result.slug}"]`).first(),
  ).toHaveAttribute(
    "aria-label",
    `View resulting Item: ${firstRecipe.result.name}`,
  );
  await expect(
    page
      .locator(`a[href="/items/${firstRecipe.ingredients[0].slug}"]`)
      .first(),
  ).toHaveAttribute(
    "aria-label",
    `${firstRecipe.ingredients[0].name}, required quantity \u00d7${firstRecipe.ingredients[0].quantity}`,
  );
  await expect(
    page.locator(".profession-detail-chip").filter({ hasText: "Recipes:" }),
  ).toContainText(String(fixture.recipes.length));

  const moreIngredients = page
    .getByRole("button", { name: /Show \d+ more ingredients/ })
    .first();
  await moreIngredients.click();
  await expect(page.getByText("RECIPE INGREDIENTS", { exact: true })).toBeVisible();

  const listButton = page.getByRole("button", { name: "List", exact: true });
  await listButton.click();
  await expect(listButton).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".profession-recipe-list")).toBeVisible();

  const revealButton = page.getByRole("button", {
    name: "Recipes",
    exact: true,
  });
  await revealButton.click();
  await expect(page.locator("#profession-recipes-panel")).toHaveCount(0);
  await revealButton.click();
  await expect(page.locator("#profession-recipes-panel")).toBeVisible();

  await recipeLink.focus();
  await expect(recipeLink).toBeFocused();
});

test("zero-Recipe Profession hides its optional directory", async ({ page }) => {
  for (const viewport of [
    { name: "1920x1080", width: 1920, height: 1080 },
    { name: "mobile-390x844", width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/professions/foraging");
    await expectNoHorizontalOverflow(page);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Foraging",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.locator(".profession-detail-chip").filter({ hasText: "Recipes:" }),
    ).toContainText("0");
    await expect(page.locator(".profession-recipes-section")).toHaveCount(0);
    await page.screenshot({
      path: path.join(
        SCREENSHOT_DIRECTORY,
        `profession-zero-recipes-${viewport.name}.png`,
      ),
      fullPage: true,
    });
  }
});
