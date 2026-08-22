// Canonical public VERIFICATION presentation.
//
// Verification is structured detail information with exactly two placements:
//
//   * a page WITH an information sidebar (Item, Location) puts it LAST in
//     that column, sharing the Details panel's width, X origin, stack gap
//     and responsive collapse;
//   * a page WITHOUT one (Recipe, Profession, Class, Shop) puts it near the
//     TOP of its content, above the first content section.
//
// It is the ONE public home for the record's last-updated date, and it
// reports the record's build against the single canonical current Game
// Version (the row marked `isCurrent`) as a friendly Verified / Outdated /
// Unverified state — never a raw enum, a foreign key, or database wording.
//
// The assertions are structural and behavioural. Colour literals are avoided
// deliberately: the contract is that the state badge and the build badge
// agree and that the three states are distinguishable, not that a particular
// hex survives a palette change.

import { expect, test } from "@playwright/test";
import {
  createE2ePublicShopFixtures,
  deleteE2eTestShopRecords,
  createE2ePublicLocationDirectoryFixtures,
  deleteE2ePublicLocationDirectoryFixtures,
  createE2ePublicVerificationFixtures,
  deleteE2ePublicVerificationFixtures,
} from "./helpers/database-cleanup";
import { requireSiteVisibility } from "./helpers/site-visibility";

requireSiteVisibility("PUBLIC");

let verification: Awaited<ReturnType<typeof createE2ePublicVerificationFixtures>>;
let pageErrors: string[] = [];

test.beforeAll(async () => {
  await createE2ePublicShopFixtures();
  await createE2ePublicLocationDirectoryFixtures();
  verification = await createE2ePublicVerificationFixtures();
});

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(() => {
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

test.afterAll(async () => {
  await deleteE2ePublicVerificationFixtures();
  await deleteE2ePublicLocationDirectoryFixtures();
  await deleteE2eTestShopRecords();
});

/** Pages that already have an information column. */
const SIDEBAR_PAGES = [
  { name: "Item", route: "/items/iron-ore" },
  {
    name: "Location",
    route: "/locations/test-e2e-location-public-directory-region",
  },
] as const;

/** Pages with no information column. */
const STANDALONE_PAGES = [
  { name: "Recipe", route: "/recipes/iron-sword" },
  { name: "Profession", route: "/professions/smithing" },
  { name: "Class", route: "/classes/artisan" },
  { name: "Shop", route: "/shops/test-e2e-shop-public-alpha" },
] as const;

test("verification sits last in the sidebar stack, sharing its geometry", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });

  for (const target of SIDEBAR_PAGES) {
    await page.goto(target.route, { waitUntil: "domcontentloaded" });

    const geometry = await page.evaluate(() => {
      const sidebar = document.querySelector(".public-detail-sidebar")!;
      const card = document.querySelector(".public-verification-card")!;
      const panels = Array.from(sidebar.children);
      const round = (value: number) => Math.round(value * 10) / 10;
      const cardBox = card.getBoundingClientRect();
      const firstPanel = panels[0]!.getBoundingClientRect();
      return {
        cardIsInSidebar: sidebar.contains(card),
        cardIsLast: panels[panels.length - 1] === card,
        panelCount: panels.length,
        cardLeft: round(cardBox.left),
        cardWidth: round(cardBox.width),
        firstPanelLeft: round(firstPanel.left),
        firstPanelWidth: round(firstPanel.width),
        // The gap between every pair of panels comes from the column, so a
        // card cannot introduce its own spacing.
        gaps: panels.slice(1).map((panel, index) =>
          round(
            panel.getBoundingClientRect().top -
              panels[index]!.getBoundingClientRect().bottom
          )
        ),
        // No placement rules of its own.
        cardPosition: getComputedStyle(card).position,
        cardMarginTop: getComputedStyle(card).marginTop,
      };
    });

    expect(geometry.cardIsInSidebar, `${target.name}: in the sidebar`).toBe(
      true
    );
    expect(geometry.cardIsLast, `${target.name}: last panel`).toBe(true);
    expect(geometry.cardLeft, `${target.name}: shares the column X`).toBeCloseTo(
      geometry.firstPanelLeft,
      0
    );
    expect(
      geometry.cardWidth,
      `${target.name}: shares the column width`
    ).toBeCloseTo(geometry.firstPanelWidth, 0);
    // One stack gap for the whole column.
    for (const gap of geometry.gaps) {
      expect(gap, `${target.name}: one shared stack gap`).toBeCloseTo(
        geometry.gaps[0]!,
        0
      );
    }
    expect(
      geometry.cardPosition,
      `${target.name}: never absolutely positioned`
    ).toBe("static");
    expect(geometry.cardMarginTop, `${target.name}: no private offset`).toBe(
      "0px"
    );
  }
});

