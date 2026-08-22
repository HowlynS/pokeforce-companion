// Canonical public detail-page geometry.
//
// Every public resource detail page renders inside ONE shared shell
// (.public-detail-page and friends, driven by the --detail-* tokens). This
// spec is the guard that keeps it that way: it loads every detail family at
// the calibration widths and asserts they agree on the SHARED frame.
//
// It deliberately does NOT assert that content-driven geometry matches --
// hero height, section content and breadcrumb wrapping legitimately differ
// per resource. What must never differ is the frame: where the page starts,
// how big its breadcrumb and title are, where its information column sits,
// and the rhythm between its blocks.
//
// If this spec fails, a resource family has almost certainly reintroduced a
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

type DetailPage = {
  name: string;
  route: string;
  /** Pages that render an information column beside the main content. */
  hasSidebar: boolean;
};

const DETAIL_PAGES: DetailPage[] = [
  { name: "Item", route: "/items/iron-ore", hasSidebar: true },
  { name: "Recipe", route: "/recipes/iron-sword", hasSidebar: false },
  { name: "Profession", route: "/professions/smithing", hasSidebar: false },
  { name: "Class", route: "/classes/artisan", hasSidebar: false },
  {
    name: "Location",
    route: "/locations/test-e2e-location-public-directory-region",
    hasSidebar: true,
  },
  { name: "Shop", route: "/shops/test-e2e-shop-public-alpha", hasSidebar: false },
];

// Desktop widths only. Narrow layouts wrap breadcrumbs and stack columns by
// content length, so a cross-page equality assertion there would be testing
// the fixtures' names rather than the shell.
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

type Frame = {
  breadcrumbTop: number | null;
  breadcrumbLeft: number | null;
  breadcrumbFontSize: number | null;
  breadcrumbLineHeight: string | null;
  heroTop: number | null;
  heroLeft: number | null;
  titleFontSize: number | null;
  eyebrowFontSize: number | null;
  mainLeft: number | null;
  sidebarWidth: number | null;
  sidebarTop: number | null;
  usesSharedShell: boolean;
  sectionRhythm: number | null;
  overflows: boolean;
};

async function readFrame(page: import("@playwright/test").Page): Promise<Frame> {
  return page.evaluate(() => {
    const round = (value: number | null | undefined) =>
      value === null || value === undefined ? null : Math.round(value * 10) / 10;
    const rect = (selector: string) =>
      document.querySelector(selector)?.getBoundingClientRect() ?? null;
    const firstRect = (selectors: string[]) => {
      for (const selector of selectors) {
        const found = rect(selector);
        if (found) return found;
      }
      return null;
    };
    const fontSize = (selectors: string[]) => {
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) return parseFloat(getComputedStyle(element).fontSize);
      }
      return null;
    };

    const breadcrumb = rect(".public-breadcrumb");
    const breadcrumbList = document.querySelector(".public-breadcrumb ol");
    const hero = firstRect([
      ".item-identity-panel",
      ".profession-detail-hero",
      ".shop-detail-hero",
    ]);
    const main = firstRect([
      ".item-main-column",
      ".public-detail-main",
      ".public-detail-page",
    ]);
    const sidebar = firstRect([".public-detail-sidebar"]);
    // The first block AFTER the hero, whatever that block happens to be.
    // On a page with no information sidebar that is now the Verification
    // card, which sits directly under the hero; on a page with one it is the
    // page's own first content section. Either way the distance is the
    // shared block rhythm, which is what this measures -- listing the card
    // first is what keeps the comparison honest rather than accidentally
    // measuring hero-to-SECOND-block on the sidebar-less families.
    const section = firstRect([
      ".public-verification-card--standalone",
      ".item-lower-grid",
      ".recipe-collection-section",
      ".location-detail-directory",
      ".shop-detail-inventory",
    ]);

    return {
      breadcrumbTop: round(breadcrumb?.top),
      breadcrumbLeft: round(breadcrumb?.left),
      breadcrumbFontSize: breadcrumbList
        ? parseFloat(getComputedStyle(breadcrumbList).fontSize)
        : null,
      breadcrumbLineHeight: breadcrumbList
        ? getComputedStyle(breadcrumbList).lineHeight
        : null,
      heroTop: round(hero?.top),
      heroLeft: round(hero?.left),
      titleFontSize: fontSize([".public-resource-title"]),
      eyebrowFontSize: fontSize([
        ".item-category-label",
        ".profession-detail-eyebrow",
        ".shop-detail-eyebrow",
      ]),
      mainLeft: round(main?.left),
      sidebarWidth: round(sidebar?.width),
      sidebarTop: round(sidebar?.top),
      usesSharedShell: Boolean(document.querySelector(".public-detail-page")),
      // Hero bottom to the first content section: the rhythm is shared even
      // though the hero's own height is content.
      sectionRhythm:
        hero && section ? round(section.top - hero.bottom) : null,
      overflows:
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    };
  });
}

