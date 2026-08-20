import { expect, test, type Page } from "@playwright/test";
import {
  countE2eTestShopRecords,
  createE2ePokeYenListing,
  createE2ePublicShopFixtures,
  deleteE2ePokeYenCurrency,
  deleteE2eTestShopRecords,
} from "./helpers/database-cleanup";
import { requireSiteVisibility } from "./helpers/site-visibility";

requireSiteVisibility("PUBLIC");

let fixtures: Awaited<ReturnType<typeof createE2ePublicShopFixtures>>;
let pokeYen: Awaited<ReturnType<typeof createE2ePokeYenListing>>;
let pageErrors: string[] = [];

test.beforeAll(async () => {
  await deleteE2eTestShopRecords();
  await deleteE2ePokeYenCurrency();
  fixtures = await createE2ePublicShopFixtures();
  // A listing priced in the CANONICAL PokeYen Currency (slug "poke-yen",
  // carrying an image), so the symbol-only rule is exercised against the
  // real identity production uses rather than a stand-in.
  // Fixture ids, matching how createE2ePublicShopFixtures wires its own rows.
  pokeYen = await createE2ePokeYenListing(
    "test-e2e-shop-public-beta-id",
    "test-e2e-shop-item-id",
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
  // Listings go first: Currency deletion is RESTRICT-guarded.
  await deleteE2eTestShopRecords();
  await deleteE2ePokeYenCurrency();
  expect(await countE2eTestShopRecords()).toBe(0);
});

function shopUrl() {
  return `/shops/${fixtures.shop.slug}`;
}

async function expectNoHorizontalOverflow(page: Page, label: string) {
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
    `${label}: must not scroll horizontally`,
  ).toBe(true);
}

test("a row click selects, and a double click never navigates", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(shopUrl());

  const rows = page.locator(".shop-detail-inventory-row");
  await expect(rows).toHaveCount(2);

  const secondRow = rows.nth(1);
  const secondPreview = secondRow.getByRole("button", {
    name: `Preview ${fixtures.item.name}`,
  });

  // Single click selects the row rather than navigating.
  await secondRow.click({ position: { x: 120, y: 10 } });
  await expect(secondPreview).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(shopUrl());

  // Double clicking anywhere on the row — including directly on the item
  // name — must NOT navigate. This used to be a hidden shortcut to the Item
  // page; it is gone.
  await secondRow.dblclick({ position: { x: 120, y: 10 } });
  await page.waitForTimeout(250);
  await expect(page).toHaveURL(shopUrl());

  const name = secondRow.locator(".shop-detail-inventory-name");
  await expect(name).toHaveCount(1);
  await name.dblclick();
  await page.waitForTimeout(250);
  await expect(page).toHaveURL(shopUrl());

  // The name itself is no longer an anchor at all.
  await expect(
    secondRow.getByRole("link", { name: fixtures.item.name, exact: true }),
  ).toHaveCount(0);
  // ...and the row is still selected, so nothing about selection regressed.
  await expect(secondPreview).toHaveAttribute("aria-pressed", "true");
});

test("the row page-link arrow navigates to the Item page and sits beside the name", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(shopUrl());

  const firstRow = page.locator(".shop-detail-inventory-row").first();
  const arrow = firstRow.getByRole("link", {
    name: `Open ${fixtures.item.name} item page`,
  });

  await expect(arrow).toHaveAttribute("href", `/items/${fixtures.item.slug}`);
  await expect(arrow).toHaveClass(/page-link-arrow/);

  // It belongs to the name area, not the price area: it starts left of the
  // price and sits immediately after the name.
  const geometry = await firstRow.evaluate((row) => {
    const name = row.querySelector(".shop-detail-inventory-name");
    const link = row.querySelector(".shop-detail-inventory-link");
    const price = row.querySelector(".currency-price");
    if (!name || !link || !price) throw new Error("Expected row parts");
    return {
      nameRight: name.getBoundingClientRect().right,
      linkLeft: link.getBoundingClientRect().left,
      linkRight: link.getBoundingClientRect().right,
      priceLeft: price.getBoundingClientRect().left,
    };
  });
  expect(geometry.linkLeft).toBeGreaterThanOrEqual(geometry.nameRight - 1);
  expect(geometry.linkLeft - geometry.nameRight).toBeLessThan(20);
  expect(geometry.linkRight).toBeLessThan(geometry.priceLeft);

  // Keyboard reachable with a visible focus ring.
  await arrow.focus();
  await expect(arrow).toBeFocused();
  await expect(arrow).not.toHaveCSS("outline-style", "none");

  await arrow.click();
  await expect(page).toHaveURL(`/items/${fixtures.item.slug}`);
});

