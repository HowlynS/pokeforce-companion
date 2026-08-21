// Canonical public SCENIC EXPOSURE.
//
// public-shell-geometry.spec.ts guards where the scenic layer sits. This spec
// guards how bright it is.
//
// The invariant: every public page that renders the scenic layer composites
// it identically -- same wash, same vignette, same image, same opacity, no
// filter, no blend mode. A resource family may tint LOCALLY through
// .resource-atmosphere (a contained, hero-sized hue wash). It may not darken
// the scenic page merely because it is a detail route.
//
// This exists because detail pages spent a release visibly darker than the
// directories they were opened from: .public-scenic-background--catalogue
// re-declared the whole `background-image` (its own stops plus a radial
// vignette) while --detail overrode two wash custom properties and silently
// inherited the base rule's much heavier stack. Nothing about that was
// visible in either rule on its own, which is why this guard compares the
// COMPOSITED result across page families rather than reading one variant.
//
// The assertions are structural/computed-style, not pixel colours: a pixel
// test would fail on any art change, while the real contract is that the two
// families resolve the same declarations.

import { expect, test } from "@playwright/test";
import {
  createE2ePublicShopFixtures,
  deleteE2eTestShopRecords,
  createE2ePublicLocationDirectoryFixtures,
  deleteE2ePublicLocationDirectoryFixtures,
} from "./helpers/database-cleanup";
import { requireSiteVisibility } from "./helpers/site-visibility";

requireSiteVisibility("PUBLIC");

type ScenicPage = {
  name: string;
  route: string;
  family: "directory" | "detail";
};

// Both families, across every redesigned scenic resource. The landing page is
// deliberately absent: it is a documented exception with its own full-viewport
// hero composition (see DESIGN_DIRECTIONS.md).
const PAGES: ScenicPage[] = [
  { name: "Recipes directory", route: "/recipes", family: "directory" },
  { name: "Items directory", route: "/items", family: "directory" },
  { name: "Professions directory", route: "/professions", family: "directory" },
  { name: "Classes directory", route: "/classes", family: "directory" },
  { name: "Locations directory", route: "/locations", family: "directory" },
  { name: "Shops directory", route: "/shops", family: "directory" },
  { name: "World", route: "/world", family: "directory" },
  { name: "Recipe detail", route: "/recipes/iron-sword", family: "detail" },
  { name: "Item detail", route: "/items/iron-ore", family: "detail" },
  {
    name: "Profession detail",
    route: "/professions/smithing",
    family: "detail",
  },
  { name: "Class detail", route: "/classes/artisan", family: "detail" },
  {
    name: "Location detail",
    route: "/locations/test-e2e-location-public-directory-region",
    family: "detail",
  },
  {
    name: "Shop detail",
    route: "/shops/test-e2e-shop-public-alpha",
    family: "detail",
  },
];

const WIDTHS = [1920, 2560, 3440] as const;

let pageErrors: string[] = [];

