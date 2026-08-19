import { expect, test, type Locator, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  createE2ePublicProfessionDetailFixture,
  deleteE2ePublicProfessionDetailFixture,
  readE2ePublicProfessionDetailFixtureState,
} from "./helpers/database-cleanup";
import { readValidatedProfessionSpriteBytes } from "./helpers/profession-sprite-fixtures";
import { requireSiteVisibility } from "./helpers/site-visibility";

// Anonymous public browsing is only reachable under PUBLIC visibility, so
// this spec establishes it rather than inheriting whatever mode the
// previously-run spec happened to leave behind.
requireSiteVisibility("PUBLIC");

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

/** Mirrors PANEL_EDGE_GUTTER in recipe-output-ingredient-disclosure.tsx. */
const PANEL_EDGE_GUTTER = 12;

/**
 * Opens one card's ingredient overlay and proves it paints entirely inside
 * whatever actually crops it — the Recipes grid clips horizontally (its
 * `overflow-y: auto` computes `overflow-x` to `auto`), so a panel measured
 * only against the viewport would have its quantity column cropped.
 */
async function measureOpenPanelBounds(card: Locator) {
  const toggle = card.locator(".recipe-output-ingredient-toggle");
  await toggle.click();
  const panel = card.locator(".recipe-output-ingredient-panel");
  await expect(panel).toBeVisible();
  await expect(panel).toHaveCSS("opacity", "1");

  const geometry = await panel.evaluate((element) => {
    let left = 0;
    let right = document.documentElement.clientWidth;
    let node = element.parentElement;
    const clippingAncestors: string[] = [];
    while (node && node !== document.documentElement) {
      if (getComputedStyle(node).overflowX !== "visible") {
        const bound = node.getBoundingClientRect();
        clippingAncestors.push(
          typeof node.className === "string" ? node.className : node.tagName
        );
        left = Math.max(left, bound.left);
        right = Math.min(right, bound.right);
      }
      node = node.parentElement;
    }
    const panelRect = element.getBoundingClientRect();
    const owningCard = element.closest<HTMLElement>(".recipe-output-card");
    if (!owningCard) throw new Error("Expected the panel's owning Recipe card");
    const cardRect = owningCard.getBoundingClientRect();
    const quantities = Array.from(
      element.querySelectorAll<HTMLElement>(
        ".recipe-output-ingredient-panel-row > strong"
      )
    ).map((quantity) => {
      const rect = quantity.getBoundingClientRect();
      return { text: quantity.textContent ?? "", right: rect.right, width: rect.width };
    });
    return {
      panel: { left: panelRect.left, right: panelRect.right, width: panelRect.width },
      card: { left: cardRect.left, right: cardRect.right },
      bounds: { left, right },
      clippingAncestors,
      viewportWidth: document.documentElement.clientWidth,
      quantities,
    };
  });

  // The whole panel, quantity column included, stays inside the real
  // clipping boundary rather than merely inside the window.
  expect(geometry.panel.right).toBeLessThanOrEqual(
    geometry.bounds.right - PANEL_EDGE_GUTTER + 0.5
  );
  expect(geometry.panel.left).toBeGreaterThanOrEqual(
    geometry.bounds.left + PANEL_EDGE_GUTTER - 0.5
  );
  expect(geometry.quantities.length).toBeGreaterThan(0);
  for (const quantity of geometry.quantities) {
    expect(quantity.text).toMatch(/^×\d+$/);
    expect(quantity.width).toBeGreaterThan(0);
    expect(quantity.right).toBeLessThanOrEqual(geometry.panel.right - 0.5);
  }
  return { geometry, toggle, panel };
}