test("the selected-item box carries its own bottom-right page-link arrow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(shopUrl());

  const box = page.locator(".shop-detail-selected-copy");
  const arrow = box.getByRole("link", {
    name: `Open ${fixtures.item.name} item page`,
  });
  await expect(arrow).toHaveAttribute("href", `/items/${fixtures.item.slug}`);
  await expect(arrow).toHaveClass(/page-link-arrow/);

  // Bottom-right, inset, and never overlapping the name or description.
  const layout = await box.evaluate((element) => {
    const boxRect = element.getBoundingClientRect();
    const link = element.querySelector(".shop-detail-selected-link");
    const name = element.querySelector(".shop-detail-selected-name");
    if (!link || !name) throw new Error("Expected the selected box parts");
    const linkRect = link.getBoundingClientRect();
    const nameRect = name.getBoundingClientRect();
    const description = element.querySelector("p");
    return {
      insetRight: boxRect.right - linkRect.right,
      insetBottom: boxRect.bottom - linkRect.bottom,
      overlapsName: !(
        linkRect.left >= nameRect.right || linkRect.top >= nameRect.bottom
      ),
      overlapsDescription: description
        ? !(
            linkRect.left >= description.getBoundingClientRect().right ||
            linkRect.top >= description.getBoundingClientRect().bottom
          )
        : false,
    };
  });
  expect(layout.insetRight).toBeGreaterThan(4);
  expect(layout.insetBottom).toBeGreaterThan(2);
  expect(layout.overlapsName).toBe(false);
  expect(layout.overlapsDescription).toBe(false);

  // The box itself is not a link — only the arrow navigates.
  await expect(box).not.toHaveAttribute("href", /./);

  await arrow.click();
  await expect(page).toHaveURL(`/items/${fixtures.item.slug}`);
});

test("page-link arrows stay clear of prices and content at every calibration width", async ({
  page,
}) => {
  for (const viewport of [
    { name: "1920x1080", width: 1920, height: 1080 },
    { name: "2560x1440", width: 2560, height: 1440 },
    { name: "3440x1440", width: 3440, height: 1440 },
    { name: "1000x900", width: 1000, height: 900 },
    { name: "390x844", width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(shopUrl());
    const label = `shop detail @ ${viewport.name}`;
    await expectNoHorizontalOverflow(page, label);

    const clear = await page.evaluate(() => {
      return Array.from(
        document.querySelectorAll(".shop-detail-inventory-row"),
      ).every((row) => {
        const name = row.querySelector(".shop-detail-inventory-name");
        const link = row.querySelector(".shop-detail-inventory-link");
        const price = row.querySelector(".currency-price");
        if (!name || !link || !price) return false;
        const l = link.getBoundingClientRect();
        const p = price.getBoundingClientRect();
        const n = name.getBoundingClientRect();
        // The arrow always follows the name on the name's own line...
        const followsName = l.left >= n.right - 1 && l.left - n.right < 20;
        // ...and never overlaps the price, whether the price shares the line
        // (wide) or wraps beneath it (narrow).
        const clearOfPrice = l.right <= p.left + 1 || l.bottom <= p.top + 1;
        return followsName && clearOfPrice;
      });
    });
    expect(
      clear,
      `${label}: the row arrow must follow the name and never overlap the price`,
    ).toBe(true);
  }
});

test("a Currency with an image still renders it beside the amount", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(shopUrl());

  // The alternate fixture Currency carries an image and is NOT PokeYen, so
  // the shared price component must still render it — the PokeYen rule is a
  // single-Currency exception, never a removal of Currency image support.
  const alternatePrice = page.getByLabel(
    `2,147,483,647 ${fixtures.alternateCurrency.name}`,
  );
  await expect(alternatePrice.locator("img")).toHaveCount(1);

  // The ₽ price is one compact unit: symbol and amount, no icon placeholder
  // width left behind beside it.
  const primaryPrice = page.getByLabel(
    `₽ 1,250 ${fixtures.primaryCurrency.name}`,
  );
  await expect(primaryPrice).toHaveText("₽ 1,250");
  await expect(primaryPrice.locator("img")).toHaveCount(0);
});

test("PokeYen prices are symbol-only, while other Currencies keep their image", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`/shops/${fixtures.secondShop.slug}`);

  // PokeYen's record HAS an image, but the public price never renders it:
  // the bare "₽ 145" is the whole price.
  const pokeYenPrice = page.getByLabel(`₽ 145 ${pokeYen.name}`);
  await expect(pokeYenPrice).toHaveText("₽ 145");
  await expect(pokeYenPrice.locator("img")).toHaveCount(0);
  await expect(page.locator('img[src*="test-e2e-poke-yen"]')).toHaveCount(0);

  // The symbol and amount form one compact unit — no icon-shaped gap is left
  // behind where the image used to sit.
  const compact = await pokeYenPrice.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const text = element.querySelector("span[aria-hidden='true']");
    if (!text) throw new Error("Expected the visible price text");
    const textRect = text.getBoundingClientRect();
    return {
      leadingGap: textRect.left - rect.left,
      trailingGap: rect.right - textRect.right,
    };
  });
  expect(compact.leadingGap).toBeLessThanOrEqual(1);
  expect(compact.trailingGap).toBeLessThanOrEqual(1);
});

