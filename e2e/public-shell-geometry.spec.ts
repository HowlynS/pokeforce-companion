// Canonical public PAGE FRAME geometry.
//
// public-detail-geometry.spec.ts guards the frame the six detail families
// share with each OTHER. This spec guards the frame every public page family
// shares -- detail pages, directories, World and Search alike.
//
// The invariant: a page family owns its content structure, its resource hue
// and its inner grid widths. It does NOT get to redefine where the page
// starts. Concretely, at one viewport every public page must agree on
//
//   * the left origin  -- content is flush with the header card's own box
//   * the top origin   -- the same distance under that header card
//   * the breadcrumb   -- same size, same leading, same Y
//   * the first block  -- hero or directory title, same Y
//   * the scenic layer -- same anchor, same size mode, same depth
//
// It deliberately does NOT assert content-driven geometry: how tall a hero
// runs, how many rows a catalogue holds, or how wide an inner grid is are all
// page-family decisions and legitimately differ.
//
// If this spec fails, a page family has almost certainly reintroduced a
// private copy of a shared measurement. Fix the shared token, not the page.

import { expect, test } from "@playwright/test";
import {
  createE2ePublicShopFixtures,
  deleteE2eTestShopRecords,
  createE2ePublicLocationDirectoryFixtures,
  deleteE2ePublicLocationDirectoryFixtures,
} from "./helpers/database-cleanup";
import { requireSiteVisibility } from "./helpers/site-visibility";

requireSiteVisibility("PUBLIC");

type PublicPage = {
  name: string;
  route: string;
  /** Pages that render the shared scenic layer. */
  scenic: boolean;
  /** Pages that render a breadcrumb and a first block beneath it. */
  breadcrumb: boolean;
};

// Both families, plus the two page types that historically drifted on their
// own: World (bounded inner scrolling) and Search (no scenic layer at all).
const PAGES: PublicPage[] = [
  {
    name: "Detail Recipe",
    route: "/recipes/iron-sword",
    scenic: true,
    breadcrumb: true,
  },
  {
    name: "Detail Location",
    route: "/locations/test-e2e-location-public-directory-region",
    scenic: true,
    breadcrumb: true,
  },
  { name: "Directory Recipes", route: "/recipes", scenic: true, breadcrumb: true },
  { name: "Directory Items", route: "/items", scenic: true, breadcrumb: true },
  {
    name: "Directory Professions",
    route: "/professions",
    scenic: true,
    breadcrumb: true,
  },
  {
    name: "Directory Locations",
    route: "/locations",
    scenic: true,
    breadcrumb: true,
  },
  { name: "Directory Shops", route: "/shops", scenic: true, breadcrumb: true },
  { name: "World", route: "/world", scenic: true, breadcrumb: true },
  // Search deliberately renders no scenic layer, but it is still a public
  // page and still shares the top and left origins.
  { name: "Search", route: "/search?q=iron", scenic: false, breadcrumb: false },
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

async function readShell(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const round = (value: number | null | undefined) =>
      value === null || value === undefined ? null : Math.round(value * 10) / 10;
    const el = (selector: string) => document.querySelector(selector);
    const rect = (selector: string) =>
      el(selector)?.getBoundingClientRect() ?? null;
    const firstRect = (selectors: string[]) => {
      for (const selector of selectors) {
        const found = rect(selector);
        if (found) return found;
      }
      return null;
    };

    const headerCard = rect(".public-site-header-inner");
    const main = el(".public-site-main");
    const breadcrumb = rect(".public-breadcrumb");
    const breadcrumbList = el(".public-breadcrumb ol");
    // The first meaningful block under the breadcrumb: a detail hero, or a
    // directory's own title. WHICH one it is, is page structure; WHERE it
    // starts is page frame.
    const firstBlock = firstRect([
      ".directory-title",
      ".item-identity-panel",
      ".profession-detail-hero",
      ".shop-detail-hero",
      ".location-detail-hero",
      ".public-detail-layout",
    ]);
    const scenic = el(".public-scenic-background");
    const scenicStyle = scenic ? getComputedStyle(scenic) : null;
    const scenicRect = scenic?.getBoundingClientRect() ?? null;

    return {
      headerCardLeft: round(headerCard?.left),
      headerBottom: round(rect(".public-site-header")?.bottom),
      mainPaddingTop: main ? getComputedStyle(main).paddingTop : null,
      breadcrumbTop: round(breadcrumb?.top),
      breadcrumbLeft: round(breadcrumb?.left),
      breadcrumbFontSize: breadcrumbList
        ? getComputedStyle(breadcrumbList).fontSize
        : null,
      breadcrumbLineHeight: breadcrumbList
        ? getComputedStyle(breadcrumbList).lineHeight
        : null,
      firstBlockTop: round(firstBlock?.top),
      firstBlockLeft: round(firstBlock?.left),
      // Every page family's own content root, whichever it is. This is what
      // must share ONE left edge with the header card.
      frameLeft: round(
        firstRect([
          ".public-detail-page",
          ".directory-page",
          ".public-page-frame",
        ])?.left
      ),
      scenicHeight: round(scenicRect?.height),
      scenicPosition: scenicStyle?.backgroundPosition ?? null,
      scenicSize: scenicStyle?.backgroundSize ?? null,
      scenicTop: round(scenicRect?.top),
      // The scenic layer must hang off the page SHELL, never off a content
      // wrapper whose height the page's own records determine.
      scenicOwnedByShell: scenic
        ? scenic.parentElement?.classList.contains("public-site-shell") === true
        : null,
      overflows:
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    };
  });
}