test("verification collapses with its sidebar rather than independently", async ({
  page,
}) => {
  // At narrow widths the information column moves into normal document flow.
  // The card must travel WITH it -- that is the whole reason it lives in the
  // column instead of being placed by the page.
  for (const target of SIDEBAR_PAGES) {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(target.route, { waitUntil: "domcontentloaded" });
    const wide = await page.evaluate(() => {
      const sidebar = document.querySelector(".public-detail-sidebar")!;
      const main = document.querySelector(".public-detail-main, .item-main-column")!;
      return {
        sidebarLeft: sidebar.getBoundingClientRect().left,
        mainLeft: main.getBoundingClientRect().left,
      };
    });
    expect(
      wide.sidebarLeft,
      `${target.name}: the column sits beside the main content at 1920`
    ).toBeGreaterThan(wide.mainLeft);

    await page.setViewportSize({ width: 1000, height: 900 });
    const narrow = await page.evaluate(() => {
      const sidebar = document.querySelector(".public-detail-sidebar")!;
      const main = document.querySelector(".public-detail-main, .item-main-column")!;
      const card = document.querySelector(".public-verification-card")!;
      return {
        sidebarLeft: Math.round(sidebar.getBoundingClientRect().left),
        mainLeft: Math.round(main.getBoundingClientRect().left),
        sidebarTop: sidebar.getBoundingClientRect().top,
        mainBottom: main.getBoundingClientRect().bottom,
        cardStillInSidebar: sidebar.contains(card),
        cardPosition: getComputedStyle(card).position,
        overflows:
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      };
    });
    expect(
      narrow.sidebarLeft,
      `${target.name}: the column stacks under the main content at 1000`
    ).toBe(narrow.mainLeft);
    expect(
      narrow.sidebarTop,
      `${target.name}: stacked below, not beside`
    ).toBeGreaterThanOrEqual(narrow.mainBottom - 1);
    expect(
      narrow.cardStillInSidebar,
      `${target.name}: the card travelled with the column`
    ).toBe(true);
    expect(narrow.cardPosition, `${target.name}: still static`).toBe("static");
    expect(narrow.overflows, `${target.name}: no overflow`).toBe(false);
  }
});

test("sidebar-less pages place verification near the top of their content", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });

  for (const target of STANDALONE_PAGES) {
    const response = await page.goto(target.route, {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status(), `${target.name} must render`).toBe(200);

    const placement = await page.evaluate(() => {
      const card = document.querySelector(".public-verification-card")!;
      const hero = document.querySelector(
        ".item-identity-panel, .profession-detail-hero, .shop-detail-hero"
      )!;
      const cardBox = card.getBoundingClientRect();
      const documentHeight = document.documentElement.scrollHeight;
      return {
        hasStandaloneModifier: card.classList.contains(
          "public-verification-card--standalone"
        ),
        hasNoSidebar: document.querySelector(".public-detail-sidebar") === null,
        // Directly after the hero, not trailing the page.
        isBelowHero: cardBox.top >= hero.getBoundingClientRect().bottom - 1,
        relativeDepth: cardBox.top / documentHeight,
        position: getComputedStyle(card).position,
      };
    });

    expect(placement.hasNoSidebar, `${target.name}: has no sidebar`).toBe(true);
    expect(
      placement.hasStandaloneModifier,
      `${target.name}: uses the shared standalone placement`
    ).toBe(true);
    expect(placement.isBelowHero, `${target.name}: sits under the hero`).toBe(
      true
    );
    expect(
      placement.relativeDepth,
      `${target.name}: near the TOP of the page, not the bottom`
    ).toBeLessThan(0.5);
    expect(placement.position, `${target.name}: never floating`).toBe("static");
  }
});