/** First-row card indices at the left edge, middle, and right edge. */
async function findEdgeCardIndices(page: Page) {
  return page.evaluate(() => {
    const cards = Array.from(
      document.querySelectorAll<HTMLElement>(".recipe-output-card--directory-grid")
    );
    const minTop = Math.min(...cards.map((card) => card.getBoundingClientRect().top));
    const firstRow = cards
      .map((card, index) => ({ card, index }))
      .filter(({ card }) => Math.abs(card.getBoundingClientRect().top - minTop) < 1)
      .filter(({ card }) => card.querySelector(".recipe-output-ingredient-toggle"))
      .sort(
        (a, b) =>
          a.card.getBoundingClientRect().left - b.card.getBoundingClientRect().left
      );
    return {
      leftmost: firstRow[0]?.index ?? -1,
      middle: firstRow[Math.floor(firstRow.length / 2)]?.index ?? -1,
      rightmost: firstRow[firstRow.length - 1]?.index ?? -1,
    };
  });
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

  // The expanded panel is an absolute-positioned overlay, not a grid
  // participant: opening it must not push the row below down by even 1px.
  const denseCardBoxBeforeOpen = await denseCard.boundingBox();
  expect(denseCardBoxBeforeOpen).not.toBeNull();
  const siblingRowBoxesBeforeOpen = await allCards.evaluateAll((cards, denseTop) =>
    cards
      .map((card) => card.getBoundingClientRect())
      .filter((rect) => rect.top > denseTop + 1)
      .map((rect) => ({ x: rect.x, y: rect.y, width: rect.width, height: rect.height })),
    denseCardBoxBeforeOpen!.y
  );
  expect(siblingRowBoxesBeforeOpen.length).toBeGreaterThan(0);

  await ingredientDisclosure.click();
  await expect(ingredientDisclosure).toHaveAttribute("aria-expanded", "true");

  const denseCardBoxAfterOpen = await denseCard.boundingBox();
  expect(denseCardBoxAfterOpen).toEqual(denseCardBoxBeforeOpen);
  const siblingRowBoxesAfterOpen = await allCards.evaluateAll((cards, denseTop) =>
    cards
      .map((card) => card.getBoundingClientRect())
      .filter((rect) => rect.top > denseTop + 1)
      .map((rect) => ({ x: rect.x, y: rect.y, width: rect.width, height: rect.height })),
    denseCardBoxBeforeOpen!.y
  );
  expect(siblingRowBoxesAfterOpen).toEqual(siblingRowBoxesBeforeOpen);
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

  // Proves the panel actually paints above the row it overlaps, not merely
  // that it is positioned there: a hit test at a point inside the panel but
  // below the dense card's own bottom edge must resolve inside the panel.
  const overlayHitTest = await ingredientPanel.evaluate((panel, cardBottom) => {
    const panelRect = panel.getBoundingClientRect();
    const x = panelRect.x + panelRect.width / 2;
    const y = Math.min(cardBottom + 10, panelRect.bottom - 5);
    const hit = document.elementFromPoint(x, y);
    return { hitsPanel: !!hit && panel.contains(hit), y, cardBottom, panelBottom: panelRect.bottom };
  }, denseCardBoxBeforeOpen!.y + denseCardBoxBeforeOpen!.height);
  expect(overlayHitTest.panelBottom).toBeGreaterThan(overlayHitTest.cardBottom);
  expect(overlayHitTest.hitsPanel).toBe(true);
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
    const name = panel.querySelector<HTMLElement>(
      ".recipe-output-ingredient-panel-name"
    );
    const quantity = row?.querySelector<HTMLElement>("strong");
    const card = panel.closest<HTMLElement>(".recipe-output-card");
    if (!row || !secondRow || !name || !quantity || !card) {
      throw new Error("Expected a complete Recipe ingredient panel row");
    }
    const panelRect = panel.getBoundingClientRect();
    const rowStyle = getComputedStyle(row);
    const nameStyle = getComputedStyle(name);
    const quantityStyle = getComputedStyle(quantity);
    const panelStyle = getComputedStyle(panel);
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
      rowDisplay: rowStyle.display,
      rowGridColumns: rowStyle.gridTemplateColumns,
      rowColumnGap: rowStyle.columnGap,
      rowAnimationName: rowStyle.animationName,
      firstRowDelay: rowStyle.animationDelay,
      secondRowDelay: getComputedStyle(secondRow).animationDelay,
      nameFontSize: nameStyle.fontSize,
      nameFontWeight: nameStyle.fontWeight,
      nameWhiteSpace: nameStyle.whiteSpace,
      nameOverflow: nameStyle.overflow,
      quantityFontSize: quantityStyle.fontSize,
      quantityFontWeight: quantityStyle.fontWeight,
      cardZIndex: getComputedStyle(card).zIndex,
    };
  });
  // The panel's own minimum width (190px content) plus its fixed padding
  // (10px) and border (1px) on each side is its floor; ~320px content plus
  // the same padding/border is its ceiling. This fixture's long ingredient
  // names should have pushed it well past the floor.
  const PANEL_PADDING_AND_BORDER = 2 * (10 + 1);
  expect(panelGeometry.panelWidth).toBeGreaterThan(190 + PANEL_PADDING_AND_BORDER);
  expect(panelGeometry.panelWidth).toBeLessThanOrEqual(320 + PANEL_PADDING_AND_BORDER + 1);
  expect(panelGeometry.panelDisplay).toBe("flex");
  expect(panelGeometry.panelGap).toBe("8px");
  expect(panelGeometry.panelPadding).toBe("10px");
  expect(panelGeometry.panelRadius).toBe("8px");
  expect(panelGeometry.panelBorder).toContain("rgb(58, 53, 40)");
  expect(panelGeometry.panelShadow).not.toBe("none");
  expect(panelGeometry.panelBoxSizing).toBe("content-box");
  expect(panelGeometry.panelChildCount).toBe(orderedIngredients.length + 1);
  expect(panelGeometry.rowDisplay).toBe("grid");
  // 28px icon / flexible name / 36px quantity: only the middle track may
  // ever change size as the panel grows.
  const [iconTrack, nameTrack, quantityTrack] = panelGeometry.rowGridColumns
    .split(" ")
    .map((value) => parseFloat(value));
  expect(iconTrack).toBeCloseTo(28, 0);
  expect(quantityTrack).toBeCloseTo(36, 0);
  expect(nameTrack).toBeGreaterThan(0);
  expect(panelGeometry.rowColumnGap).toBe("10px");
  expect(panelGeometry.rowAnimationName).toBe("cx-item-in");
  expect(panelGeometry.firstRowDelay).toBe("0s");
  expect(panelGeometry.secondRowDelay).toBe("0.03s");
  expect(panelGeometry.nameFontSize).toBe("12.5px");
  expect(panelGeometry.nameFontWeight).toBe("400");
  expect(panelGeometry.nameWhiteSpace).toBe("normal");
  expect(panelGeometry.nameOverflow).toBe("visible");
  expect(panelGeometry.quantityFontSize).toBe("12.5px");
  expect(panelGeometry.quantityFontWeight).toBe("700");
  expect(panelGeometry.cardZIndex).toBe("40");

  // Required browser measurement: every row's icon, name, and quantity
  // column against a shared centerline, plus identical left/right edges
  // across every row regardless of content. Covers real-sprite rows,
  // "No image" fallback rows, and this fixture's long, wrapping names.
  const rowMeasurements = await ingredientPanel.evaluate((panel) =>
    Array.from(
      panel.querySelectorAll<HTMLElement>(".recipe-output-ingredient-panel-row")
    ).map((row) => {
      const image = row.querySelector<HTMLElement>(
        ".recipe-output-ingredient-panel-image"
      );
      const name = row.querySelector<HTMLElement>(
        ".recipe-output-ingredient-panel-name"
      );
      const quantity = row.querySelector<HTMLElement>("strong");
      if (!image || !name || !quantity) {
        throw new Error("Expected a complete ingredient panel row");
      }
      const imageRect = image.getBoundingClientRect();
      const nameRect = name.getBoundingClientRect();
      const quantityRect = quantity.getBoundingClientRect();
      return {
        isFallback: !!row.querySelector(".public-sprite-stage--empty"),
        isSingleLine: nameRect.height <= 20,
        imageLeft: imageRect.left,
        imageWidth: imageRect.width,
        imageHeight: imageRect.height,
        imageCenterY: imageRect.top + imageRect.height / 2,
        nameLeft: nameRect.left,
        nameCenterY: nameRect.top + nameRect.height / 2,
        quantityRight: quantityRect.right,
        quantityCenterY: quantityRect.top + quantityRect.height / 2,
      };
    })
  );
  expect(rowMeasurements.length).toBeGreaterThanOrEqual(5);
  const realImageRows = rowMeasurements.filter((row) => !row.isFallback);
  const fallbackRows = rowMeasurements.filter((row) => row.isFallback);
  const wrappedRows = rowMeasurements.filter((row) => !row.isSingleLine);
  expect(realImageRows.length).toBeGreaterThanOrEqual(2);
  // The dense fixture seeds exactly one spriteless ingredient; that single
  // fallback row is still measured against every real-sprite row below.
  expect(fallbackRows.length).toBeGreaterThanOrEqual(1);
  expect(wrappedRows.length).toBeGreaterThanOrEqual(1);
  for (const row of rowMeasurements) {
    expect(row.imageWidth).toBeCloseTo(28, 0);
    expect(row.imageHeight).toBeCloseTo(28, 0);
  }
  // Same column x-positions on every row, real sprite or fallback alike.
  const imageLefts = rowMeasurements.map((row) => row.imageLeft);
  const nameLefts = rowMeasurements.map((row) => row.nameLeft);
  const quantityRights = rowMeasurements.map((row) => row.quantityRight);
  expect(Math.max(...imageLefts) - Math.min(...imageLefts)).toBeLessThanOrEqual(0.5);
  expect(Math.max(...nameLefts) - Math.min(...nameLefts)).toBeLessThanOrEqual(0.5);
  expect(Math.max(...quantityRights) - Math.min(...quantityRights)).toBeLessThanOrEqual(
    0.5
  );
  // Icon, name, and quantity share one centerline within every row (a
  // wrapped name grows the row, but the grid still centers all three
  // columns against that taller row).
  for (const row of rowMeasurements) {
    const centers = [row.imageCenterY, row.nameCenterY, row.quantityCenterY];
    expect(Math.max(...centers) - Math.min(...centers)).toBeLessThanOrEqual(1);
  }
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

  // Edge-safety: an adaptive-width panel is centered under its card, so at
  // either end of a row it would naturally spill past the catalogue grid —
  // which crops horizontally, since its `overflow-y: auto` computes the
  // untouched `overflow-x` to `auto` alongside it. The runtime edge-shift
  // must pull the whole panel, quantity column included, back inside that
  // boundary. Cards are found dynamically: the grid's actual column order is
  // an implementation detail of the fixture, not of this test.
  const edgeIndices = await findEdgeCardIndices(page);
  expect(edgeIndices.leftmost).toBeGreaterThanOrEqual(0);
  expect(edgeIndices.middle).toBeGreaterThanOrEqual(0);
  expect(edgeIndices.rightmost).toBeGreaterThanOrEqual(0);
  expect(edgeIndices.rightmost).not.toBe(edgeIndices.leftmost);

  const rightmost = await measureOpenPanelBounds(allCards.nth(edgeIndices.rightmost));
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: path.join(
      SCREENSHOT_DIRECTORY,
      "recipes-ingredient-disclosure-edge-shift-1920x1080.png"
    ),
  });
  // The grid, not the window, is what constrains this card.
  expect(rightmost.geometry.clippingAncestors).toContain("recipe-output-grid");
  expect(rightmost.geometry.bounds.right).toBeLessThan(
    rightmost.geometry.viewportWidth
  );
  // Anchored to its card while extending left of it, rather than cropped.
  expect(rightmost.geometry.panel.left).toBeLessThan(rightmost.geometry.card.left);
  await rightmost.toggle.click();
  await expect(
    allCards.nth(edgeIndices.rightmost).locator(".recipe-output-ingredient-panel")
  ).toHaveCount(0);

  const leftmost = await measureOpenPanelBounds(allCards.nth(edgeIndices.leftmost));
  await expectNoHorizontalOverflow(page);
  expect(leftmost.geometry.panel.right).toBeGreaterThan(leftmost.geometry.card.right);
  await leftmost.toggle.click();
  await expect(
    allCards.nth(edgeIndices.leftmost).locator(".recipe-output-ingredient-panel")
  ).toHaveCount(0);

  // A mid-row card needs no correction at all: it stays centered on its card.
  const middle = await measureOpenPanelBounds(allCards.nth(edgeIndices.middle));
  await expectNoHorizontalOverflow(page);
  const middleCardCenter =
    (middle.geometry.card.left + middle.geometry.card.right) / 2;
  const middlePanelCenter =
    (middle.geometry.panel.left + middle.geometry.panel.right) / 2;
  expect(Math.abs(middlePanelCenter - middleCardCenter)).toBeLessThanOrEqual(0.5);
  await middle.toggle.click();
  await expect(
    allCards.nth(edgeIndices.middle).locator(".recipe-output-ingredient-panel")
  ).toHaveCount(0);

  // The clipping boundary is a layout result, not a constant, so the same
  // correction is re-proven on an ultrawide viewport where the grid ends far
  // from the window edge.
  await page.setViewportSize({ width: 3440, height: 1440 });
  await expectRecipeColumns(page, 7);
  const wideIndices = await findEdgeCardIndices(page);
  const wideRightmost = await measureOpenPanelBounds(
    allCards.nth(wideIndices.rightmost)
  );
  await expectNoHorizontalOverflow(page);
  expect(wideRightmost.geometry.clippingAncestors).toContain("recipe-output-grid");
  await page.screenshot({
    path: path.join(
      SCREENSHOT_DIRECTORY,
      "recipes-ingredient-disclosure-edge-shift-3440x1440.png"
    ),
  });
  await wideRightmost.toggle.click();
  await expect(
    allCards.nth(wideIndices.rightmost).locator(".recipe-output-ingredient-panel")
  ).toHaveCount(0);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await expectRecipeColumns(page, 7);

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
    const positioner = panel.parentElement;
    if (!positioner) {
      throw new Error("Expected the panel's positioning wrapper");
    }
    const rect = panel.getBoundingClientRect();
    const style = getComputedStyle(panel);
    const positionerStyle = getComputedStyle(positioner);
    return {
      outerWidth: rect.width,
      styleWidth: style.width,
      styleMinWidth: style.minWidth,
      styleMaxWidth: style.maxWidth,
      transformOrigin: style.transformOrigin,
      positionerTop: positionerStyle.top,
      positionerLeft: positionerStyle.left,
    };
  });
  expect(listPanelGeometry.outerWidth).toBeCloseTo(222, 0);
  expect(listPanelGeometry.styleWidth).toBe("200px");
  expect(listPanelGeometry.styleMinWidth).toBe("0px");
  expect(listPanelGeometry.styleMaxWidth).toBe("none");
  expect(listPanelGeometry.transformOrigin).toBe("0px 0px");
  expect(listPanelGeometry.positionerTop).toBe("50px");
  expect(listPanelGeometry.positionerLeft).toBe("0px");
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

  // A live search from page 2 goes back to the first page of the NEW result
  // set, instead of stranding the visitor on a page the matches no longer
  // have. The Profession filter beside it is untouched.
  await page.goto(`${filteredPath}&page=2`);
  await expect(
    page.getByRole("navigation", { name: "Recipes pagination" })
  ).toContainText("Page 2 of 2");
  await page
    .getByRole("searchbox", { name: "Find a recipe by name..." })
    .fill(denseRecipe.name);
  await expect(page.locator(".recipe-output-card")).toHaveCount(1);
  await expect(
    page.getByRole("navigation", { name: "Recipes pagination" })
  ).toHaveCount(0);
  await expect(page).not.toHaveURL(/[?&]page=/);
  await expect(page).toHaveURL(
    new RegExp(`profession=${fixture.profession.slug}`)
  );

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
  // The gold uppercase category label sits a notch below the directory
  // meta size (--directory-card-eyebrow-font-size, 9.75px at the 1920
  // anchor) so it reads as secondary identity rather than competing with
  // the card title; the relative check below is the durable contract.
  await expect(firstItemCategory).toHaveCSS("font-size", "9.75px");
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
  // The contract is that a genuine sprite and the "no image" fallback occupy
  // the SAME stage box. Compared exactly, that box is reported as 78 in one
  // card and 78.00003051757812 in the other — browser subpixel noise from the
  // grid's fractional track sizing, not a layout difference. A half-pixel
  // tolerance (the same one this spec already uses for the ingredient overlay
  // bounds above) absorbs that while still failing on any real regression: the
  // smallest meaningful stage change here is a whole pixel, and every value in
  // DISPLAY_SIZES is an integer.
  expect(Math.abs(stageGeometry[0].width - stageGeometry[1].width)).toBeLessThanOrEqual(0.5);
  expect(
    Math.abs(stageGeometry[0].height - stageGeometry[1].height)
  ).toBeLessThanOrEqual(0.5);
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

