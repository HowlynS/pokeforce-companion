import { expect, test, type Locator, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  createE2ePublicProfessionDetailFixture,
  deleteE2ePublicProfessionDetailFixture,
  readE2ePublicProfessionDetailFixtureState,
} from "./helpers/database-cleanup";
import { readValidatedProfessionSpriteBytes } from "./helpers/profession-sprite-fixtures";

const SPRITE_DIRECTORY = path.join(
  __dirname,
  "fixtures",
  "profession-sprites"
);
const SCREENSHOT_DIRECTORY = path.join(
  process.cwd(),
  "test-results",
  "resource-responsibility-visuals"
);
const VIEWPORTS = [
  { name: "1920x1080", width: 1920, height: 1080, columns: 3 },
  { name: "2560x1440", width: 2560, height: 1440, columns: 3 },
  { name: "3440x1440", width: 3440, height: 1440, columns: 3 },
  { name: "intermediate-1000x1100", width: 1000, height: 1100, columns: 2 },
  { name: "mobile-390x844", width: 390, height: 844, columns: 1 },
] as const;

let fixture: Awaited<
  ReturnType<typeof createE2ePublicProfessionDetailFixture>
>;
let pageErrors: string[] = [];

test.beforeAll(async () => {
  fs.mkdirSync(SCREENSHOT_DIRECTORY, { recursive: true });
  const sprites = readValidatedProfessionSpriteBytes(SPRITE_DIRECTORY);
  fixture = await createE2ePublicProfessionDetailFixture(
    sprites.kilnkeeperCrucible,
    sprites
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
    .poll(async () => {
      const metrics = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        widest: Array.from(document.querySelectorAll<HTMLElement>("body *"))
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              className: element.className,
              right: Math.round(rect.right),
              width: Math.round(rect.width),
            };
          })
          .filter((entry) => entry.right > document.documentElement.clientWidth)
          .sort((a, b) => b.right - a.right)
          .slice(0, 3),
      }));
      return metrics.scrollWidth <= metrics.clientWidth ? true : metrics;
    })
    .toBe(true);
}

async function expectRecipeColumns(page: Page, count: number) {
  await expect
    .poll(() =>
      page.locator(".recipe-output-grid").evaluate((element) =>
        getComputedStyle(element)
          .gridTemplateColumns.split(" ")
          .filter(Boolean).length
      )
    )
    .toBe(count);
}

async function expectRealSpritesDominate(
  scope: Locator,
  imageSelector: string,
  fallbackSelector: string
) {
  const realImageCount = await scope.locator(imageSelector).count();
  const fallbackCount = await scope.locator(fallbackSelector).count();
  expect(realImageCount).toBeGreaterThan(fallbackCount);
  expect(fallbackCount).toBeGreaterThanOrEqual(1);
}