test("every information panel title shares one treatment", async ({ page }) => {
  for (const width of [1920, 3440]) {
    await page.setViewportSize({ width, height: 1080 });

    for (const target of SIDEBAR_PAGES) {
      await page.goto(target.route, { waitUntil: "domcontentloaded" });
      const titles = await page.evaluate(() => {
        // Every panel heading in the column, whichever panel it belongs to.
        const headings = Array.from(
          document.querySelectorAll(".public-detail-sidebar h2")
        );
        return headings.map((heading) => {
          const style = getComputedStyle(heading);
          return {
            text: (heading.textContent ?? "").trim(),
            usesSharedClass: heading.classList.contains("public-panel-title"),
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            letterSpacing: style.letterSpacing,
            lineHeight: style.lineHeight,
            textTransform: style.textTransform,
            marginBottom: style.marginBottom,
          };
        });
      });

      expect(
        titles.length,
        `${target.name} @${width}: has panel titles`
      ).toBeGreaterThan(1);
      const reference = titles[0]!;
      for (const title of titles) {
        const label = `${target.name} @${width} "${title.text}"`;
        expect(title.usesSharedClass, `${label}: uses .public-panel-title`).toBe(
          true
        );
        expect(title.fontSize, `${label}: font size`).toBe(reference.fontSize);
        expect(title.fontWeight, `${label}: weight`).toBe(reference.fontWeight);
        expect(title.letterSpacing, `${label}: letter spacing`).toBe(
          reference.letterSpacing
        );
        expect(title.lineHeight, `${label}: line height`).toBe(
          reference.lineHeight
        );
        expect(title.textTransform, `${label}: casing`).toBe(
          reference.textTransform
        );
        expect(title.marginBottom, `${label}: space below`).toBe(
          reference.marginBottom
        );
      }
      // A panel title is a window heading, never a page heading.
      expect(
        Number.parseFloat(reference.fontSize),
        `${target.name} @${width}: stays a quiet label`
      ).toBeLessThan(16);
    }
  }
});

test("last updated lives in verification, and only there", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });

  for (const target of [...SIDEBAR_PAGES, ...STANDALONE_PAGES]) {
    await page.goto(target.route, { waitUntil: "domcontentloaded" });

    const dates = await page.evaluate(() => {
      const card = document.querySelector(".public-verification-card")!;
      const cardText = card.textContent ?? "";
      const article = document.querySelector(".public-detail-page")!;
      const outsideCard = Array.from(article.querySelectorAll("*")).filter(
        (element) =>
          !card.contains(element) &&
          /last updated|^updated /i.test(
            (element.textContent ?? "").trim().slice(0, 40)
          )
      );
      return {
        cardHasLabel: /Last updated/.test(cardText),
        outsideCount: outsideCard.length,
      };
    });

    expect(
      dates.cardHasLabel,
      `${target.name}: verification carries Last updated`
    ).toBe(true);
    expect(
      dates.outsideCount,
      `${target.name}: the date is never shown a second time`
    ).toBe(0);
  }
});