/**
 * Reads the ingredient preview strip of one card: how many complete previews
 * are rendered, whether the disclosure trigger is present, and the gap
 * between the last preview and that trigger.
 */
async function readStrip(card: Locator) {
  return card.evaluate((element) => {
    const strip = element.querySelector(".recipe-output-ingredient-disclosure");
    const chips = Array.from(
      element.querySelectorAll(
        ".recipe-output-ingredient-list > .recipe-output-ingredient",
      ),
    );
    const toggle = element.querySelector(".recipe-output-ingredient-toggle");
    const list = element.querySelector(".recipe-output-ingredient-list");
    const last = chips[chips.length - 1];
    const box = element.getBoundingClientRect();
    return {
      stripWidth: strip ? strip.clientWidth : null,
      shown: chips.length,
      hasTrigger: !!toggle,
      listGap: list ? getComputedStyle(list).columnGap : null,
      gapToTrigger:
        last && toggle
          ? toggle.getBoundingClientRect().left -
            last.getBoundingClientRect().right
          : null,
      cardWidth: Math.round(box.width),
      cardHeight: Math.round(box.height),
    };
  });
}

/**
 * The strip's capacity is decided at hydration, one frame after the server's
 * conservative default paints. Reads therefore wait for two consecutive
 * agreeing samples rather than an arbitrary sleep.
 */
