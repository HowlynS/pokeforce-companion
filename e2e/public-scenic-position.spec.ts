// THE LANDING PAGE IS THE VISUAL AUTHORITY FOR GLOBAL SCENIC POSITION.
//
// Three specs guard the scenic layer, and they own different halves of it:
//
//   * public-shell-geometry.spec.ts -- where the layer sits in the page
//   * public-scenic-exposure.spec.ts -- how bright it is (the DIRECTORY
//     compositing stack is the authority there, and the landing page is a
//     documented exception with its own full-viewport wash)
//   * this spec -- how the photograph is CROPPED, where the landing page is
//     the authority and every other family inherits its coordinate system
//
// The invariant: every public page that renders the scenic layer crops the
// same photograph exactly as the landing page does. Concretely that means
// one asset, one `background-size`, one anchor percentage pair, and one
// DEPTH -- because the layer paints `background-size: cover`, so a layer of
// a different height scales and crops the same image differently even when
// every other declaration matches.
//
// Depth is precisely what used to differ, and it was the landing page that
// differed: `max(880px, 100vh)` against a content page's 760px desktop /
// 700px narrow. Everything else already agreed. That single difference is
// why the scene visibly moved between the landing page and anything opened
// from it.
//
// The assertions are computed-style and box geometry, never screenshots: a
// pixel test would fail on any art change, while the real contract is that
// every route resolves the landing page's own declarations.

import { expect, test } from "@playwright/test";
import {
  createE2ePublicShopFixtures,
  deleteE2eTestShopRecords,
  createE2ePublicLocationDirectoryFixtures,
  deleteE2ePublicLocationDirectoryFixtures,
} from "./helpers/database-cleanup";
import { requireSiteVisibility } from "./helpers/site-visibility";

requireSiteVisibility("PUBLIC");

const LANDING = "/";

/** Every public route that renders the shared scenic layer. */
const SCENIC_PAGES = [
  { name: "Items directory", route: "/items" },
  { name: "Recipes directory", route: "/recipes" },
  { name: "Professions directory", route: "/professions" },
  { name: "Classes directory", route: "/classes" },
  { name: "Locations directory", route: "/locations" },
  { name: "Shops directory", route: "/shops" },
  { name: "World", route: "/world" },
  { name: "Item detail", route: "/items/iron-ore" },
  { name: "Recipe detail", route: "/recipes/iron-sword" },
  { name: "Profession detail", route: "/professions/smithing" },
  { name: "Class detail", route: "/classes/artisan" },
  {
    name: "Location detail",
    route: "/locations/test-e2e-location-public-directory-region",
  },
  { name: "Shop detail", route: "/shops/test-e2e-shop-public-alpha" },
] as const;

// Desktop calibration widths plus the two narrow ones, because the landing
// page declares its own narrow depth too and copying only a desktop value
// would leave the mobile crop drifting.
const WIDTHS = [1920, 2560, 3440, 1000, 390] as const;

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

/**
 * Everything that decides WHICH PART of the photograph a viewer sees, and
 * nothing that decides how bright it is.
 */
