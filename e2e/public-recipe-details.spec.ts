import { expect, test, type Locator } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  createE2ePublicRecipeDetailFixture,
  deleteE2ePublicRecipeDetailFixture,
  readE2ePublicRecipeDetailFixtureState,
} from "./helpers/database-cleanup";
import { readValidatedProfessionSpriteBytes } from "./helpers/profession-sprite-fixtures";
import { requireSiteVisibility } from "./helpers/site-visibility";

// Anonymous public browsing is only reachable under PUBLIC visibility, so
// this spec establishes it rather than inheriting whatever mode the
// previously-run spec happened to leave behind.
requireSiteVisibility("PUBLIC");

const PROFESSION_SPRITE_DIRECTORY = path.join(
  __dirname,
  "fixtures",
  "profession-sprites"
);
const SCREENSHOT_DIRECTORY = path.join(
  process.cwd(),
  "test-results",
  "recipe-detail-visuals"
);

let fixture: Awaited<ReturnType<typeof createE2ePublicRecipeDetailFixture>>;
let pageErrors: string[] = [];

async function expectSquare(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(Math.abs((box?.width ?? 0) - (box?.height ?? 0))).toBeLessThanOrEqual(1);
}

async function expectYieldOverlap(
  stage: Locator,
  yieldBadge: Locator
) {
  const stageBox = await stage.boundingBox();
  const badgeBox = await yieldBadge.boundingBox();
  expect(stageBox).not.toBeNull();
  expect(badgeBox).not.toBeNull();
  // Bottom-right of the result image: badge center sits right of the
  // stage's center and overhangs the stage's bottom edge.
  expect(badgeBox!.x + badgeBox!.width / 2).toBeGreaterThan(
    stageBox!.x + stageBox!.width / 2
  );
  expect(badgeBox!.y).toBeLessThan(stageBox!.y + stageBox!.height);
  expect(badgeBox!.y + badgeBox!.height).toBeGreaterThan(
    stageBox!.y + stageBox!.height
  );
}

