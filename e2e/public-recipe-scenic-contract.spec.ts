// Recipe detail's share of the GLOBAL public scenic/page contract.
//
// public-shell-geometry.spec.ts guards where the scenic layer sits and
// public-scenic-exposure.spec.ts guards how bright it is, both across every
// page family. This spec is narrower and blunter: it pins RECIPE DETAIL, the
// last family to still own private overrides of the shared shell, against
// two known-good references — the Recipes directory it is opened from, and
// Item detail, the reference resource page.
//
// The drift it exists to catch is specific and had two parts:
//
//   * `.recipe-detail-page .item-content-grid { display: block }` plus a
//     rule hiding the information column outright, which made Recipe the one
//     detail page whose main column ran the FULL page width — so its hero,
//     its resource atmosphere and the scenic backdrop behind them sat on a
//     different horizontal coordinate system from every other resource page;
//   * `body:has(.recipe-detail-page) .public-site-footer { display: none }`,
//     which deleted part of the shared shell for this route alone.
//
// The assertions are computed-style and box-geometry contracts, never
// screenshots: a pixel test would fail on any art change, while the real
// contract is that the three routes resolve the same declarations and the
// same origins.

import { expect, test } from "@playwright/test";
import { requireSiteVisibility } from "./helpers/site-visibility";

requireSiteVisibility("PUBLIC");

const RECIPE_DIRECTORY = "/recipes";
const RECIPE_DETAIL = "/recipes/iron-sword";
const ITEM_DETAIL = "/items/iron-ore";

const WIDTHS = [1920, 2560, 3440] as const;