test.beforeAll(async () => {
  await createE2ePublicShopFixtures();
  await createE2ePublicLocationDirectoryFixtures();
});

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(() => {
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

test.afterAll(async () => {
  await deleteE2ePublicLocationDirectoryFixtures();
  await deleteE2eTestShopRecords();
});

/** Entrance animations resolve to opacity 1; read the settled page. */
async function settleAnimations(page: import("@playwright/test").Page) {
  await page.evaluate(async () => {
    await Promise.all(
      document
        .getAnimations()
        .map((animation) => animation.finished.catch(() => undefined))
    );
  });
}

async function readExposure(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const scenic = document.querySelector(".public-scenic-background");
    if (!scenic) return null;
    const style = getComputedStyle(scenic);
    const viewportWidth = document.documentElement.clientWidth;

    // Anything large enough to act as a page-wide dark overlay ON TOP of the
    // scenic layer. A resource atmosphere is hero-sized and paints hue, not
    // black, so it must not appear here.
    const pageWideOverlays: string[] = [];
    document.querySelectorAll("*").forEach((element) => {
      if (element.classList.contains("public-scenic-background")) return;
      const box = element.getBoundingClientRect();
      if (box.width < viewportWidth * 0.6 || box.height < 400) return;
      // The shared catalogue entrance animation (.cx-item-in) starts at
      // opacity 0 and resolves to 1. A frame captured mid-flight is not a
      // dimming layer, so an element with a running animation is skipped
      // rather than reported -- the test settles animations first anyway,
      // and this keeps a slow machine from reading the same false positive.
      if (
        element.getAnimations().some((animation) => animation.playState === "running")
      ) {
        return;
      }
      const elementStyle = getComputedStyle(element);
      const paintsGradient =
        elementStyle.backgroundImage !== "none" &&
        /gradient/.test(elementStyle.backgroundImage);
      const dims =
        elementStyle.mixBlendMode === "multiply" ||
        elementStyle.mixBlendMode === "darken" ||
        elementStyle.filter !== "none" ||
        (elementStyle.opacity !== "" && Number(elementStyle.opacity) < 1);
      if (paintsGradient || dims) {
        pageWideOverlays.push(
          `${element.className || element.tagName}` +
            ` bg=${elementStyle.backgroundImage.slice(0, 40)}` +
            ` blend=${elementStyle.mixBlendMode}` +
            ` filter=${elementStyle.filter}` +
            ` opacity=${elementStyle.opacity}`
        );
      }
    });

    const atmosphere = document.querySelector(".resource-atmosphere");
    const atmosphereBox = atmosphere?.getBoundingClientRect() ?? null;

    return {
      // The whole composited stack, normalised for whitespace. Local asset
      // URLs are stripped so the contract is the OVERLAY recipe, not the
      // host the test server happens to run on.
      backgroundImage: style.backgroundImage
        .replace(/url\(("|')?[^)"']*?([^/)"']+)("|')?\)/g, "url($2)")
        .replace(/\s+/g, " ")
        .trim(),
      backgroundSize: style.backgroundSize,
      opacity: style.opacity,
      filter: style.filter,
      mixBlendMode: style.mixBlendMode,
      backgroundColor: style.backgroundColor,
      washTop: style.getPropertyValue("--public-scenic-wash-top").trim(),
      washMiddle: style.getPropertyValue("--public-scenic-wash-middle").trim(),
      vignetteLeft: style
        .getPropertyValue("--public-scenic-vignette-left")
        .trim(),
      vignetteCenter: style
        .getPropertyValue("--public-scenic-vignette-center")
        .trim(),
      shellBackground: getComputedStyle(
        document.querySelector(".public-site-shell")!
      ).backgroundColor,
      pageWideOverlays,
      atmosphere: atmosphereBox
        ? {
            height: Math.round(atmosphereBox.height),
            viewportHeight: document.documentElement.clientHeight,
            image: getComputedStyle(atmosphere!)
              .getPropertyValue("--resource-atmosphere-image")
              .replace(/\s+/g, " ")
              .trim(),
          }
        : null,
    };
  });
}

for (const width of WIDTHS) {
  test(`every scenic public page shares one exposure at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1080 });

    const exposures = new Map<
      string,
      Awaited<ReturnType<typeof readExposure>>
    >();
    for (const target of PAGES) {
      const response = await page.goto(target.route, {
        waitUntil: "domcontentloaded",
      });
      expect(response?.status(), `${target.name} must render`).toBe(200);
      await settleAnimations(page);
      const exposure = await readExposure(page);
      expect(exposure, `${target.name} renders a scenic layer`).not.toBeNull();
      exposures.set(target.name, exposure);
    }

    // Directories are the approved exposure authority.
    const reference = exposures.get("Recipes directory")!;

    for (const target of PAGES) {
      const exposure = exposures.get(target.name)!;
      const label = `${target.name} @${width}`;

      // ---- One composited overlay recipe -----------------------------
      expect(
        exposure.backgroundImage,
        `${label}: scenic compositing stack must match the directory ` +
          `reference. A page family may tint locally through ` +
          `.resource-atmosphere; it may not re-declare the scenic wash, ` +
          `vignette, or image.`
      ).toBe(reference.backgroundImage);
      expect(exposure.backgroundSize, `${label}: scenic size mode`).toBe(
        reference.backgroundSize
      );

      // ---- One set of exposure tokens --------------------------------
      expect(exposure.washTop, `${label}: wash top`).toBe(reference.washTop);
      expect(exposure.washMiddle, `${label}: wash middle`).toBe(
        reference.washMiddle
      );
      expect(exposure.vignetteLeft, `${label}: vignette edge`).toBe(
        reference.vignetteLeft
      );
      expect(exposure.vignetteCenter, `${label}: vignette centre`).toBe(
        reference.vignetteCenter
      );

      // ---- No per-family dimming -------------------------------------
      expect(exposure.opacity, `${label}: scenic opacity`).toBe("1");
      expect(exposure.filter, `${label}: no scenic filter`).toBe("none");
      expect(exposure.mixBlendMode, `${label}: no scenic blend mode`).toBe(
        "normal"
      );
      expect(
        exposure.backgroundColor,
        `${label}: the scenic layer paints no flat ground of its own`
      ).toBe(reference.backgroundColor);
      expect(exposure.shellBackground, `${label}: page ground`).toBe(
        reference.shellBackground
      );

      // ---- Nothing blankets the scenic layer -------------------------
      expect(
        exposure.pageWideOverlays,
        `${label}: no page-wide gradient, blend, filter or opacity may sit ` +
          `over the scenic layer`
      ).toEqual([]);
    }
  });
}

test("resource atmosphere stays local and tints rather than darkens", async ({
  page,
}) => {
  // Resource identity is preserved -- this asserts it is CONTAINED, which is
  // the other half of "one scenic exposure": a hue wash that grew to cover
  // the page would darken it just as effectively as a scenic override.
  await page.setViewportSize({ width: 1920, height: 1080 });

  const atmosphericPages = [
    { name: "Recipe detail", route: "/recipes/iron-sword" },
    { name: "Item detail", route: "/items/iron-ore" },
    { name: "Profession detail", route: "/professions/smithing" },
  ];

  const hues = new Set<string>();
  for (const target of atmosphericPages) {
    await page.goto(target.route, { waitUntil: "domcontentloaded" });
    await settleAnimations(page);
    const exposure = await readExposure(page);
    expect(
      exposure!.atmosphere,
      `${target.name} still carries its resource atmosphere`
    ).not.toBeNull();

    // Hero-sized, never a full-page blanket.
    expect(
      exposure!.atmosphere!.height,
      `${target.name}: atmosphere stays a hero-scale layer`
    ).toBeLessThan(exposure!.atmosphere!.viewportHeight * 0.5);

    // It tints with the resource hue and paints no black of its own.
    expect(
      exposure!.atmosphere!.image,
      `${target.name}: atmosphere paints a hue, never a dark wash`
    ).not.toMatch(/rgba?\(\s*(0|17)\s*,\s*(0|21)\s*,\s*(0|20)\s*[,)]/);
    expect(
      exposure!.atmosphere!.image,
      `${target.name}: atmosphere is a real gradient`
    ).toMatch(/gradient/);

    hues.add(exposure!.atmosphere!.image);
  }

  // Resource identity is still distinct per family, not flattened.
  expect(
    hues.size,
    "each resource family keeps its own atmosphere hue"
  ).toBe(atmosphericPages.length);
});
