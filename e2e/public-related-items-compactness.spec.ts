// Related Items: adaptive per GROUP, uniform WITHIN the group.
//
// The card set used to reserve a fixed single-line title block whatever it
// held, so a group of short names carried dead space between each title and
// its category line. RelatedItemGrid now measures the rendered collection
// and picks ONE title allowance for all of it:
//
//   * nothing wraps            -> the compact allowance (one line, tight gap)
//   * at least one title wraps -> the expanded allowance, for every card, so
//                                 the category baselines stay aligned
//
// The assertions are deliberately fixture-independent. They do not require a
// particular Item to have long or short neighbours — they assert the RULE:
// exactly one mode for the collection, uniform geometry inside it, and a
// mode that agrees with what the titles actually measure. A test keyed to
// fixture names would pass while the rule was broken, and break whenever
// someone renamed an Item.

import { expect, test } from "@playwright/test";
import { requireSiteVisibility } from "./helpers/site-visibility";

requireSiteVisibility("PUBLIC");

/** An Item whose recipes give it neighbours, so the section renders. */
const RELATED_ITEMS_ROUTE = "/items/iron-ore";

const WIDTHS = [1920, 2560, 3440, 1000, 390] as const;

let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(() => {
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

async function openRelatedItems(page: import("@playwright/test").Page) {
  await page.goto(RELATED_ITEMS_ROUTE, { waitUntil: "domcontentloaded" });
  const grid = page.locator(".item-related-grid");
  await expect(grid, "the Related Items collection renders").toHaveCount(1);
  // The section is a disclosure; make sure its cards are laid out.
  await expect(grid.locator(".item-related-card").first()).toBeVisible();
  // The mode is set from a measurement effect, so wait for the attribute
  // rather than racing hydration.
  await expect(grid).toHaveAttribute(
    "data-related-title-mode",
    /^(compact|expanded)$/
  );
  return grid;
}

async function readGroup(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const round = (value: number) => Math.round(value * 10) / 10;
    const grid = document.querySelector<HTMLElement>(".item-related-grid")!;
    const cards = Array.from(
      grid.querySelectorAll<HTMLElement>(".item-related-card")
    );

    const titles = cards.map((card) => {
      const title = card.querySelector<HTMLElement>(".item-related-card-name")!;
      const category = card.querySelector<HTMLElement>(
        ".item-related-card-category"
      );
      const titleStyle = getComputedStyle(title);
      const titleBox = title.getBoundingClientRect();

      // The title's height with the clamp lifted: this is what decides the
      // mode, and it must be read the same way the component reads it.
      const previous = title.style.webkitLineClamp;
      title.style.webkitLineClamp = "unset";
      const unclampedHeight = title.scrollHeight;
      title.style.webkitLineClamp = previous;

      return {
        blockHeight: round(titleBox.height),
        lineHeight: Number.parseFloat(titleStyle.lineHeight),
        lineClamp: titleStyle.webkitLineClamp,
        unclampedHeight,
        // The distance from the title block to its category line — the gap
        // this pass exists to tighten when nothing wraps.
        titleToCategory: category
          ? round(category.getBoundingClientRect().top - titleBox.bottom)
          : null,
        categoryTopWithinCard: category
          ? round(
              category.getBoundingClientRect().top -
                (card.getBoundingClientRect().top as number)
            )
          : null,
      };
    });

    return {
      mode: grid.getAttribute("data-related-title-mode"),
      cardCount: cards.length,
      titles,
    };
  });
}