let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(() => {
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

async function readScenicContract(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const round = (value: number) => Math.round(value * 10) / 10;
    const scenicLayers = Array.from(
      document.querySelectorAll(".public-scenic-background")
    );
    const scenic = scenicLayers[0] as HTMLElement | undefined;
    const scenicStyle = scenic ? getComputedStyle(scenic) : null;
    const scenicBox = scenic?.getBoundingClientRect() ?? null;
    const shell = document.querySelector(".public-site-shell")!;
    const main = document.querySelector(".public-site-main")!;
    const mainStyle = getComputedStyle(main);
    const frame = document.querySelector(
      ".public-detail-page, .directory-page, .public-page-frame"
    )!;
    const footer = document.querySelector(".public-site-footer");

    // Any element large enough to act as a page-wide dark or offset layer
    // over the scenic backdrop. A resource atmosphere is hero-sized, so it
    // must never turn up here.
    const viewportWidth = document.documentElement.clientWidth;
    const pageWideLayers: string[] = [];
    document.querySelectorAll("*").forEach((element) => {
      if (element.classList.contains("public-scenic-background")) return;
      const box = element.getBoundingClientRect();
      if (box.width < viewportWidth * 0.6 || box.height < 400) return;
      if (
        element
          .getAnimations()
          .some((animation) => animation.playState === "running")
      ) {
        return;
      }
      const style = getComputedStyle(element);
      const paintsGradient =
        style.backgroundImage !== "none" && /gradient/.test(style.backgroundImage);
      const dims =
        style.mixBlendMode === "multiply" ||
        style.mixBlendMode === "darken" ||
        style.filter !== "none" ||
        (style.opacity !== "" && Number(style.opacity) < 1);
      if (paintsGradient || dims) {
        pageWideLayers.push(String(element.className || element.tagName));
      }
    });

    return {
      // ---- The global scenic anchor -----------------------------------
      scenicLayerCount: scenicLayers.length,
      scenicOwnerIsShell: scenic?.parentElement === shell,
      scenicTop: scenicBox ? round(scenicBox.top) : null,
      scenicLeft: scenicBox ? round(scenicBox.left) : null,
      scenicWidth: scenicBox ? round(scenicBox.width) : null,
      scenicHeight: scenicBox ? round(scenicBox.height) : null,
      scenicPosition: scenicStyle?.position ?? null,

      // ---- The global exposure owner ----------------------------------
      backgroundImage:
        scenicStyle?.backgroundImage
          .replace(/url\(("|')?[^)"']*?([^/)"']+)("|')?\)/g, "url($2)")
          .replace(/\s+/g, " ")
          .trim() ?? null,
      backgroundPosition: scenicStyle?.backgroundPosition ?? null,
      backgroundSize: scenicStyle?.backgroundSize ?? null,
      opacity: scenicStyle?.opacity ?? null,
      filter: scenicStyle?.filter ?? null,
      mixBlendMode: scenicStyle?.mixBlendMode ?? null,

      // ---- The page origin --------------------------------------------
      mainPaddingTop: mainStyle.paddingTop,
      frameLeft: round(frame.getBoundingClientRect().left),
      frameWidth: round(frame.getBoundingClientRect().width),

      // ---- The shared shell is intact ---------------------------------
      hasFooter: footer !== null,
      footerDisplay: footer ? getComputedStyle(footer).display : null,

      pageWideLayers,
    };
  });
}

for (const width of WIDTHS) {
  test(`Recipe detail shares the global scenic contract at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1080 });

    const readings = new Map<
      string,
      Awaited<ReturnType<typeof readScenicContract>>
    >();
    for (const route of [RECIPE_DIRECTORY, RECIPE_DETAIL, ITEM_DETAIL]) {
      const response = await page.goto(route, {
        waitUntil: "domcontentloaded",
      });
      expect(response?.status(), `${route} must render`).toBe(200);
      await page.evaluate(async () => {
        await Promise.all(
          document
            .getAnimations()
            .map((animation) => animation.finished.catch(() => undefined))
        );
      });
      readings.set(route, await readScenicContract(page));
    }

    // The Recipes DIRECTORY is the approved reference — it is the page a
    // visitor opens a Recipe from, so a mismatch is visible as a jump.
    const reference = readings.get(RECIPE_DIRECTORY)!;

    for (const route of [RECIPE_DETAIL, ITEM_DETAIL]) {
      const actual = readings.get(route)!;
      const label = `${route} @${width}`;

      // ---- Exactly one scenic layer, anchored to the shell -------------
      expect(
        actual.scenicLayerCount,
        `${label}: one scenic layer, no second private one`
      ).toBe(1);
      expect(
        actual.scenicOwnerIsShell,
        `${label}: the shell owns the scenic layer`
      ).toBe(true);
      expect(actual.scenicPosition, `${label}: scenic positioning`).toBe(
        reference.scenicPosition
      );
      expect(actual.scenicTop, `${label}: scenic anchor top`).toBeCloseTo(
        reference.scenicTop!,
        0
      );
      expect(actual.scenicLeft, `${label}: scenic anchor left`).toBeCloseTo(
        reference.scenicLeft!,
        0
      );
      expect(actual.scenicWidth, `${label}: scenic extent width`).toBeCloseTo(
        reference.scenicWidth!,
        0
      );
      expect(actual.scenicHeight, `${label}: scenic extent depth`).toBeCloseTo(
        reference.scenicHeight!,
        0
      );

      // ---- One exposure owner, one composited stack --------------------
      expect(actual.backgroundImage, `${label}: scenic image stack`).toBe(
        reference.backgroundImage
      );
      expect(actual.backgroundPosition, `${label}: scenic crop`).toBe(
        reference.backgroundPosition
      );
      expect(actual.backgroundSize, `${label}: scenic size mode`).toBe(
        reference.backgroundSize
      );
      expect(actual.opacity, `${label}: no scenic opacity of its own`).toBe("1");
      expect(actual.filter, `${label}: no scenic filter`).toBe("none");
      expect(actual.mixBlendMode, `${label}: no scenic blend mode`).toBe(
        "normal"
      );

      // ---- One page origin ---------------------------------------------
      expect(actual.mainPaddingTop, `${label}: page top origin`).toBe(
        reference.mainPaddingTop
      );
      expect(actual.frameLeft, `${label}: page left origin`).toBeCloseTo(
        reference.frameLeft,
        0
      );
      expect(actual.frameWidth, `${label}: page frame width`).toBeCloseTo(
        reference.frameWidth,
        0
      );

      // ---- Nothing page-wide sits over the scenic layer ----------------
      expect(
        actual.pageWideLayers,
        `${label}: no page-wide dark or offset scenic layer`
      ).toEqual([]);

      // ---- The shared shell is not partly deleted ----------------------
      expect(actual.hasFooter, `${label}: the site footer still renders`).toBe(
        true
      );
      expect(
        actual.footerDisplay,
        `${label}: the site footer is not hidden for this route`
      ).not.toBe("none");
    }
  });
}

test("Recipe detail's main column shares Item detail's content coordinates", async ({
  page,
}) => {
  // The concrete shape of the old drift: Recipe rendered no information
  // column, so its main content ran the full page width while every other
  // detail page's stopped at the sidebar edge. Equal main-column boxes are
  // what put the hero, its atmosphere and the scenery behind them back on
  // one coordinate system.
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 1080 });

    const boxes = new Map<string, { left: number; width: number; heroLeft: number; heroWidth: number }>();
    for (const route of [RECIPE_DETAIL, ITEM_DETAIL]) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      boxes.set(
        route,
        await page.evaluate(() => {
          const round = (value: number) => Math.round(value * 10) / 10;
          const main = document
            .querySelector(".public-detail-main, .item-main-column")!
            .getBoundingClientRect();
          const hero = document
            .querySelector(".resource-atmosphere")!
            .getBoundingClientRect();
          return {
            left: round(main.left),
            width: round(main.width),
            heroLeft: round(hero.left),
            heroWidth: round(hero.width),
          };
        })
      );
    }

    const recipe = boxes.get(RECIPE_DETAIL)!;
    const item = boxes.get(ITEM_DETAIL)!;
    const label = `@${width}`;

    expect(recipe.left, `${label}: main column left`).toBeCloseTo(item.left, 0);
    expect(recipe.width, `${label}: main column width`).toBeCloseTo(
      item.width,
      0
    );
    // The atmosphere's extent is the hero's own box, so an equal hero box is
    // what keeps Recipe's hue wash from falling across a different part of
    // the page than every other family's.
    expect(recipe.heroLeft, `${label}: hero left`).toBeCloseTo(item.heroLeft, 0);
    expect(recipe.heroWidth, `${label}: hero extent`).toBeCloseTo(
      item.heroWidth,
      0
    );
  }
});