async function settledStrip(card: Locator) {
  let previous = await readStrip(card);
  await expect
    .poll(async () => {
      const next = await readStrip(card);
      const stable = next.shown === previous.shown;
      previous = next;
      return stable;
    })
    .toBe(true);
  return previous;
}

function denseRecipeFixture() {
  const dense = fixture.recipes.find((recipe) =>
    recipe.name.includes("Dense Ninefold"),
  );
  if (!dense) throw new Error("Expected the dense Recipe fixture");
  return dense;
}

test("Grid ingredient previews fill the strip they are actually given", async ({
  page,
}) => {
  const dense = denseRecipeFixture();
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`/professions/${fixture.profession.slug}`);

  const card = page
    .locator(".recipe-output-card--grid")
    .filter({ hasText: dense.name })
    .first();
  await expect(card).toBeVisible();

  const natural = await settledStrip(card);
  expect(natural.shown).toBeGreaterThan(0);
  // The Recipe has more ingredients than any compact strip can hold, so the
  // trigger must be there...
  expect(natural.hasTrigger).toBe(true);
  // ...immediately after the final preview, at the list's own rhythm rather
  // than parked against the strip's right edge.
  expect(natural.gapToTrigger).toBeCloseTo(
    Number.parseFloat(natural.listGap ?? "0"),
    0,
  );

  // Every rendered preview is COMPLETE: the trigger still ends inside the
  // strip, so nothing is clipped.
  const fitsInside = await card.evaluate((element) => {
    const strip = element.querySelector(
      ".recipe-output-ingredient-disclosure",
    ) as HTMLElement | null;
    const toggle = element.querySelector(".recipe-output-ingredient-toggle");
    if (!strip || !toggle) return false;
    return (
      toggle.getBoundingClientRect().right <=
      strip.getBoundingClientRect().right + 1
    );
  });
  expect(fitsInside, "previews and trigger must fit inside the strip").toBe(
    true,
  );
});

