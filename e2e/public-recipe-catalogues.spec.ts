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
  { name: "1920x1080", width: 1920, height: 1080, columns: 7 },
  { name: "2560x1440", width: 2560, height: 1440, columns: 7 },
  { name: "3440x1440", width: 3440, height: 1440, columns: 7 },
  { name: "intermediate-1000x1100", width: 1000, height: 1100, columns: 4 },
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

  // The Claude Design redesign (Slice 6) replaced the always-visible
  // "Filter Recipes by Profession" nav landmark with a Filter button +
  // multi-select popover (directory-filter-popover.tsx, the same
  // component already used by the Items directory in Slice 4) —
  // unfiltered is simply "no checkboxes checked", and filtering is a
  // real GET form submit rather than a per-profession link.
  const filterTrigger = page.getByRole("button", { name: "Filter", exact: false });
  await expect(filterTrigger).toBeVisible();
  await filterTrigger.focus();
  await expect(filterTrigger).not.toHaveCSS("outline-style", "none");
  await filterTrigger.click();
  const professionCheckbox = page.getByRole("checkbox", {
    name: fixture.profession.name,
    exact: true,
  });
  await expect(professionCheckbox).toBeVisible();
  await expect(
    page.getByRole("checkbox", {
      name: fixture.sparseProfession.name,
      exact: true,
    })
  ).toBeVisible();

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
  await expectRecipeColumns(page, 7);
  await expectNoHorizontalOverflow(page);
  const gridGeometry = await allCards.first().evaluate((card) => {
    const cardRect = card.getBoundingClientRect();
    const stage = card.querySelector<HTMLElement>(".recipe-output-image-stage");
    if (!stage) throw new Error("Expected the Recipe result image stage");
    const title = card.querySelector<HTMLElement>(".recipe-output-copy > strong");
    if (!title) throw new Error("Expected the Recipe card title");
    const footer = card.querySelector<HTMLElement>(".recipe-output-experience");
    if (!footer) throw new Error("Expected the Recipe card footer");
    const preview = card.querySelector<HTMLElement>(".recipe-output-ingredient");
    const inset = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left - cardRect.left,
        right: cardRect.right - rect.right,
      };
    };
    const stageRect = stage.getBoundingClientRect();
    return {
      card: { width: cardRect.width, height: cardRect.height },
      stage: { width: stageRect.width, height: stageRect.height },
      stageInset: inset(stage),
      titleInset: inset(title),
      footerInset: inset(footer),
      previewWidth: preview?.getBoundingClientRect().width ?? null,
      previewLeft: preview ? inset(preview).left : null,
    };
  });
  expect(gridGeometry.card.width).toBeCloseTo(190, 0);
  expect(gridGeometry.card.height).toBeCloseTo(315, 0);
  expect(gridGeometry.stage.width).toBeCloseTo(164, 0);
  expect(gridGeometry.stage.height).toBeCloseTo(164, 0);

  // One internal horizontal rhythm: the art frame, title, footer and the first
  // Ingredient preview all resolve to the same card content box, and previews
  // keep their full 36px stage instead of shrinking to fit the trigger.
  expect(gridGeometry.stageInset.left).toBeCloseTo(gridGeometry.titleInset.left, 0);
  expect(gridGeometry.stageInset.right).toBeCloseTo(gridGeometry.titleInset.right, 0);
  expect(gridGeometry.footerInset.left).toBeCloseTo(gridGeometry.titleInset.left, 0);
  expect(gridGeometry.footerInset.right).toBeCloseTo(gridGeometry.titleInset.right, 0);
  if (gridGeometry.previewWidth !== null) {
    expect(gridGeometry.previewWidth).toBeCloseTo(36, 0);
    expect(gridGeometry.previewLeft).toBeCloseTo(gridGeometry.titleInset.left, 0);
  }

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
    denseCard.getByText(fixture.profession.name, { exact: true })
  ).toBeVisible();
  await expect(
    denseCard.getByText(`Lvl ${denseRecipe.requiredLevel}`, { exact: true })
  ).toBeVisible();
  await denseCard.screenshot({
    path: path.join(
      SCREENSHOT_DIRECTORY,
      "recipe-card-profession-level-close.png"
    ),
  });
  const visibleIngredients = denseCard.locator(".recipe-output-ingredient");
  await expect(visibleIngredients).toHaveCount(3);
  const quantityBadges = visibleIngredients.locator(
    ".recipe-output-ingredient-quantity-badge"
  );
  await expect(quantityBadges).toHaveCount(3);
  const quantityBadgeGeometry = await quantityBadges.first().evaluate((badge) => {
    const rect = badge.getBoundingClientRect();
    const style = getComputedStyle(badge);
    return {
      width: rect.width,
      height: rect.height,
      fontSize: style.fontSize,
      lineHeight: style.lineHeight,
    };
  });
  expect(quantityBadgeGeometry.width).toBeGreaterThanOrEqual(17);
  expect(quantityBadgeGeometry.height).toBe(17);
  expect(quantityBadgeGeometry.fontSize).toBe("10.5px");
  expect(quantityBadgeGeometry.lineHeight).toBe("15px");

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

  const ingredientDisclosure = denseCard.locator(
    ".recipe-output-ingredient-toggle"
  );
  await expect(ingredientDisclosure).toHaveAttribute(
    "aria-label",
    `Show 6 more ingredients for ${denseRecipe.name}`
  );
  await expect(ingredientDisclosure).toHaveText("");
  const disclosureChevron = ingredientDisclosure.locator(
    ".recipe-output-ingredient-toggle-chevron"
  );
  await expect(disclosureChevron).toBeVisible();
  const collapsedChevronTransform = await disclosureChevron.evaluate(
    (chevron) => getComputedStyle(chevron).transform
  );
  await ingredientDisclosure.click();
  await expect(ingredientDisclosure).toHaveAttribute("aria-expanded", "true");
  await expect(ingredientDisclosure).toHaveAttribute(
    "aria-label",
    `Hide 6 additional ingredients for ${denseRecipe.name}`
  );
  const ingredientPanel = denseCard.locator(
    ".recipe-output-ingredient-panel"
  );
  await expect(ingredientPanel).toBeVisible();
  await expect(
    ingredientPanel.getByText("RECIPE INGREDIENTS", { exact: true })
  ).toBeVisible();
  const panelRows = ingredientPanel.locator(
    ".recipe-output-ingredient-panel-row"
  );
  const orderedIngredients = [...denseRecipe.ingredients].sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  await expect(panelRows).toHaveCount(orderedIngredients.length);
  for (const [index, ingredient] of orderedIngredients.entries()) {
    const row = panelRows.nth(index);
    await expect(row.getByText(ingredient.name, { exact: true })).toBeVisible();
    await expect(
      row.getByText(`×${ingredient.quantity}`, { exact: true })
    ).toBeVisible();
    await expect(row).toHaveAttribute("href", `/items/${ingredient.slug}`);
  }
  const fallbackIngredientIndex = orderedIngredients.findIndex(
    (ingredient) => ingredient.spriteKey === null
  );
  expect(fallbackIngredientIndex).toBeGreaterThanOrEqual(0);
  const fallbackRow = panelRows.nth(fallbackIngredientIndex);
  await expect(
    fallbackRow.locator(".public-sprite-stage--empty")
  ).toContainText("No image");
  await expect(panelRows.last()).toHaveCSS("opacity", "1");
  const panelGeometry = await ingredientPanel.evaluate((panel) => {
    const row = panel.querySelector<HTMLElement>(
      ".recipe-output-ingredient-panel-row"
    );
    const secondRow = panel.querySelectorAll<HTMLElement>(
      ".recipe-output-ingredient-panel-row"
    )[1];
    const image = panel.querySelector<HTMLElement>(
      ".recipe-output-ingredient-panel-image"
    );
    const name = panel.querySelector<HTMLElement>(
      ".recipe-output-ingredient-panel-name"
    );
    const quantity = row?.querySelector<HTMLElement>("strong");
    const card = panel.closest<HTMLElement>(".recipe-output-card");
    if (!row || !secondRow || !image || !name || !quantity || !card) {
      throw new Error("Expected a complete Recipe ingredient panel row");
    }
    const panelRect = panel.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    const imageRect = image.getBoundingClientRect();
    const nameRect = name.getBoundingClientRect();
    const quantityRect = quantity.getBoundingClientRect();
    const panelStyle = getComputedStyle(panel);
    const rowStyle = getComputedStyle(row);
    const nameStyle = getComputedStyle(name);
    const quantityStyle = getComputedStyle(quantity);
    return {
      panelWidth: panelRect.width,
      panelHeight: panelRect.height,
      panelDisplay: panelStyle.display,
      panelGap: panelStyle.gap,
      panelPadding: panelStyle.padding,
      panelRadius: panelStyle.borderRadius,
      panelBorder: panelStyle.border,
      panelShadow: panelStyle.boxShadow,
      panelBoxSizing: panelStyle.boxSizing,
      panelChildCount: panel.children.length,
      rowHeight: rowRect.height,
      rowDisplay: rowStyle.display,
      rowGap: rowStyle.gap,
      rowPadding: rowStyle.padding,
      rowAnimationName: rowStyle.animationName,
      firstRowDelay: rowStyle.animationDelay,
      secondRowDelay: getComputedStyle(secondRow).animationDelay,
      imageWidth: imageRect.width,
      imageHeight: imageRect.height,
      imageCenterDelta: Math.abs(
        imageRect.top + imageRect.height / 2 - (rowRect.top + rowRect.height / 2)
      ),
      nameCenterDelta: Math.abs(
        nameRect.top + nameRect.height / 2 - (rowRect.top + rowRect.height / 2)
      ),
      quantityCenterDelta: Math.abs(
        quantityRect.top + quantityRect.height / 2 -
          (rowRect.top + rowRect.height / 2)
      ),
      nameFontSize: nameStyle.fontSize,
      nameFontWeight: nameStyle.fontWeight,
      nameWhiteSpace: nameStyle.whiteSpace,
      nameOverflow: nameStyle.overflow,
      quantityFontSize: quantityStyle.fontSize,
      quantityFontWeight: quantityStyle.fontWeight,
      cardZIndex: getComputedStyle(card).zIndex,
    };
  });
  expect(panelGeometry.panelWidth).toBeCloseTo(188, 0);
  expect(panelGeometry.panelHeight).toBeGreaterThan(326);
  expect(panelGeometry.panelDisplay).toBe("flex");
  expect(panelGeometry.panelGap).toBe("8px");
  expect(panelGeometry.panelPadding).toBe("10px");
  expect(panelGeometry.panelRadius).toBe("8px");
  expect(panelGeometry.panelBorder).toContain("rgb(58, 53, 40)");
  expect(panelGeometry.panelShadow).not.toBe("none");
  expect(panelGeometry.panelBoxSizing).toBe("content-box");
  expect(panelGeometry.panelChildCount).toBe(orderedIngredients.length + 1);
  expect(panelGeometry.rowHeight).toBeGreaterThanOrEqual(24);
  expect(panelGeometry.rowDisplay).toBe("flex");
  expect(panelGeometry.rowGap).toBe("8px");
  expect(panelGeometry.rowPadding).toBe("0px");
  expect(panelGeometry.rowAnimationName).toBe("cx-item-in");
  expect(panelGeometry.firstRowDelay).toBe("0s");
  expect(panelGeometry.secondRowDelay).toBe("0.03s");
  expect(panelGeometry.imageWidth).toBeCloseTo(24, 0);
  expect(panelGeometry.imageHeight).toBeCloseTo(24, 0);
  expect(panelGeometry.imageCenterDelta).toBeLessThanOrEqual(0.5);
  expect(panelGeometry.nameCenterDelta).toBeLessThanOrEqual(0.5);
  expect(panelGeometry.quantityCenterDelta).toBeLessThanOrEqual(0.5);
  expect(panelGeometry.nameFontSize).toBe("12.5px");
  expect(panelGeometry.nameFontWeight).toBe("400");
  expect(panelGeometry.nameWhiteSpace).toBe("normal");
  expect(panelGeometry.nameOverflow).toBe("visible");
  expect(panelGeometry.quantityFontSize).toBe("12.5px");
  expect(panelGeometry.quantityFontWeight).toBe("700");
  expect(panelGeometry.cardZIndex).toBe("40");
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: path.join(
      SCREENSHOT_DIRECTORY,
      "recipes-ingredient-disclosure-1920x1080.png"
    ),
  });
  await expect
    .poll(() =>
      disclosureChevron.evaluate((chevron) => getComputedStyle(chevron).transform)
    )
    .not.toBe(collapsedChevronTransform);
  await ingredientDisclosure.press("Enter");
  await expect(ingredientDisclosure).toHaveAttribute("aria-expanded", "false");
  await expect(ingredientDisclosure).toHaveAttribute(
    "aria-label",
    `Show 6 more ingredients for ${denseRecipe.name}`
  );
  await expect(ingredientPanel).toHaveClass(/cx-panel-out/);
  await expect(panelRows.first()).toHaveCSS("animation-name", "cx-item-out");
  await expect(denseCard.locator(".recipe-output-ingredient-panel")).toHaveCount(0);

  await ingredientDisclosure.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(ingredientDisclosure).toBeFocused();
  await expect(ingredientDisclosure).not.toHaveCSS("outline-style", "none");
  await ingredientDisclosure.press("Space");
  await expect(ingredientDisclosure).toHaveAttribute("aria-expanded", "true");
  await ingredientDisclosure.press("Space");
  await expect(ingredientDisclosure).toHaveAttribute("aria-expanded", "false");
  await expect(denseCard.locator(".recipe-output-ingredient-panel")).toHaveCount(0);
  await ingredientDisclosure.press("Space");
  await expect(ingredientDisclosure).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("heading", { name: "Recipes", exact: true }).click();
  await expect(denseCard.locator(".recipe-output-ingredient-panel")).toHaveCount(0);
  await expect(denseCard).toHaveCSS("z-index", "auto");

  await page.getByRole("button", { name: "List", exact: true }).click();
  const listHeading = page.locator(".recipe-output-list-heading");
  await expect(listHeading).toBeVisible();
  for (const heading of ["Recipe", "Profession", "EXP", "Ingredients"]) {
    await expect(listHeading.getByText(heading, { exact: true })).toBeVisible();
  }
  const listCards = page.locator(".recipe-output-card--directory-list");
  await expect(listCards).toHaveCount(12);
  const listGeometry = await listCards.first().evaluate((card) => {
    const rect = card.getBoundingClientRect();
    const identity = card.querySelector<HTMLElement>(
      ".recipe-output-list-identity"
    );
    const stage = card.querySelector<HTMLElement>(".recipe-output-image-stage");
    const title = card.querySelector<HTMLElement>(".recipe-output-list-title");
    const profession = card.querySelector<HTMLElement>(
      ".recipe-output-list-profession"
    );
    const experience = card.querySelector<HTMLElement>(
      ".recipe-output-experience"
    );
    const ingredients = card.querySelector<HTMLElement>(
      ".recipe-output-ingredients"
    );
    if (!identity || !stage || !title || !profession || !experience || !ingredients) {
      throw new Error("Expected all Recipe list columns");
    }
    return {
      row: { width: rect.width, height: rect.height },
      identity: identity.getBoundingClientRect().width,
      stage: stage.getBoundingClientRect().width,
      title: title.getBoundingClientRect().width,
      profession: profession.getBoundingClientRect().width,
      experience: experience.getBoundingClientRect().width,
      ingredients: ingredients.getBoundingClientRect().width,
    };
  });
  expect(listGeometry.row.width).toBeCloseTo(1402, 0);
  expect(listGeometry.row.height).toBeCloseTo(64, 0);
  expect(listGeometry.identity).toBeCloseTo(174, 0);
  expect(listGeometry.stage).toBeCloseTo(50, 0);
  expect(listGeometry.title).toBeCloseTo(110, 0);
  expect(listGeometry.profession).toBeCloseTo(80, 0);
  expect(listGeometry.experience).toBeCloseTo(55, 0);
  expect(listGeometry.ingredients).toBeCloseTo(1011, 0);
  const denseListCard = listCards.filter({ hasText: denseRecipe.name });
  const denseListDisclosure = denseListCard.locator(
    ".recipe-output-ingredient-toggle"
  );
  await denseListDisclosure.click();
  const denseListPanel = denseListCard.locator(
    ".recipe-output-ingredient-panel"
  );
  await expect(denseListPanel).toBeVisible();
  await expect(
    denseListPanel.locator(".recipe-output-ingredient-panel-row").last()
  ).toHaveCSS("opacity", "1");
  const listPanelGeometry = await denseListPanel.evaluate((panel) => {
    const rect = panel.getBoundingClientRect();
    const style = getComputedStyle(panel);
    return {
      outerWidth: rect.width,
      styleWidth: style.width,
      top: style.top,
      transformOrigin: style.transformOrigin,
    };
  });
  expect(listPanelGeometry.outerWidth).toBeCloseTo(222, 0);
  expect(listPanelGeometry.styleWidth).toBe("200px");
  expect(listPanelGeometry.top).toBe("50px");
  expect(listPanelGeometry.transformOrigin).toBe("0px 0px");
  await denseListDisclosure.press("Enter");
  await expect(denseListPanel).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  await page.getByRole("button", { name: "Grid", exact: true }).click();
  await expect(page.locator(".recipe-output-card--directory-grid")).toHaveCount(12);

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    await page.goto("/recipes");
    await expectRecipeColumns(page, viewport.columns);
    await expectNoHorizontalOverflow(page);
    await page.waitForTimeout(700);
    await page.screenshot({
      path: path.join(
        SCREENSHOT_DIRECTORY,
        `recipes-all-${viewport.name}.png`
      ),
      fullPage: true,
    });
    await page.getByRole("button", { name: "List", exact: true }).click();
    if (viewport.width > 680) {
      await expect(page.locator(".recipe-output-list-heading")).toBeVisible();
    } else {
      await expect(page.locator(".recipe-output-list-heading")).toBeHidden();
    }
    await expectNoHorizontalOverflow(page);
    await page.screenshot({
      path: path.join(
        SCREENSHOT_DIRECTORY,
        `recipes-list-${viewport.name}.png`
      ),
      fullPage: true,
    });
  }

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/recipes");
  const reducedMotionCard = page.locator(
    ".recipe-output-card--directory-grid"
  ).first();
  await expect(reducedMotionCard).toHaveCSS("animation-name", "none");
  await expect(reducedMotionCard).toHaveCSS("transition-duration", "0s");
  const reducedMotionDenseCard = page
    .locator(".recipe-output-card--directory-grid")
    .filter({ hasText: denseRecipe.name });
  await expect(
    reducedMotionDenseCard.locator(
      ".recipe-output-ingredient-toggle-chevron"
    )
  ).toHaveCSS("transition-duration", "0s");
  const reducedMotionDisclosure = reducedMotionDenseCard.locator(
    ".recipe-output-ingredient-toggle"
  );
  await reducedMotionDisclosure.click();
  await expect(
    reducedMotionDenseCard.locator(".recipe-output-ingredient-panel-row").first()
  ).toHaveCSS("transition-duration", "0s");
  await reducedMotionDisclosure.click();
  await expect(
    reducedMotionDenseCard.locator(".recipe-output-ingredient-panel")
  ).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "no-preference" });

  const filteredPath = `/recipes?profession=${fixture.profession.slug}`;
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(filteredPath);
  await page.getByRole("button", { name: "Filter", exact: false }).click();
  await expect(
    page.getByRole("checkbox", { name: fixture.profession.name, exact: true })
  ).toBeChecked();
  await page.keyboard.press("Escape");
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
  await page.getByRole("button", { name: "Filter", exact: false }).click();
  await expect(
    page.getByRole("checkbox", {
      name: fixture.sparseProfession.name,
      exact: true,
    })
  ).not.toBeChecked();
  await page.keyboard.press("Escape");
  await page.screenshot({
    path: path.join(SCREENSHOT_DIRECTORY, "recipes-filtered-page-2.png"),
    fullPage: true,
  });

  await page.goto("/recipes?profession=not-a-profession&page=9");
  await expect(page).toHaveURL("/recipes");
  await page.getByRole("button", { name: "Filter", exact: false }).click();
  for (const profession of [fixture.profession, fixture.sparseProfession]) {
    await expect(
      page.getByRole("checkbox", { name: profession.name, exact: true })
    ).not.toBeChecked();
  }
});