test.beforeAll(async () => {
  fs.mkdirSync(SCREENSHOT_DIRECTORY, { recursive: true });
  const spriteBytes = readValidatedProfessionSpriteBytes(
    PROFESSION_SPRITE_DIRECTORY
  );
  fixture = await createE2ePublicRecipeDetailFixture(
    spriteBytes.kilnkeeperCrucible,
    [spriteBytes.restorativePrimer, spriteBytes.captureWeave]
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
  await deleteE2ePublicRecipeDetailFixture();
  expect(await readE2ePublicRecipeDetailFixtureState()).toEqual({
    items: 0,
    recipes: 0,
    recipeIngredients: 0,
    storageObjects: 0,
  });
});

test("populated Recipe uses the shared detail composition and real relationships", async ({
  page,
}) => {
  await page.goto(`/recipes/${fixture.recipe.slug}`);

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: fixture.recipe.name,
      exact: true,
    })
  ).toBeVisible();

  const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
  await expect(
    breadcrumb.getByRole("link", { name: "Home", exact: true })
  ).toHaveAttribute("href", "/");
  await expect(
    breadcrumb.getByRole("link", { name: "Recipes", exact: true })
  ).toHaveAttribute("href", "/recipes");
  await expect(
    breadcrumb.getByText(fixture.recipe.name, { exact: true })
  ).toHaveAttribute("aria-current", "page");

  await expect(page.getByText("Smithing", { exact: true }).first()).toBeVisible();
  await expect(page.locator(".recipe-hero-yield")).toContainText("Yields");
  await expect(page.locator(".recipe-hero-yield")).toContainText("2–4");

  const heroImage = page.getByRole("img", {
    name: `Image of ${fixture.recipe.name}`,
    exact: true,
  });
  await expect(heroImage).toHaveCount(1);
  await expect(heroImage).toHaveCSS("image-rendering", "pixelated");
  await expect(page.locator(".public-sprite-stage--hero")).toHaveCount(1);

  const atmosphere = page.locator(".resource-atmosphere--recipe");
  expect(
    await atmosphere.evaluate(
      (element) => getComputedStyle(element, "::before").backgroundImage
    )
  ).toContain("radial-gradient");
  await expect(page.locator(".resource-atmosphere--item")).toHaveCount(0);
  await atmosphere.evaluate((element) => {
    (element as HTMLElement).style.setProperty(
      "--resource-atmosphere-image",
      "none"
    );
  });
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: fixture.recipe.name,
      exact: true,
    })
  ).toBeVisible();
  await atmosphere.evaluate((element) => {
    (element as HTMLElement).style.removeProperty(
      "--resource-atmosphere-image"
    );
  });

  await expect(
    page.getByRole("heading", { level: 2, name: "Ingredients", exact: true })
  ).toBeVisible();
  const ingredientRows = page.locator(".recipe-ingredient-row");
  await expect(ingredientRows).toHaveCount(4);
  await expect(ingredientRows.first()).toHaveJSProperty("tagName", "A");
  await expect(
    ingredientRows.locator(".item-recipe-affordance")
  ).toHaveCount(0);
  const picturedIngredient = ingredientRows.filter({
    hasText: fixture.picturedIngredientName,
  });
  await expect(picturedIngredient).toHaveAttribute(
    "href",
    "/items/test-e2e-public-item-detail"
  );
  await expect(picturedIngredient).toContainText("× 2");
  await expect(
    picturedIngredient.getByRole("img", {
      name: `Image of ${fixture.picturedIngredientName}`,
    })
  ).toHaveCSS("image-rendering", "pixelated");
  await picturedIngredient.focus();
  await expect(picturedIngredient).toBeFocused();
  await expect(picturedIngredient).not.toHaveCSS("outline-style", "none");
  const fallbackIngredient = ingredientRows.filter({
    hasText: "Test E2E Tempering Dust",
  });
  await expect(
    fallbackIngredient.locator(".public-sprite-stage--empty")
  ).toHaveCount(1);
  await expect(fallbackIngredient.locator("img")).toHaveCount(0);

  const resultRow = page.locator(".recipe-result-row");
  await expect(resultRow).toHaveJSProperty("tagName", "A");
  await expect(resultRow).toHaveAttribute("href", `/items/${fixture.result.slug}`);
  await expect(resultRow).toContainText(fixture.result.name);
  await expect(resultRow).toContainText("Produces × 2–4");
  const resultStage = resultRow.locator(".public-sprite-stage--card");
  const resultYield = resultRow.locator(".recipe-result-yield");
  await expect(resultStage).toHaveCount(1);
  await expect(resultYield).toHaveText("× 2–4");
  await expect(resultYield).toHaveAttribute("aria-hidden", "true");
  await expect(
    resultRow.getByRole("img", {
      name: `Image of ${fixture.result.name}`,
      exact: true,
    })
  ).toHaveCSS("image-rendering", "pixelated");
  await expectSquare(resultStage);
  await expectYieldOverlap(resultStage, resultYield);
  await expect(resultRow.locator(".item-recipe-affordance")).toHaveCount(0);
  const resultRowBox = await resultRow.boundingBox();
  const resultCopyBox = await resultRow.locator(".item-recipe-copy").boundingBox();
  expect(resultRowBox).not.toBeNull();
  expect(resultCopyBox).not.toBeNull();
  expect(resultCopyBox!.x + resultCopyBox!.width).toBeGreaterThan(
    resultRowBox!.x + resultRowBox!.width - 12
  );
  await resultRow.focus();
  await expect(resultRow).toBeFocused();
  await expect(resultRow).not.toHaveCSS("outline-style", "none");
  await resultRow.click();
  await expect(page).toHaveURL(`/items/${fixture.result.slug}`);
  await page.goBack();
  await expect(page.locator(".recipe-result-row")).toBeVisible();

  await expect(
    page.getByRole("heading", {
      level: 2,
      name: "Recipe details",
      exact: true,
    })
  ).toHaveCount(0);
  // The handoff moves Profession, its optional level, and EXP from the
  // removed fact rail into factual hero chips.
  await expect(page.getByText("Required class", { exact: true })).toHaveCount(
    0
  );
  await expect(
    page.getByText("Required profession level", { exact: true })
  ).toHaveCount(0);
  await expect(page.getByText("25", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Profession: Smithing", exact: true })
  ).toHaveAttribute("href", "/professions/smithing");
  await expect(page.getByText("+10 EXP", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: "Verification",
      exact: true,
    })
  ).toBeVisible();
  await expect(page.getByText("Verified", { exact: true })).toBeVisible();
  await expect(page.getByText("Quick Links", { exact: true })).toHaveCount(0);
  for (const speculative of [
    "Required level",
    "Crafting time",
    "Success chance",
    "Energy cost",
    "Recipe price",
  ]) {
    await expect(page.getByText(speculative, { exact: false })).toHaveCount(0);
  }

  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 2560, height: 1440 },
    { width: 3440, height: 1440 },
  ]) {
    await page.setViewportSize(viewport);
    await page.reload();
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
    );
    expect(overflow).toBe(false);
    await page.screenshot({
      path: path.join(
        SCREENSHOT_DIRECTORY,
        `recipe-populated-${viewport.width}x${viewport.height}.png`
      ),
      fullPage: true,
    });
  }

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.reload();
  const ingredientsPanel = page.locator(".recipe-ingredients-panel");
  const resultPanel = page.locator(".recipe-result-panel");
  const ingredientsBox = await ingredientsPanel.boundingBox();
  const resultBox = await resultPanel.boundingBox();
  expect(ingredientsBox).not.toBeNull();
  expect(resultBox).not.toBeNull();
  expect(resultBox!.y).toBeGreaterThan(
    ingredientsBox!.y + ingredientsBox!.height
  );
  expect(resultBox!.width).toBeLessThanOrEqual(520);
  await page.screenshot({
    path: path.join(
      SCREENSHOT_DIRECTORY,
      "recipe-several-ingredients-1920x1080.png"
    ),
    fullPage: true,
  });
  await page.locator(".recipe-result-panel").screenshot({
    path: path.join(
      SCREENSHOT_DIRECTORY,
      "recipe-genuine-result-close.png"
    ),
  });
  await page.locator(".recipe-result-row").screenshot({
    path: path.join(
      SCREENSHOT_DIRECTORY,
      "recipe-crafted-result-arrow-removed-close.png"
    ),
  });
  await page.locator(".recipe-ingredient-row").first().screenshot({
    path: path.join(
      SCREENSHOT_DIRECTORY,
      "recipe-ingredient-arrow-removed-close.png"
    ),
  });

  await page.setViewportSize({ width: 1000, height: 1000 });
  await page.reload();
  const intermediateIngredients = await page
    .locator(".recipe-ingredients-panel")
    .boundingBox();
  const intermediateResult = await page
    .locator(".recipe-result-panel")
    .boundingBox();
  expect(intermediateIngredients).not.toBeNull();
  expect(intermediateResult).not.toBeNull();
  expect(intermediateResult!.y).toBeGreaterThan(
    intermediateIngredients!.y + intermediateIngredients!.height
  );
  await page.screenshot({
    path: path.join(
      SCREENSHOT_DIRECTORY,
      "recipe-populated-intermediate-1000x1000.png"
    ),
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
    )
  ).toBe(false);
  const mobileIngredients = await page
    .locator(".recipe-ingredients-panel")
    .boundingBox();
  const mobileResult = await page.locator(".recipe-result-panel").boundingBox();
  expect(mobileIngredients).not.toBeNull();
  expect(mobileResult).not.toBeNull();
  expect(mobileResult!.y).toBeGreaterThan(
    mobileIngredients!.y + mobileIngredients!.height
  );
  await expectSquare(page.locator(".recipe-result-row .public-sprite-stage--card"));
  await expectYieldOverlap(
    page.locator(".recipe-result-row .public-sprite-stage--card"),
    page.locator(".recipe-result-yield")
  );
  await page.screenshot({
    path: path.join(
      SCREENSHOT_DIRECTORY,
      "recipe-populated-mobile-390x844.png"
    ),
    fullPage: true,
  });
});