test("Recipes index is the canonical Profession-filtered catalogue", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/recipes");

  const filters = page.getByRole("navigation", {
    name: "Filter Recipes by Profession",
  });
  await expect(
    filters.getByRole("link", { name: "All", exact: true })
  ).toHaveAttribute("aria-current", "page");
  await expect(
    filters.getByRole("link", {
      name: fixture.profession.name,
      exact: true,
    })
  ).toHaveAttribute(
    "href",
    `/recipes?profession=${fixture.profession.slug}`
  );
  await expect(
    filters.getByRole("link", {
      name: fixture.sparseProfession.name,
      exact: true,
    })
  ).toBeVisible();
  const professionFilter = filters.getByRole("link", {
    name: fixture.profession.name,
    exact: true,
  });
  await professionFilter.focus();
  await expect(professionFilter).not.toHaveCSS("outline-style", "none");

  const allCards = page.locator(".recipe-output-card");
  await expect(allCards).toHaveCount(12);
  await expect(
    allCards.filter({ hasText: fixture.consumerOnlyRecipe.name })
  ).toHaveCount(1);
  await expect(
    allCards.filter({ hasText: fixture.recipes[0].name })
  ).toHaveCount(1);
  await expect(
    allCards.filter({ hasText: fixture.sparseRecipe.name })
  ).toHaveCount(1);
  await expectRealSpritesDominate(
    allCards,
    ".recipe-output-image-stage img",
    ".recipe-output-image-stage .public-sprite-stage--empty"
  );
  await expectRecipeColumns(page, 3);
  await expectNoHorizontalOverflow(page);

  const denseRecipe = fixture.recipes.find((recipe) =>
    recipe.name.includes("Dense Ninefold")
  );
  if (!denseRecipe) {
    throw new Error("Expected the dense Recipe fixture");
  }
  const denseCard = allCards.filter({ hasText: denseRecipe.name });
  await expect(
    denseCard.getByRole("link", {
      name: `${denseRecipe.name}, produces ×${denseRecipe.resultQuantityMin} ${denseRecipe.result.name}, category ${fixture.outputCategory.name}, ${fixture.profession.name} level ${denseRecipe.requiredLevel}`,
      exact: true,
    })
  ).toBeVisible();
  await expect(
    denseCard.getByText(
      `${fixture.profession.name} · Level ${denseRecipe.requiredLevel}`,
      { exact: true }
    )
  ).toBeVisible();
  await denseCard.screenshot({
    path: path.join(
      SCREENSHOT_DIRECTORY,
      "recipe-card-profession-level-close.png"
    ),
  });
  const visibleIngredients = denseCard.locator(".recipe-output-ingredient");
  await expect(visibleIngredients).toHaveCount(4);

  const thirdIngredient = visibleIngredients.nth(2);
  const thirdTooltip = thirdIngredient.getByRole("tooltip");
  await thirdIngredient.hover();
  await expect(thirdTooltip).toBeVisible();
  const [thirdIngredientBox, thirdTooltipBox] = await Promise.all([
    thirdIngredient.boundingBox(),
    thirdTooltip.boundingBox(),
  ]);
  expect(thirdIngredientBox).not.toBeNull();
  expect(thirdTooltipBox).not.toBeNull();
  expect(
    Math.abs(
      thirdTooltipBox!.x +
        thirdTooltipBox!.width / 2 -
        (thirdIngredientBox!.x + thirdIngredientBox!.width / 2)
    )
  ).toBeLessThanOrEqual(1);
  expect(thirdTooltipBox!.y).toBeGreaterThanOrEqual(
    thirdIngredientBox!.y + thirdIngredientBox!.height
  );

  const secondIngredient = visibleIngredients.nth(1);
  const secondTooltip = secondIngredient.getByRole("tooltip");
  await secondIngredient.focus();
  await expect(secondIngredient).toBeFocused();
  await expect(secondTooltip).toBeVisible();
  const [secondIngredientBox, secondTooltipBox] = await Promise.all([
    secondIngredient.boundingBox(),
    secondTooltip.boundingBox(),
  ]);
  expect(secondIngredientBox).not.toBeNull();
  expect(secondTooltipBox).not.toBeNull();
  expect(
    Math.abs(
      secondTooltipBox!.x +
        secondTooltipBox!.width / 2 -
        (secondIngredientBox!.x + secondIngredientBox!.width / 2)
    )
  ).toBeLessThanOrEqual(1);
  await expectNoHorizontalOverflow(page);

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    await page.goto("/recipes");
    await expectRecipeColumns(page, viewport.columns);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({
      path: path.join(
        SCREENSHOT_DIRECTORY,
        `recipes-all-${viewport.name}.png`
      ),
      fullPage: true,
    });
  }

  const filteredPath = `/recipes?profession=${fixture.profession.slug}`;
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(filteredPath);
  await expect(
    filters.getByRole("link", {
      name: fixture.profession.name,
      exact: true,
    })
  ).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".recipe-output-card")).toHaveCount(12);
  await expect(
    page.getByText(fixture.sparseRecipe.name, { exact: true })
  ).toHaveCount(0);
  await expect(
    page.getByText(fixture.consumerOnlyRecipe.name, { exact: true })
  ).toHaveCount(0);

  const pagination = page.getByRole("navigation", {
    name: "Recipes pagination",
  });
  await expect(pagination).toContainText("Page 1 of 2");
  await expect(pagination.getByRole("link", { name: "Next" })).toHaveAttribute(
    "href",
    `${filteredPath}&page=2`
  );
  await page.screenshot({
    path: path.join(SCREENSHOT_DIRECTORY, "recipes-filtered-profession.png"),
    fullPage: true,
  });

  await pagination.getByRole("link", { name: "Next" }).click();
  await expect(page).toHaveURL(`${filteredPath}&page=2`);
  await expect(page.locator(".recipe-output-card")).toHaveCount(1);
  await expect(
    page
      .getByRole("navigation", { name: "Recipes pagination" })
      .getByRole("link", { name: "Previous" })
  ).toHaveAttribute("href", filteredPath);
  await expect(
    filters.getByRole("link", {
      name: fixture.sparseProfession.name,
      exact: true,
    })
  ).not.toHaveAttribute("href", /page=/);
  await page.screenshot({
    path: path.join(SCREENSHOT_DIRECTORY, "recipes-filtered-page-2.png"),
    fullPage: true,
  });

  await page.goto("/recipes?profession=not-a-profession&page=9");
  await expect(page).toHaveURL("/recipes");
  await expect(
    page
      .getByRole("navigation", { name: "Filter Recipes by Profession" })
      .getByRole("link", { name: "All", exact: true })
  ).toHaveAttribute("aria-current", "page");
});