test("preview capacity follows the container's width, not the viewport's", async ({
  page,
}) => {
  const dense = denseRecipeFixture();
  // The viewport is pinned for this whole test: every capacity change below
  // comes from the container being resized, which is exactly the claim.
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`/professions/${fixture.profession.slug}`);

  const card = page
    .locator(".recipe-output-card--grid")
    .filter({ hasText: dense.name })
    .first();
  await expect(card).toBeVisible();

  const wide = await settledStrip(card);
  expect(wide.shown).toBeGreaterThan(1);

  // Squeeze the observed strip. The ResizeObserver must react on its own.
  await card.evaluate((element) => {
    const strip = element.querySelector(
      ".recipe-output-ingredient-disclosure",
    ) as HTMLElement;
    strip.style.maxWidth = "90px";
  });
  await expect
    .poll(async () => (await readStrip(card)).shown, {
      message: "capacity should shrink with its container",
    })
    .toBeLessThan(wide.shown);

  const narrow = await settledStrip(card);
  expect(narrow.hasTrigger).toBe(true);
  expect(narrow.shown).toBeGreaterThanOrEqual(1);
  // The card's own geometry is not a function of how many previews fit.
  expect(narrow.cardWidth).toBe(wide.cardWidth);
  expect(narrow.cardHeight).toBe(wide.cardHeight);

  // Releasing the constraint restores the wider capacity.
  await card.evaluate((element) => {
    const strip = element.querySelector(
      ".recipe-output-ingredient-disclosure",
    ) as HTMLElement;
    strip.style.maxWidth = "";
  });
  await expect.poll(async () => (await readStrip(card)).shown).toBe(wide.shown);
});