test("inventory icons follow the Recipe Ingredients scale and quiet placeholder", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(shopUrl());

  const stage = page
    .locator(".shop-detail-inventory-icon .public-sprite-stage--row")
    .first();
  await expect(stage).toHaveCSS("width", "32px");
  await expect(stage).toHaveCSS("height", "32px");

  // The placeholder carries no frame of its own -- the row is the container,
  // exactly as in the Recipe Ingredients box.
  const placeholder = page
    .locator(".shop-detail-inventory-icon .public-sprite-stage--empty")
    .first();
  await expect(placeholder).toHaveCount(1);
  await expect(placeholder).toHaveCSS("border-top-width", "0px");
  await expect(placeholder).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  // ...and it still states the missing art rather than blanking it out.
  const fallback = placeholder.locator(".public-sprite-fallback");
  await expect(fallback).toHaveText(/No image/i);
  const fontSize = await fallback.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).fontSize),
  );
  expect(fontSize).toBeGreaterThan(0);
  expect(fontSize).toBeLessThan(11);

  // The preview leads the rows without dwarfing them.
  const preview = page.locator(".shop-detail-selected-stage");
  await expect(preview).toHaveCSS("width", "64px");
  await expect(preview).toHaveCSS("border-top-width", "1px");
});

test("the two arrow variants share one family at two emphasis levels", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(shopUrl());

  const rowArrow = page.locator(".shop-detail-inventory-link").first();
  const boxArrow = page.locator(".shop-detail-selected-link");

  await expect(rowArrow).toHaveClass(/page-link-arrow--subtle/);
  await expect(boxArrow).toHaveClass(/page-link-arrow--prominent/);

  const weights = await page.evaluate(() => {
    // Chrome resolves color-mix() to `color(srgb r g b / a)` and plain
    // colors to `rgb(...)`/`rgba(...)`, so both shapes have to be read.
    const alpha = (color: string) => {
      const slash = color.match(/\/\s*([0-9.]+)\s*\)/);
      if (slash) return Number.parseFloat(slash[1]);
      const rgba = color.match(/rgba\(([^)]+)\)/);
      if (rgba) {
        const parts = rgba[1].split(",").map((v) => Number.parseFloat(v));
        return parts.length > 3 ? parts[3] : 1;
      }
      return 1;
    };
    const read = (selector: string) => {
      const element = document.querySelector(selector);
      if (!element) throw new Error(`Missing ${selector}`);
      const style = getComputedStyle(element);
      return {
        borderAlpha: alpha(style.borderTopColor),
        size: Number.parseFloat(style.width),
      };
    };
    return {
      row: read(".shop-detail-inventory-link"),
      box: read(".shop-detail-selected-link"),
    };
  });

  // The inline row arrow is the quieter of the two: a visibly lighter
  // outline and a smaller box.
  expect(weights.row.borderAlpha).toBeLessThan(weights.box.borderAlpha);
  expect(weights.row.size).toBeLessThan(weights.box.size);
});