async function readPosition(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const round = (value: number) => Math.round(value * 10) / 10;
    const layers = Array.from(
      document.querySelectorAll(".public-scenic-background")
    );
    const scenic = layers[0] as HTMLElement | undefined;
    if (!scenic) return null;
    const style = getComputedStyle(scenic);
    const box = scenic.getBoundingClientRect();
    const shell = document.querySelector(".public-site-shell")!;

    // The asset itself, with the host stripped: the contract is the file,
    // not the origin the test server happens to run on.
    const assets = (style.backgroundImage.match(/url\((?:"|')?[^)"']+(?:"|')?\)/g) ?? [])
      .map((entry) => entry.replace(/.*\/([^/)"']+)("|')?\)$/, "$1"));

    return {
      layerCount: layers.length,
      ownerIsShell: scenic.parentElement === shell,
      // Anchor: where the layer's own box starts.
      top: round(box.top),
      left: round(box.left),
      width: round(box.width),
      // Depth: the other half of the crop, since the layer paints `cover`.
      height: round(box.height),
      depth: style.getPropertyValue("--public-scenic-depth").trim(),
      contentDepthToken: getComputedStyle(document.documentElement)
        .getPropertyValue("--public-scenic-content-depth")
        .trim(),
      // Crop: the anchor percentages and the sizing mode.
      anchor: style.getPropertyValue("--public-scenic-position").trim(),
      backgroundPosition: style.backgroundPosition,
      backgroundSize: style.backgroundSize,
      backgroundRepeat: style.backgroundRepeat,
      assets,
      // Positioning context, so a family cannot re-anchor the layer itself.
      position: style.position,
      // `bottom` is deliberately excluded: the rule is `inset: 0 0 auto`, so
      // the used bottom value is derived from the SHELL's height, which is
      // page content and legitimately differs per route. Top/right/left are
      // the declared anchor.
      inset: `${style.top} ${style.right} ${style.left}`,
    };
  });
}

for (const width of WIDTHS) {
  test(`every scenic page inherits the landing page's crop at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1080 });

    const landingResponse = await page.goto(LANDING, {
      waitUntil: "domcontentloaded",
    });
    expect(landingResponse?.status(), "the landing page must render").toBe(200);
    const landing = await readPosition(page);
    expect(landing, "the landing page renders the scenic layer").not.toBeNull();

    for (const target of SCENIC_PAGES) {
      const response = await page.goto(target.route, {
        waitUntil: "domcontentloaded",
      });
      expect(response?.status(), `${target.name} must render`).toBe(200);
      const actual = await readPosition(page);
      const label = `${target.name} @${width}`;

      expect(actual, `${label}: renders a scenic layer`).not.toBeNull();

      // ---- One layer, owned by the shell ------------------------------
      expect(actual!.layerCount, `${label}: exactly one scenic layer`).toBe(1);
      expect(actual!.ownerIsShell, `${label}: the shell owns it`).toBe(true);
      expect(actual!.position, `${label}: positioning context`).toBe(
        landing!.position
      );
      expect(actual!.inset, `${label}: inset`).toBe(landing!.inset);

      // ---- Same asset --------------------------------------------------
      expect(actual!.assets, `${label}: same scenic asset(s)`).toEqual(
        landing!.assets
      );

      // ---- Same anchor -------------------------------------------------
      expect(actual!.top, `${label}: anchor top`).toBeCloseTo(landing!.top, 0);
      expect(actual!.left, `${label}: anchor left`).toBeCloseTo(
        landing!.left,
        0
      );
      expect(actual!.width, `${label}: anchor width`).toBeCloseTo(
        landing!.width,
        0
      );

      // ---- Same crop ---------------------------------------------------
      expect(
        actual!.anchor,
        `${label}: scenic anchor percentages must match the landing page`
      ).toBe(landing!.anchor);
      expect(actual!.backgroundPosition, `${label}: background-position`).toBe(
        landing!.backgroundPosition
      );
      expect(actual!.backgroundSize, `${label}: background-size`).toBe(
        landing!.backgroundSize
      );
      expect(actual!.backgroundRepeat, `${label}: background-repeat`).toBe(
        landing!.backgroundRepeat
      );

      // ---- Same DEPTH, which is the other half of the crop -------------
      expect(
        actual!.depth,
        `${label}: scenic depth must be the landing page's own -- a ` +
          `different depth crops the same photograph differently under ` +
          `background-size: cover`
      ).toBe(landing!.depth);
      expect(actual!.height, `${label}: rendered depth`).toBeCloseTo(
        landing!.height,
        0
      );
      expect(
        actual!.contentDepthToken,
        `${label}: reads the shared depth token`
      ).toBe(landing!.contentDepthToken);
    }
  });
}

test("the shared depth token IS the landing page's depth, at every breakpoint", async ({
  page,
}) => {
  // The direction of the rule, stated as a test: the landing page must not
  // declare a depth of its own any more, because the shared token carries
  // its value. If someone re-adds a private landing depth, the token stops
  // being the authority and this fails.
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 1080 });
    await page.goto(LANDING, { waitUntil: "domcontentloaded" });

    const landing = await readPosition(page);
    expect(
      landing!.depth,
      `@${width}: the landing page resolves the shared token`
    ).toBe(landing!.contentDepthToken);
    expect(
      landing!.height,
      `@${width}: and renders it`
    ).toBeGreaterThan(0);
  }
});

test("Recipe detail carries no scenic position override of its own", async ({
  page,
}) => {
  // Recipe detail was the family that most recently held private scenic
  // overrides, so it gets its own named guard: nothing on the page may
  // re-declare the crop.
  await page.setViewportSize({ width: 1920, height: 1080 });

  await page.goto("/recipes", { waitUntil: "domcontentloaded" });
  const directory = await readPosition(page);

  await page.goto("/recipes/iron-sword", { waitUntil: "domcontentloaded" });
  const detail = await readPosition(page);

  expect(detail!.anchor, "same anchor as its own directory").toBe(
    directory!.anchor
  );
  expect(detail!.depth, "same depth as its own directory").toBe(
    directory!.depth
  );
  expect(detail!.height, "same rendered depth").toBeCloseTo(
    directory!.height,
    0
  );

  // ...and the identity hook carries no depth, anchor or sizing of its own.
  const overrides = await page.evaluate(() => {
    const scenic = document.querySelector<HTMLElement>(
      ".public-scenic-background--detail"
    );
    if (!scenic) return null;
    // Inline style is how the Appearance workspace publishes a per-surface
    // crop; anything else on this element would be a hardcoded override.
    return {
      inlineStyle: scenic.getAttribute("style") ?? "",
      hasDetailClass: true,
    };
  });
  expect(overrides, "the detail identity hook exists").not.toBeNull();
  expect(
    overrides!.inlineStyle,
    "the only inline scenic values are the Appearance workspace's own " +
      "published position variables"
  ).not.toMatch(/--public-scenic-depth|background-size|background-image/);
});