for (const width of WIDTHS) {
  test(`the Related Items group agrees on one title allowance at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1080 });
    await openRelatedItems(page);
    const group = await readGroup(page);

    expect(group.cardCount, `@${width}: cards render`).toBeGreaterThan(0);
    expect(group.mode, `@${width}: exactly one mode for the collection`).toMatch(
      /^(compact|expanded)$/
    );

    const reference = group.titles[0]!;

    for (const [index, title] of group.titles.entries()) {
      const label = `card ${index} @${width}`;

      // ---- Uniform within the group ----------------------------------
      expect(title.lineClamp, `${label}: shares the group's allowance`).toBe(
        reference.lineClamp
      );
      expect(title.blockHeight, `${label}: shares one title block`).toBeCloseTo(
        reference.blockHeight,
        0
      );
      if (title.titleToCategory !== null && reference.titleToCategory !== null) {
        expect(
          title.titleToCategory,
          `${label}: shares one title-to-category gap`
        ).toBeCloseTo(reference.titleToCategory, 0);
      }
      if (
        title.categoryTopWithinCard !== null &&
        reference.categoryTopWithinCard !== null
      ) {
        expect(
          title.categoryTopWithinCard,
          `${label}: shares one category baseline`
        ).toBeCloseTo(reference.categoryTopWithinCard, 0);
      }
    }

    // ---- The mode agrees with what the titles actually measure --------
    const anyTitleWraps = group.titles.some(
      (title) => title.unclampedHeight > title.lineHeight * 1.5
    );
    expect(
      group.mode,
      `@${width}: ${
        anyTitleWraps
          ? "a wrapping title expands the whole group"
          : "a group of one-line titles stays compact"
      }`
    ).toBe(anyTitleWraps ? "expanded" : "compact");

    // ---- The allowance is the mode's, not a per-card min-height -------
    const expectedLines = group.mode === "compact" ? 1 : 2;
    expect(
      Number(reference.lineClamp),
      `@${width}: ${group.mode} allows ${expectedLines} line(s)`
    ).toBe(expectedLines);
    expect(
      reference.blockHeight,
      `@${width}: the title block is exactly its allowance`
    ).toBeCloseTo(reference.lineHeight * expectedLines, 0);
  });
}

test("the compact allowance is genuinely tighter than the expanded one", async ({
  page,
}) => {
  // A CSS contract, read off the live collection by driving its own mode
  // attribute. This is what proves Case A actually saves vertical space
  // rather than merely being labelled differently from Case B.
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openRelatedItems(page);

  const measurements = await page.evaluate(() => {
    const grid = document.querySelector<HTMLElement>(".item-related-grid")!;
    const original = grid.getAttribute("data-related-title-mode")!;
    const read = (mode: string) => {
      grid.setAttribute("data-related-title-mode", mode);
      const title = grid.querySelector<HTMLElement>(".item-related-card-name")!;
      const copy = grid.querySelector<HTMLElement>(".item-related-card-copy")!;
      const style = getComputedStyle(title);
      return {
        lines: Number(style.webkitLineClamp),
        blockHeight: title.getBoundingClientRect().height,
        copyGap: Number.parseFloat(getComputedStyle(copy).rowGap),
      };
    };
    const compact = read("compact");
    const expanded = read("expanded");
    grid.setAttribute("data-related-title-mode", original);
    return { compact, expanded };
  });

  expect(measurements.compact.lines, "compact allows one line").toBe(1);
  expect(measurements.expanded.lines, "expanded allows two").toBe(2);
  expect(
    measurements.compact.blockHeight,
    "compact reserves less title height"
  ).toBeLessThan(measurements.expanded.blockHeight);
  expect(
    measurements.compact.copyGap,
    "compact sits the category closer to the title"
  ).toBeLessThan(measurements.expanded.copyGap);
});

test("Related Items keeps its card identity while the title geometry adapts", async ({
  page,
}) => {
  // The refinement is title/meta vertical geometry only. Media stage, card
  // width, hue and the gold category treatment are unchanged.
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openRelatedItems(page);

  const identity = await page.evaluate(() => {
    const cards = Array.from(
      document.querySelectorAll<HTMLElement>(".item-related-card")
    );
    const widths = cards.map((card) =>
      Math.round(card.getBoundingClientRect().width)
    );
    const first = cards[0]!;
    const media = first.querySelector<HTMLElement>(".item-related-card-media")!;
    const category = first.querySelector<HTMLElement>(
      ".item-related-card-category"
    );
    return {
      widths,
      mediaAspect:
        Math.round(
          (media.getBoundingClientRect().width /
            media.getBoundingClientRect().height) *
            100
        ) / 100,
      mediaPaintsHue: /gradient/.test(getComputedStyle(media).backgroundImage),
      categoryTransform: category
        ? getComputedStyle(category).textTransform
        : null,
      categoryColor: category ? getComputedStyle(category).color : null,
      accent: getComputedStyle(document.documentElement)
        .getPropertyValue("--color-accent")
        .trim(),
    };
  });

  for (const cardWidth of identity.widths) {
    expect(cardWidth, "every card keeps one width").toBe(identity.widths[0]);
  }
  expect(identity.mediaAspect, "the image stage stays square").toBe(1);
  expect(identity.mediaPaintsHue, "the stage keeps its resource hue").toBe(true);
  if (identity.categoryColor) {
    expect(identity.categoryTransform, "category stays uppercase meta").toBe(
      "uppercase"
    );
  }
});