for (const width of WIDTHS) {
  test(`every public page family shares one page frame at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1080 });

    const shells = new Map<string, Awaited<ReturnType<typeof readShell>>>();
    for (const target of PAGES) {
      const response = await page.goto(target.route, {
        waitUntil: "domcontentloaded",
      });
      expect(response?.status(), `${target.name} must render`).toBe(200);
      shells.set(target.name, await readShell(page));
    }

    // Detail pages are the documented authority for the page frame.
    const reference = shells.get("Detail Recipe")!;

    for (const target of PAGES) {
      const shell = shells.get(target.name)!;
      const label = `${target.name} @${width}`;

      // ---- One horizontal origin -------------------------------------
      // Content sits flush with the header card's own box. This is the
      // drift that put a directory breadcrumb a whole gutter (28px at
      // 1920) right of a detail breadcrumb on the same viewport.
      expect(shell.headerCardLeft, `${label}: header card left`).toBeCloseTo(
        reference.headerCardLeft!,
        0
      );
      // The page's own content root -- detail article, directory wrapper, or
      // Search's frame -- is flush with that card. Search has no breadcrumb
      // and no scenic layer, but it shares this origin like everything else.
      expect(
        shell.frameLeft,
        `${label}: content root is flush with the header card`
      ).toBeCloseTo(shell.headerCardLeft!, 0);

      // ---- One top origin --------------------------------------------
      expect(shell.headerBottom, `${label}: header bottom`).toBeCloseTo(
        reference.headerBottom!,
        0
      );
      expect(
        shell.mainPaddingTop,
        `${label}: page top origin must be --public-page-top`
      ).toBe(reference.mainPaddingTop);

      if (target.breadcrumb) {
        // ---- One breadcrumb treatment --------------------------------
        expect(
          shell.breadcrumbLeft,
          `${label}: breadcrumb left origin`
        ).toBeCloseTo(reference.breadcrumbLeft!, 0);
        // ...and it is the header card's own edge, not merely equal to
        // some other page's mistake.
        expect(
          shell.breadcrumbLeft,
          `${label}: breadcrumb is flush with the header card`
        ).toBeCloseTo(shell.headerCardLeft!, 0);
        expect(shell.breadcrumbTop, `${label}: breadcrumb top`).toBeCloseTo(
          reference.breadcrumbTop!,
          0
        );
        expect(shell.breadcrumbFontSize, `${label}: breadcrumb font`).toBe(
          reference.breadcrumbFontSize
        );
        expect(
          shell.breadcrumbLineHeight,
          `${label}: breadcrumb line-height`
        ).toBe(reference.breadcrumbLineHeight);

        // ---- One first-block rhythm ----------------------------------
        // A directory title and a detail hero are different content; they
        // start at the same Y and the same X.
        expect(shell.firstBlockTop, `${label}: first block top`).toBeCloseTo(
          reference.firstBlockTop!,
          0
        );
        expect(shell.firstBlockLeft, `${label}: first block left`).toBeCloseTo(
          reference.firstBlockLeft!,
          0
        );
      }

      // ---- One scenic coordinate system ------------------------------
      if (target.scenic) {
        // The anchor comes from two places: this variant's CSS default, and
        // the per-surface position an admin may publish through Appearance.
        // Both must agree across surfaces -- a page type that anchors the
        // shared photograph differently makes the scene move between page
        // families, which is exactly what this pass removed.
        expect(
          shell.scenicPosition,
          `${label}: scenic anchor must match the other scenic pages. If this ` +
            `fails after an Appearance change, the published catalogue/home/` +
            `itemDetail positions have diverged; realign them rather than ` +
            `relaxing this assertion.`
        ).toBe(reference.scenicPosition);
        expect(shell.scenicSize, `${label}: scenic size mode`).toBe(
          reference.scenicSize
        );
        // Depth is part of the coordinate system: `cover` crops the same
        // photograph differently in boxes of different heights, so a page
        // family with its own depth makes the scene appear to move.
        expect(shell.scenicHeight, `${label}: scenic depth`).toBeCloseTo(
          reference.scenicHeight!,
          0
        );
        expect(shell.scenicTop, `${label}: scenic top offset`).toBeCloseTo(
          reference.scenicTop!,
          0
        );
        expect(
          shell.scenicOwnedByShell,
          `${label}: the scenic layer hangs off the page shell`
        ).toBe(true);
      } else {
        expect(
          shell.scenicHeight,
          `${label}: renders no scenic layer by design`
        ).toBeNull();
      }

      expect(shell.overflows, `${label}: no horizontal overflow`).toBe(false);
    }
  });
}

test("the shared shell owns the page frame, not the page families", async ({
  page,
}) => {
  // Checks the live cascade rather than parsing CSS: the shared tokens must
  // be what actually resolves on each family's own page.
  await page.setViewportSize({ width: 1920, height: 1080 });

  for (const route of ["/recipes/iron-sword", "/recipes", "/items"]) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    const tokens = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const main = getComputedStyle(
        document.querySelector(".public-site-main")!
      );
      const headerCard = getComputedStyle(
        document.querySelector(".public-site-header-inner")!
      );
      return {
        pageTop: root.getPropertyValue("--public-page-top").trim(),
        gutter: root.getPropertyValue("--public-page-gutter").trim(),
        breadcrumbFont: root
          .getPropertyValue("--public-breadcrumb-font-size")
          .trim(),
        breadcrumbSpace: root
          .getPropertyValue("--public-breadcrumb-space")
          .trim(),
        scenicDepth: root
          .getPropertyValue("--public-scenic-content-depth")
          .trim(),
        // The page's own top padding must BE the token, not a copy of it.
        resolvedPaddingTop: main.paddingTop,
        // ...and the detail alias must resolve to the same gutter, so the
        // shared breakout stays exact at every width.
        detailGutter: root.getPropertyValue("--detail-gutter").trim(),
        headerCardPadding: headerCard.paddingLeft,
      };
    });

    expect(tokens.pageTop, `${route}: --public-page-top`).not.toBe("");
    expect(
      tokens.resolvedPaddingTop,
      `${route}: page top origin must resolve to --public-page-top`
    ).toBe(tokens.pageTop);
    expect(tokens.breadcrumbFont, `${route}: breadcrumb token`).toBe("12.5px");
    expect(tokens.breadcrumbSpace, `${route}: breadcrumb space token`).toBe(
      "20px"
    );
    expect(tokens.scenicDepth, `${route}: scenic depth token`).toBe("760px");
    expect(
      tokens.detailGutter,
      `${route}: --detail-gutter must resolve to --public-page-gutter`
    ).toBe(tokens.gutter);
  }
});