test("Recipes index exposes only Profession filtering and drops stale Class queries", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/recipes");
  await expect(
    page.getByRole("navigation", { name: "Filter Recipes by Profession" })
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Filter Recipes by Class" })
  ).toHaveCount(0);
  await expect(page.getByText("Required class", { exact: true })).toHaveCount(
    0
  );
  // A stale Class parameter is removed while the supported Profession
  // filter remains intact.
  await page.goto("/recipes?profession=smithing&class=not-a-class");
  await expect(page).toHaveURL("/recipes?profession=smithing");

  // A stale Class parameter by itself canonicalizes to the unfiltered
  // catalogue.
  await page.goto("/recipes?class=not-a-class");
  await expect(page).toHaveURL("/recipes");
});

test("Items index owns Category browsing and Category detail stays contextual", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/items");

  const filters = page.getByRole("navigation", {
    name: "Filter Items by Category",
  });
  await expect(
    filters.getByRole("link", { name: "All", exact: true })
  ).toHaveAttribute("aria-current", "page");
  const scenicBackground = page.locator(
    ".public-scenic-background--catalogue"
  );
  await expect(scenicBackground).toHaveCount(1);
  await expect(scenicBackground).toHaveCSS(
    "background-image",
    /merchants-codex-coastal-overlook\.png/
  );
  const toolsFilter = filters.getByRole("link", {
    name: fixture.outputCategory.name,
    exact: true,
  });
  await expect(toolsFilter).toHaveAttribute(
    "href",
    `/items?category=${fixture.outputCategory.slug}`
  );
  await toolsFilter.focus();
  await expect(toolsFilter).not.toHaveCSS("outline-style", "none");
  await expectRealSpritesDominate(
    page.locator(".item-index-catalogue"),
    ".public-sprite-stage--card img",
    ".public-sprite-stage--card.public-sprite-stage--empty"
  );
  const firstItemCard = page.locator(".item-index-catalogue .interactive-card").first();
  const firstItemTitle = firstItemCard.getByRole("heading");
  await expect(firstItemTitle).toBeVisible();
  await expect(firstItemTitle).toHaveCSS("font-size", "20px");
  const firstItemCategory = firstItemCard.locator(".item-index-card-category");
  await expect(firstItemCategory).toHaveText(fixture.outputCategory.name);
  await expect(firstItemCategory).toHaveCSS("font-size", "14px");
  await expect(firstItemCategory).toHaveCSS("font-style", "normal");
  expect(
    await firstItemTitle.evaluate(
      (title, category) =>
        Number.parseFloat(getComputedStyle(title).fontSize) >
        Number.parseFloat(getComputedStyle(category as Element).fontSize),
      await firstItemCategory.elementHandle()
    )
  ).toBe(true);
  await expect(
    page.locator(".item-index-catalogue").getByText("Category:", {
      exact: false,
    })
  ).toHaveCount(0);
  await expect(
    page.locator(".item-index-catalogue").getByText("Tradeable:", {
      exact: false,
    })
  ).toHaveCount(0);
  await expect(
    page
      .locator(".item-index-catalogue")
      .getByText(/Description:|Base value:/i)
  ).toHaveCount(0);
  const genuineStage = firstItemCard.locator(".public-sprite-stage--card");
  const fallbackCard = page
    .locator(".item-index-catalogue .interactive-card")
    .filter({ has: page.getByText("No image available", { exact: true }) });
  const fallbackStage = fallbackCard.locator(".public-sprite-stage--card");
  const stageGeometry = await Promise.all(
    [genuineStage, fallbackStage].map(async (stage) => {
      const cardBox = await stage.locator("xpath=ancestor::a").boundingBox();
      const stageBox = await stage.boundingBox();
      if (!cardBox || !stageBox) {
        throw new Error("Expected Item card and image stage geometry");
      }
      return {
        width: stageBox.width,
        height: stageBox.height,
        centerOffset:
          stageBox.x + stageBox.width / 2 - (cardBox.x + cardBox.width / 2),
      };
    })
  );
  expect(stageGeometry[0]).toMatchObject({
    width: stageGeometry[1].width,
    height: stageGeometry[1].height,
  });
  for (const geometry of stageGeometry) {
    expect(Math.abs(geometry.centerOffset)).toBeLessThanOrEqual(1);
  }
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: path.join(SCREENSHOT_DIRECTORY, "items-all-1920x1080.png"),
    fullPage: true,
  });
  await firstItemCard.screenshot({
    path: path.join(SCREENSHOT_DIRECTORY, "item-genuine-image-card-close.png"),
  });
  await fallbackCard.screenshot({
    path: path.join(SCREENSHOT_DIRECTORY, "item-no-image-card-close.png"),
  });
  const longTitleCard = page
    .locator(".item-index-catalogue .interactive-card")
    .filter({ hasText: "Field Surveyor's Dusk Gauge" });
  await expect(longTitleCard.getByRole("heading")).toHaveCSS(
    "white-space",
    "normal"
  );
  const longTitleGeometry = await longTitleCard.evaluate((card) => {
    const heading = card.querySelector("h3");
    if (!heading) {
      throw new Error("Expected long-title Item card heading");
    }
    return {
      headingWithinCard:
        heading.getBoundingClientRect().right <=
        card.getBoundingClientRect().right,
      wraps: heading.getBoundingClientRect().height >
        Number.parseFloat(getComputedStyle(heading).lineHeight) + 1,
    };
  });
  expect(longTitleGeometry).toEqual({
    headingWithinCard: true,
    wraps: true,
  });
  await longTitleCard.screenshot({
    path: path.join(SCREENSHOT_DIRECTORY, "item-long-title-card-close.png"),
  });

  await toolsFilter.click();
  const filteredPath = `/items?category=${fixture.outputCategory.slug}`;
  await expect(page).toHaveURL(filteredPath);
  await expect(
    page
      .getByRole("navigation", { name: "Filter Items by Category" })
      .getByRole("link", {
        name: fixture.outputCategory.name,
        exact: true,
      })
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByText(fixture.consumerOnlyRecipe.result.name, { exact: true })
  ).toHaveCount(0);
  const filteredCards = page.locator(
    ".item-index-catalogue .interactive-card"
  );
  await expect(filteredCards).toHaveCount(12);
  await expect(
    filteredCards.locator(".item-index-card-category")
  ).toHaveText(Array(12).fill(fixture.outputCategory.name));
  await expect(
    page.locator(".item-index-catalogue").getByText(/Category:|Tradeable:/)
  ).toHaveCount(0);
  const pagination = page.getByRole("navigation", {
    name: "Items pagination",
  });
  await expect(pagination.getByRole("link", { name: "Next" })).toHaveAttribute(
    "href",
    `${filteredPath}&page=2`
  );
  await page.screenshot({
    path: path.join(SCREENSHOT_DIRECTORY, "items-filtered-tools.png"),
    fullPage: true,
  });

  await pagination.getByRole("link", { name: "Next" }).click();
  await expect(page).toHaveURL(`${filteredPath}&page=2`);
  await expect(
    page
      .getByRole("navigation", { name: "Items pagination" })
      .getByRole("link", { name: "Previous" })
  ).toHaveAttribute("href", filteredPath);

  await page.goto("/items?category=not-a-category&page=4");
  await expect(page).toHaveURL("/items");

  await page.goto(`/categories/${fixture.outputCategory.slug}`);
  await expect(page.getByText("Items: 25", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: `Browse ${fixture.outputCategory.name} items`,
      exact: true,
    })
  ).toHaveAttribute("href", filteredPath);
  await expect(page.locator(".recipe-output-card")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 2, name: "Items", exact: true })
  ).toHaveCount(0);
  await expect(page.locator(".interactive-card")).toHaveCount(0);
  await page.screenshot({
    path: path.join(SCREENSHOT_DIRECTORY, "category-populated-summary.png"),
    fullPage: true,
  });

  await page.goto(`/categories/${fixture.emptyCategory.slug}`);
  await expect(page.getByText("Items: 0", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Browse .* items/ })).toHaveCount(
    0
  );
  await expect(page.locator(".recipe-output-card")).toHaveCount(0);
  await page.screenshot({
    path: path.join(SCREENSHOT_DIRECTORY, "category-empty-summary.png"),
    fullPage: true,
  });

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    await page.goto(filteredPath);
    await expectNoHorizontalOverflow(page);
    expect(
      await scenicBackground.evaluate(
        (element) => getComputedStyle(element).backgroundPosition
      )
    ).toContain(viewport.width === 390 ? "82%" : "55%");
    await page.screenshot({
      path: path.join(
        SCREENSHOT_DIRECTORY,
        `items-filtered-${viewport.name}.png`
      ),
      fullPage: true,
    });
  }
});