test("a Recipe whose ingredients all fit renders no chevron at all", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`/professions/${fixture.profession.slug}`);

  const cards = page.locator(".recipe-output-card--grid");
  const count = await cards.count();
  expect(count).toBeGreaterThan(0);

  let sawFitting = false;
  for (let index = 0; index < count; index += 1) {
    const strip = await readStrip(cards.nth(index));
    if (!strip.hasTrigger) {
      sawFitting = true;
      // No trigger means the strip claims everything fits, so nothing was
      // silently dropped.
      expect(strip.shown).toBeGreaterThan(0);
    }
  }
  expect(
    sawFitting,
    "at least one fixture Recipe should fit entirely in its strip",
  ).toBe(true);
});

test("the disclosure still lists every ingredient once opened", async ({
  page,
}) => {
  const dense = denseRecipeFixture();
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`/professions/${fixture.profession.slug}`);

  const card = page
    .locator(".recipe-output-card--grid")
    .filter({ hasText: dense.name })
    .first();
  // The accessible name flips from "Show N more..." to "Hide N additional..."
  // once open, so the control is pinned by the region it controls instead.
  const controlled = await card
    .getByRole("button", { name: /more ingredients/ })
    .getAttribute("aria-controls");
  const toggle = card.locator(`button[aria-controls="${controlled}"]`);
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");

  const panelRows = card.locator(".recipe-output-ingredient-panel-row");
  await expect(panelRows).toHaveCount(dense.ingredients.length);
});