for (const width of WIDTHS) {
  test(`every public detail page shares one page frame at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });

    const frames = new Map<string, Frame>();
    for (const detail of DETAIL_PAGES) {
      const response = await page.goto(detail.route, {
        waitUntil: "domcontentloaded",
      });
      expect(response?.status(), `${detail.name} must render`).toBe(200);
      frames.set(detail.name, await readFrame(page));
    }

    const reference = frames.get("Recipe")!;

    for (const detail of DETAIL_PAGES) {
      const frame = frames.get(detail.name)!;
      const label = `${detail.name} @${width}`;

      // Every detail page opts into the shared shell.
      expect(frame.usesSharedShell, `${label}: uses .public-detail-page`).toBe(
        true
      );

      // Breadcrumb: identical treatment and position, only content differs.
      expect(frame.breadcrumbFontSize, `${label}: breadcrumb font`).toBe(
        reference.breadcrumbFontSize
      );
      expect(frame.breadcrumbLineHeight, `${label}: breadcrumb line-height`).toBe(
        reference.breadcrumbLineHeight
      );
      expect(frame.breadcrumbLeft, `${label}: breadcrumb left origin`).toBeCloseTo(
        reference.breadcrumbLeft!,
        0
      );
      expect(frame.breadcrumbTop, `${label}: breadcrumb top`).toBeCloseTo(
        reference.breadcrumbTop!,
        0
      );

      // Hero: same origin and same type scale. Height is content.
      expect(frame.heroTop, `${label}: hero top origin`).toBeCloseTo(
        reference.heroTop!,
        0
      );
      expect(frame.heroLeft, `${label}: hero left origin`).toBeCloseTo(
        reference.heroLeft!,
        0
      );
      expect(frame.titleFontSize, `${label}: title scale`).toBe(
        reference.titleFontSize
      );
      expect(frame.eyebrowFontSize, `${label}: eyebrow scale`).toBe(
        reference.eyebrowFontSize
      );

      // Main content shares one left edge with every other detail page.
      expect(frame.mainLeft, `${label}: main content left origin`).toBeCloseTo(
        reference.mainLeft!,
        0
      );

      // Information column, where the page has one.
      if (detail.hasSidebar) {
        expect(frame.sidebarWidth, `${label}: sidebar width`).not.toBeNull();
        // The column starts level with the hero, not with the breadcrumb.
        expect(frame.sidebarTop, `${label}: sidebar top origin`).toBeCloseTo(
          frame.heroTop!,
          0
        );
      }

      // Hero bottom to first section: one shared rhythm.
      if (frame.sectionRhythm !== null && reference.sectionRhythm !== null) {
        expect(frame.sectionRhythm, `${label}: first-section rhythm`).toBeCloseTo(
          reference.sectionRhythm,
          0
        );
      }

      expect(frame.overflows, `${label}: no horizontal overflow`).toBe(false);
    }

    // Every page with an information column agrees on its width.
    const sidebarWidths = DETAIL_PAGES.filter((d) => d.hasSidebar).map(
      (d) => frames.get(d.name)!.sidebarWidth
    );
    for (const sidebarWidth of sidebarWidths) {
      expect(sidebarWidth, `sidebar width @${width}`).toBeCloseTo(
        sidebarWidths[0]!,
        0
      );
    }
  });
}

test("the shared detail shell owns the frame, not the resource families", async ({
  page,
}) => {
  // A resource page may set its own hue and sections; it must not carry a
  // private copy of the shared frame. This checks the live cascade rather
  // than parsing CSS: the shell's own tokens must be what actually resolves.
  await page.setViewportSize({ width: 1920, height: 1000 });

  for (const detail of DETAIL_PAGES) {
    await page.goto(detail.route, { waitUntil: "domcontentloaded" });
    const tokens = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const shell = document.querySelector(".public-detail-page")!;
      const shellStyle = getComputedStyle(shell);
      return {
        gutter: root.getPropertyValue("--detail-gutter").trim(),
        stackGap: root.getPropertyValue("--detail-stack-gap").trim(),
        breadcrumbFont: root
          .getPropertyValue("--detail-breadcrumb-font-size")
          .trim(),
        titleSize: root.getPropertyValue("--detail-title-size").trim(),
        sidebarGap: root.getPropertyValue("--detail-sidebar-gap").trim(),
        // The shell resolves the page rhythm from the token, so a family
        // that re-declares `gap` on its own root will show up here.
        resolvedRowGap: shellStyle.rowGap,
      };
    });

    expect(tokens.gutter, `${detail.name}: --detail-gutter`).not.toBe("");
    expect(tokens.titleSize, `${detail.name}: --detail-title-size`).not.toBe("");
    expect(
      tokens.resolvedRowGap,
      `${detail.name}: page rhythm must resolve to --detail-stack-gap`
    ).toBe(tokens.stackGap);
    expect(tokens.breadcrumbFont, `${detail.name}: breadcrumb token`).toBe(
      "12.5px"
    );
    expect(tokens.sidebarGap, `${detail.name}: sidebar gap token`).toBe("28px");
  }
});