test("sparse and no-image Recipes preserve hide-empty behavior", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/recipes/charcoal");
  await expect(
    page.getByRole("heading", { level: 1, name: "Charcoal", exact: true })
  ).toBeVisible();
  await expect(
    page.locator(".item-sidebar-panel").getByText("Profession", { exact: true })
  ).toHaveCount(0);
  // A Recipe without a Profession has no profession-level requirement;
  // its required EXP reward still renders independently.
  await expect(page.getByText("Required class", { exact: true })).toHaveCount(
    0
  );
  await expect(
    page.getByText("Required profession level", { exact: true })
  ).toHaveCount(0);
  await expect(page.getByText("+5 EXP", { exact: true })).toBeVisible();
  await expect(page.locator(".recipe-ingredient-row")).toHaveCount(1);
  await expect(page.locator(".public-sprite-stage--hero")).toContainText(
    "No image available"
  );
  const sparseResultStage = page.locator(
    ".recipe-result-row .public-sprite-stage--card"
  );
  const sparseYield = page.locator(".recipe-result-yield");
  await expect(sparseResultStage).toContainText("No image available");
  await expect(sparseResultStage.locator(".public-sprite-fallback")).toHaveAttribute(
    "aria-label",
    "No image available"
  );
  await expectSquare(sparseResultStage);
  await expectYieldOverlap(sparseResultStage, sparseYield);
  await page.screenshot({
    path: path.join(SCREENSHOT_DIRECTORY, "recipe-sparse-1920x1080.png"),
    fullPage: true,
  });
  await page.locator(".recipe-result-panel").screenshot({
    path: path.join(SCREENSHOT_DIRECTORY, "recipe-no-image-result-close.png"),
  });

  await page.goto("/recipes/iron-sword");
  await expect(page.locator(".public-sprite-stage--hero")).toContainText(
    "No image available"
  );
  await expect(page.getByRole("img", { name: "Image of Iron Sword" })).toHaveCount(
    0
  );
  await page.screenshot({
    path: path.join(SCREENSHOT_DIRECTORY, "recipe-no-image-1920x1080.png"),
    fullPage: true,
  });
});