test("the List variant renders every ingredient inline and never discloses", async ({
  page,
}) => {
  const dense = denseRecipeFixture();
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`/professions/${fixture.profession.slug}`);

  await page.getByRole("button", { name: "List", exact: true }).click();
  const row = page
    .locator(".recipe-output-card--list")
    .filter({ hasText: dense.name })
    .first();
  await expect(row).toBeVisible();

  await expect(
    row.locator(".recipe-output-ingredient-list > .recipe-output-ingredient"),
  ).toHaveCount(dense.ingredients.length);
  await expect(row.locator(".recipe-output-ingredient-toggle")).toHaveCount(0);
  await expect(row.locator(".recipe-output-ingredient-disclosure")).toHaveCount(
    0,
  );
});

test("ingredient stages carry the canonical Item hue without touching the art", async ({
  page,
}) => {
  const dense = denseRecipeFixture();
  await page.setViewportSize({ width: 1920, height: 1080 });

  // Canonical Recipe card preview stages...
  await page.goto(`/professions/${fixture.profession.slug}`);
  await expect(
    page.locator(".recipe-output-ingredient-image.item-hue-stage").first(),
  ).toBeVisible();

  // ...and Recipe DETAIL ingredient rows.
  await page.goto(`/recipes/${dense.slug}`);
  const rowStage = page
    .locator(".recipe-ingredient-row .item-recipe-thumbnail.item-hue-stage")
    .first();
  await expect(rowStage).toBeVisible();

  // The contract is the token, not a colour literal: the stage resolves
  // --resource-hue to the same canonical triple --hue-item carries.
  const hues = await rowStage.evaluate((element) => ({
    stage: getComputedStyle(element).getPropertyValue("--resource-hue").trim(),
    canonical: getComputedStyle(document.documentElement)
      .getPropertyValue("--hue-item")
      .trim(),
  }));
  expect(hues.canonical).not.toBe("");
  expect(hues.stage).toBe(hues.canonical);

  // The sprite itself is never filtered or recoloured — only its ground.
  const art = rowStage.locator("img").first();
  if (await art.count()) {
    await expect(art).toHaveCSS("filter", "none");
  }
});