test("build state reports the record against the current Game Version", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });

  const cases = [
    {
      name: "verified for the current build",
      slug: verification.verifiedSlug,
      state: "verified",
      label: "Verified",
      build: verification.currentVersionName,
      note: /current build/i,
    },
    {
      name: "verified for an older build",
      slug: verification.outdatedSlug,
      state: "outdated",
      label: "Outdated",
      build: verification.olderVersionName,
      note: /older build/i,
    },
    {
      name: "never verified",
      slug: verification.unverifiedSlug,
      state: "unverified",
      label: "Unverified",
      build: null,
      note: /has not been verified/i,
    },
  ] as const;

  for (const testCase of cases) {
    await page.goto(`/items/${testCase.slug}`, {
      waitUntil: "domcontentloaded",
    });

    const card = page.locator(".public-verification-card");
    await expect(card, testCase.name).toBeVisible();

    const read = await page.evaluate(() => {
      const element = document.querySelector(".public-verification-card")!;
      const badges = Array.from(
        element.querySelectorAll(".public-status-badge")
      ).map((badge) => ({
        text: (badge.textContent ?? "").trim(),
        classes: badge.className,
        color: getComputedStyle(badge).color,
        borderColor: getComputedStyle(badge).borderTopColor,
      }));
      const rows = Array.from(element.querySelectorAll("dl > div")).map(
        (row) => (row.querySelector("dt")?.textContent ?? "").trim()
      );
      return {
        classes: element.className,
        badges,
        rows,
        text: (element.textContent ?? "").replace(/\s+/g, " ").trim(),
      };
    });

    expect(read.classes, `${testCase.name}: state modifier`).toContain(
      `public-verification-card--${testCase.state}`
    );

    // The status badge always exists and reads as a friendly word.
    const statusBadge = read.badges[0]!;
    expect(statusBadge.text, `${testCase.name}: status label`).toBe(
      testCase.label
    );
    expect(statusBadge.classes, `${testCase.name}: status badge state`).toContain(
      `public-status-badge--${testCase.state}`
    );

    if (testCase.build) {
      // The build badge names the ACTUAL Game Version and shares the
      // status's colour, because the build is the reason for the state.
      const buildBadge = read.badges[1]!;
      expect(buildBadge.text, `${testCase.name}: build label`).toBe(
        testCase.build
      );
      expect(buildBadge.color, `${testCase.name}: build matches status`).toBe(
        statusBadge.color
      );
      expect(read.rows, `${testCase.name}: rows`).toEqual([
        "Status",
        "Build",
        "Checked on",
        "Last updated",
      ]);
    } else {
      // Never invent a build for a record that has none.
      expect(read.badges, `${testCase.name}: no build badge`).toHaveLength(1);
      expect(read.rows, `${testCase.name}: rows`).toEqual([
        "Status",
        "Last updated",
      ]);
    }

    expect(read.text, `${testCase.name}: player-facing note`).toMatch(
      testCase.note
    );
    // No database vocabulary reaches a visitor.
    expect(read.text, `${testCase.name}: no technical wording`).not.toMatch(
      /verifiedGameVersion|GameVersion|isCurrent|null|enum|revision/i
    );
  }

  // The three states must be visually distinguishable, not merely labelled.
  const colors: string[] = [];
  for (const testCase of cases) {
    await page.goto(`/items/${testCase.slug}`, {
      waitUntil: "domcontentloaded",
    });
    colors.push(
      await page
        .locator(".public-status-badge")
        .first()
        .evaluate((element) => getComputedStyle(element).color)
    );
  }
  expect(new Set(colors).size, "each state has its own treatment").toBe(3);
});

test("Location participates fully in the verification system", async ({
  page,
}) => {
  // Location was the last resource to get an explicit Game Version relation
  // fetch; this proves the whole chain still works end to end for it.
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/locations/test-e2e-location-public-directory-region", {
    waitUntil: "domcontentloaded",
  });

  const card = page.locator(".public-verification-card");
  await expect(card).toBeVisible();
  await expect(card.locator(".public-status-badge").first()).toBeVisible();
  await expect(card).toContainText("Last updated");

  const wiring = await page.evaluate(() => {
    const sidebar = document.querySelector(".public-detail-sidebar")!;
    const element = document.querySelector(".public-verification-card")!;
    const details = sidebar.querySelector(".location-detail-sidebar-panel")!;
    return {
      underDetails:
        element.getBoundingClientRect().top >=
        details.getBoundingClientRect().bottom,
      hasStateModifier: /public-verification-card--(verified|outdated|unverified)/.test(
        element.className
      ),
      titleShared: element
        .querySelector("h2")!
        .classList.contains("public-panel-title"),
    };
  });

  expect(wiring.underDetails, "sits under Location Details").toBe(true);
  expect(wiring.hasStateModifier, "carries a resolved state").toBe(true);
  expect(wiring.titleShared, "uses the shared panel title").toBe(true);
});