test("Recipes index exposes only Profession filtering and drops stale Class queries", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/recipes");
  await expect(
    page.getByRole("button", { name: "Filter", exact: false })
  ).toBeVisible();
  await page.getByRole("button", { name: "Filter", exact: false }).click();
  await expect(
    page.getByRole("checkbox", { name: fixture.profession.name, exact: true })
  ).toBeVisible();
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

  // The Claude Design redesign (Slice 4) replaced the always-visible
  // "Filter Items by Category" nav landmark with a Filter button +
  // multi-select popover (directory-filter-popover.tsx) — unfiltered is
  // simply "no checkboxes checked", not an "All" link with
  // aria-current, and filtering is a real GET form submit rather than a
  // per-category link.
  const filterTrigger = page.getByRole("button", { name: "Filter", exact: false });
  await expect(filterTrigger).toBeVisible();
  const scenicBackground = page.locator(
    ".public-scenic-background--catalogue"
  );
  await expect(scenicBackground).toHaveCount(1);
  await expect(scenicBackground).toHaveCSS(
    "background-image",
    /merchants-codex-coastal-overlook\.png/
  );
  // Catalogue presentation now owns the handoff's direct wash and vignette
  // gradients; legacy appearance-variable values are no longer visual
  // contracts. The exact rendered treatment is covered by named captures.
  await filterTrigger.focus();
  await expect(filterTrigger).not.toHaveCSS("outline-style", "none");
  await filterTrigger.click();
  const categoryCheckbox = page.getByRole("checkbox", {
    name: fixture.outputCategory.name,
    exact: true,
  });
  await expect(categoryCheckbox).toBeVisible();
  await expectRealSpritesDominate(
    page.locator(".item-catalogue-grid"),
    ".public-sprite-stage--grid img",
    ".public-sprite-stage--grid.public-sprite-stage--empty"
  );
  const firstItemCard = page.locator(".item-catalogue-card").first();
  const firstItemTitle = firstItemCard.getByRole("heading");
  await expect(firstItemTitle).toBeVisible();
  await expect(firstItemTitle).toHaveCSS("font-size", "13.5px");
  const firstItemCategory = firstItemCard.locator(".item-catalogue-card-category");
  await expect(firstItemCategory).toHaveText(fixture.outputCategory.name);
  await expect(firstItemCategory).toHaveCSS("font-size", "10.5px");
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
    page.locator(".item-catalogue-grid").getByText("Category:", {
      exact: false,
    })
  ).toHaveCount(0);
  await expect(
    page.locator(".item-catalogue-grid").getByText("Tradeable:", {
      exact: false,
    })
  ).toHaveCount(0);
  await expect(
    page
      .locator(".item-catalogue-grid")
      .getByText(/Description:|Base value:/i)
  ).toHaveCount(0);
  const genuineStage = firstItemCard.locator(".public-sprite-stage--grid");
  // .first(): the Items directory's page size grew from 12 to 24 in the
  // Claude Design redesign (Slice 4, closer to the handoff's density),
  // so more than one no-image fallback card can now appear on the first
  // page — any one of them is equally valid for this geometry check.
  const fallbackCard = page
    .locator(".item-catalogue-card")
    .filter({ has: page.getByText("No image available", { exact: true }) })
    .first();
  const fallbackStage = fallbackCard.locator(".public-sprite-stage--grid");
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
  // The Claude Design redesign (Slice 4) clamps grid card titles to one
  // line with an ellipsis (matching the handoff's compact card density)
  // rather than wrapping — the full name is still available via the
  // title attribute.
  const longTitleCard = page
    .locator(".item-catalogue-card")
    .filter({ hasText: "Field Surveyor's Dusk Gauge" });
  const longTitleHeading = longTitleCard.getByRole("heading");
  await expect(longTitleHeading).toHaveCSS("white-space", "nowrap");
  await expect(longTitleHeading).toHaveCSS("text-overflow", "ellipsis");
  await expect(longTitleHeading).toHaveAttribute(
    "title",
    "A Test E2E Field Surveyor's Dusk Gauge"
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
      singleLine:
        heading.getBoundingClientRect().height <=
        Number.parseFloat(getComputedStyle(heading).lineHeight) + 1,
    };
  });
  expect(longTitleGeometry).toEqual({
    headingWithinCard: true,
    singleLine: true,
  });
  await longTitleCard.screenshot({
    path: path.join(SCREENSHOT_DIRECTORY, "item-long-title-card-close.png"),
  });

  await categoryCheckbox.check();
  await page.getByRole("button", { name: "Apply filters" }).click();
  const filteredPath = `/items?category=${fixture.outputCategory.slug}`;
  await expect(page).toHaveURL(filteredPath);
  await expect(
    page.getByText(fixture.consumerOnlyRecipe.result.name, { exact: true })
  ).toHaveCount(0);
  // The Items directory's page size grew from 12 to 24 in the Claude
  // Design redesign (Slice 4) — the 25-item fixture now spans 2 pages
  // (24 + 1) instead of 3 (12 + 12 + 1).
  const filteredCards = page.locator(".item-catalogue-card");
  await expect(filteredCards).toHaveCount(24);
  await expect(
    filteredCards.locator(".item-catalogue-card-category")
  ).toHaveText(Array(24).fill(fixture.outputCategory.name));
  await expect(
    page.locator(".item-catalogue-grid").getByText(/Category:|Tradeable:/)
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