test("both arrows loop the depart & return animation on hover and focus without shifting the box", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(shopUrl());

  for (const selector of [
    ".shop-detail-inventory-link",
    ".shop-detail-selected-link",
  ]) {
    const arrow = page.locator(selector).first();
    const glyph = arrow.locator(".page-link-arrow-glyph");
    // A complete, static arrow is always drawn -- three strokes, not a
    // shaft/head pair.
    await expect(arrow.locator("svg path")).toHaveCount(3);

    // Measure the BOX (not the glyph, which is expected to move) within its
    // own row: the inventory row has its own long-standing hover lift, and
    // that is not the arrow control moving.
    const boxWithinParent = () =>
      arrow.evaluate((element) => {
        const parent = element.closest(
          ".shop-detail-inventory-row, .shop-detail-selected-copy",
        );
        if (!parent) throw new Error("Expected an anchoring container");
        const a = element.getBoundingClientRect();
        const p = parent.getBoundingClientRect();
        return {
          width: a.width,
          height: a.height,
          left: a.left - p.left,
          top: a.top - p.top,
        };
      });

    const restAnimation = await glyph.evaluate(
      (element) => getComputedStyle(element).animationName,
    );
    const restBox = await boxWithinParent();

    await arrow.hover();
    await page.waitForTimeout(300);
    const hoverAnimation = await glyph.evaluate(
      (element) => getComputedStyle(element).animationName,
    );
    const hoverIterationCount = await glyph.evaluate(
      (element) => getComputedStyle(element).animationIterationCount,
    );
    const hoverBox = await boxWithinParent();

    // At rest nothing animates; hovering starts the infinite depart loop...
    expect(restAnimation).toBe("none");
    expect(hoverAnimation).toBe("page-link-arrow-depart");
    expect(hoverIterationCount).toBe("infinite");
    // ...and the box itself (clipped via overflow: hidden) never moves or
    // resizes within its row even though the glyph inside it does.
    expect(hoverBox.width).toBeCloseTo(restBox.width, 2);
    expect(hoverBox.height).toBeCloseTo(restBox.height, 2);
    expect(hoverBox.left).toBeCloseTo(restBox.left, 2);
    expect(hoverBox.top).toBeCloseTo(restBox.top, 2);

    // Pointer-out immediately drops the animation.
    await page.mouse.move(0, 0);
    await page.waitForTimeout(250);
    const afterUnhoverAnimation = await glyph.evaluate(
      (element) => getComputedStyle(element).animationName,
    );
    expect(afterUnhoverAnimation).toBe("none");

    // Keyboard focus drives the same loop.
    await arrow.focus();
    await page.waitForTimeout(300);
    const focusAnimation = await glyph.evaluate(
      (element) => getComputedStyle(element).animationName,
    );
    expect(focusAnimation).toBe("page-link-arrow-depart");
  }
});

test("under reduced motion the arrow never loops and stays fully operable", async ({
  browser,
}) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(shopUrl());

  for (const selector of [
    ".shop-detail-inventory-link",
    ".shop-detail-selected-link",
  ]) {
    const arrow = page.locator(selector).first();
    const glyph = arrow.locator(".page-link-arrow-glyph");

    const restAnimation = await glyph.evaluate(
      (element) => getComputedStyle(element).animationName,
    );
    expect(restAnimation).toBe("none");

    await arrow.hover();
    await page.waitForTimeout(250);
    const hoverAnimation = await glyph.evaluate(
      (element) => getComputedStyle(element).animationName,
    );
    // No looping departure animation under reduced motion.
    expect(hoverAnimation).toBe("none");

    // The glyph is not nudged either.
    const svgTransform = await glyph.evaluate(
      (element) => getComputedStyle(element).transform,
    );
    expect(svgTransform === "none" || svgTransform === "matrix(1, 0, 0, 1, 0, 0)").toBe(
      true,
    );
  }

  // Still fully operable.
  const arrow = page.locator(".shop-detail-inventory-link").first();
  await arrow.click();
  await expect(page).toHaveURL(`/items/${fixtures.item.slug}`);
  await context.close();
});

test("inventory rows reuse the Recipe Ingredients row language", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(shopUrl());

  const row = page.locator(".shop-detail-inventory-row").first();
  // The Recipe detail Ingredients row is the visual authority: same floor,
  // same tracks, same gap, same surface, same inset.
  const shape = await row.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      minHeight: style.minHeight,
      columns: style.gridTemplateColumns.split(" ").length,
      gap: style.columnGap,
      padding: `${style.paddingTop} ${style.paddingRight}`,
    };
  });
  expect(shape.minHeight).toBe("50px");
  // Marker / 32px stage / copy — and deliberately NO Recipe quantity column.
  expect(shape.columns).toBe(3);
  expect(shape.gap).toBe("10px");
  expect(shape.padding).toBe("8px 12px");

  // Shop-specific additions all survive the refactor.
  await expect(row.locator(".currency-price")).toHaveCount(1);
  await expect(row.locator(".shop-detail-inventory-link")).toHaveCount(1);
  await expect(
    row.getByRole("button", { name: /^Preview / }),
  ).toHaveCount(1);
});

test("the no-image fallback shares the real icon's footprint and stays readable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(shopUrl());

  const placeholder = page
    .locator(".shop-detail-inventory-icon .public-sprite-stage--empty")
    .first();
  await expect(placeholder).toHaveCount(1);
  // Same 32px footprint as a real icon, and no frame of its own: the Item
  // hue on the surrounding stage is the only treatment.
  await expect(placeholder).toHaveCSS("width", "32px");
  await expect(placeholder).toHaveCSS("height", "32px");
  await expect(placeholder).toHaveCSS("border-top-width", "0px");
  await expect(placeholder).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");

  // It still SAYS the image is missing, as real text rather than a
  // font-size: 0 hack.
  const fallback = placeholder.locator(".public-sprite-fallback");
  await expect(fallback).toHaveText(/No image/i);
  const size = await fallback.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).fontSize),
  );
  expect(size).toBeGreaterThan(0);
});
