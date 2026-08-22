// Two small shared public primitives.
//
// 1. The How-to-obtain acquisition card. Its media frame and its content
//    stack begin on one top line, and the art stays INSIDE the frame — the
//    nested sprite stage used to be 52px inside a 40px frame, so the art
//    started six pixels above the title beside it.
//
// 2. The page-link arrow's `quiet` variant, used by the Locations directory's
//    Region headings. Quieter than `default` in outline, surface and stroke,
//    but still a real outlined control — and its motion is untouched.

import { expect, test } from "@playwright/test";
import {
  createE2ePublicShopFixtures,
  deleteE2eTestShopRecords,
  createE2ePublicLocationDirectoryFixtures,
  deleteE2ePublicLocationDirectoryFixtures,
} from "./helpers/database-cleanup";
import { requireSiteVisibility } from "./helpers/site-visibility";

requireSiteVisibility("PUBLIC");

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

test("acquisition cards top-align their media with their content stack", async ({
  page,
}) => {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 1080 });
    await page.goto("/items/test-e2e-shop-item", {
      waitUntil: "domcontentloaded",
    });

    const cards = await page.evaluate(() => {
      return Array.from(document.querySelectorAll(".item-acquisition-row")).map(
        (card) => {
          const media = card.querySelector(".item-obtain-card-media")!;
          const body = card.querySelector(".item-obtain-card-body")!;
          const title = card.querySelector(".item-obtain-card-title")!;
          const stage = media.querySelector(".public-sprite-stage")!;
          const round = (value: number) => Math.round(value * 10) / 10;
          const mediaBox = media.getBoundingClientRect();
          const stageBox = stage.getBoundingClientRect();
          const bodyBox = body.getBoundingClientRect();
          const titleBox = title.getBoundingClientRect();
          return {
            mediaTop: round(mediaBox.top),
            bodyTop: round(bodyBox.top),
            titleTop: round(titleBox.top),
            // The art must not escape its own frame in ANY direction.
            stageEscape: round(
              Math.max(
                mediaBox.top - stageBox.top,
                stageBox.bottom - mediaBox.bottom,
                mediaBox.left - stageBox.left,
                stageBox.right - mediaBox.right
              )
            ),
            alignItems: getComputedStyle(card).alignItems,
          };
        }
      );
    });

    expect(cards.length, `@${width}: acquisition cards render`).toBeGreaterThan(
      0
    );
    for (const card of cards) {
      const label = `acquisition card @${width}`;
      // One top line for the media frame, the content stack, and the title
      // that opens it.
      expect(card.bodyTop, `${label}: media and content share a top`).toBeCloseTo(
        card.mediaTop,
        0
      );
      expect(card.titleTop, `${label}: the title opens that stack`).toBeCloseTo(
        card.mediaTop,
        0
      );
      // Never centred against the whole card, which would drop the media
      // below the title on a multi-line card.
      expect(card.alignItems, `${label}: top aligned, never centred`).toBe(
        "flex-start"
      );
      expect(
        card.stageEscape,
        `${label}: the art stays inside its frame`
      ).toBeLessThanOrEqual(0);
    }
  }
});

test("the acquisition grid, cheapest summary and best-price badge are unchanged", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/items/test-e2e-shop-item", {
    waitUntil: "domcontentloaded",
  });

  // Cheapest is computed ONLY when every Shop listing shares one Currency --
  // there is no exchange rate to make a cross-Currency comparison honest.
  // This fixture deliberately mixes two Currencies, so the correct behaviour
  // is to omit the enhancement rather than guess. Either way the summary and
  // the badge agree with each other; that consistency is the contract.
  const cheapest = await page.locator(".item-obtain-cheapest").count();
  const bestBadge = await page.locator(".item-obtain-card-best-badge").count();
  const bestCard = await page
    .locator(".item-acquisition-row.item-obtain-card--best")
    .count();
  expect(bestBadge, "the badge follows the summary").toBe(cheapest);
  expect(bestCard, "exactly the badged card is marked").toBe(cheapest);
  expect(cheapest, "at most one cheapest listing").toBeLessThanOrEqual(1);

  const currencySpread = await page.evaluate(
    () =>
      new Set(
        Array.from(
          document.querySelectorAll(".item-shop-row .item-obtain-card-value")
        ).map((value) => (value.getAttribute("aria-label") ?? "").split(" ").pop())
      ).size
  );
  if (currencySpread > 1) {
    expect(
      cheapest,
      "a mixed-Currency inventory omits the comparison rather than guessing"
    ).toBe(0);
  }

  const grid = await page.evaluate(() => {
    const container = document.querySelector(".item-obtain-cards")!;
    const style = getComputedStyle(container);
    return {
      display: style.display,
      columns: style.gridTemplateColumns.split(" ").length,
      gap: style.gap,
    };
  });
  expect(grid.display, "still a responsive card grid").toBe("grid");
  expect(grid.columns, "still multi-column at 1920").toBeGreaterThan(1);
  expect(grid.gap, "grid gap unchanged").toBe("12px");
});

test("currency art in acquisition cards stays frameless", async ({ page }) => {
  // A Currency image is a value glyph beside a number, not a framed record
  // icon. The acquisition media frame must never reach it.
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/items/test-e2e-shop-item", {
    waitUntil: "domcontentloaded",
  });

  const currencies = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".item-obtain-card-value")).map(
      (value) => {
        // .resource-icon is the wrapper that carries admin chrome by
        // default -- a 1px border, a filled surface, a rounded corner. It is
        // the element the frameless rule is about.
        const icon = value.querySelector(".resource-icon");
        const style = icon ? getComputedStyle(icon) : null;
        return {
          text: (value.textContent ?? "").trim(),
          hasImage: Boolean(icon),
          insideMediaFrame: Boolean(value.closest(".item-obtain-card-media")),
          borderWidth: style?.borderTopWidth ?? null,
          borderStyle: style?.borderTopStyle ?? null,
          background: style?.backgroundColor ?? null,
          padding: style?.padding ?? null,
        };
      }
    )
  );

  expect(currencies.length, "priced acquisition cards render").toBeGreaterThan(
    0
  );
  for (const currency of currencies) {
    expect(
      currency.insideMediaFrame,
      "the value never sits inside the media frame"
    ).toBe(false);
    if (currency.hasImage) {
      expect(currency.borderWidth, "currency art carries no frame").toBe("0px");
      expect(currency.borderStyle, "currency art carries no frame").toBe("none");
      expect(currency.background, "currency art carries no surface").toBe(
        "rgba(0, 0, 0, 0)"
      );
      expect(currency.padding, "currency art carries no inset").toBe("0px");
    }
  }

  // PokeYen renders as its symbol alone, never as an image.
  const pokeyen = currencies.find((currency) => currency.text.includes("₽"));
  expect(pokeyen, "a PokeYen price renders").toBeDefined();
  expect(pokeyen!.hasImage, "PokeYen is symbol-only").toBe(false);
});

test("the Region page-link arrow is quieter than a prominent one", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });

  // The quiet variant, on a Locations directory Region heading.
  await page.goto("/locations", { waitUntil: "domcontentloaded" });
  const region = await page.evaluate(() => {
    const arrow = document.querySelector(
      ".location-directory-fold-heading .page-link-arrow"
    )!;
    const glyph = arrow.querySelector(".page-link-arrow-glyph")!;
    const style = getComputedStyle(arrow);
    return {
      variant: arrow.className,
      strokeWidth: Number.parseFloat(getComputedStyle(glyph).strokeWidth),
      borderAlpha: Number(
        /[\d.]+\s*\)?\s*$/.exec(style.borderTopColor)?.[0]?.replace(")", "") ??
          "1"
      ),
      borderStyle: style.borderTopStyle,
      borderWidth: style.borderTopWidth,
      // Still a real, sized, reachable control.
      width: style.width,
      height: style.height,
      href: (arrow as HTMLAnchorElement).getAttribute("href"),
      ariaLabel: arrow.getAttribute("aria-label"),
    };
  });

  expect(region.variant, "uses the shared quiet variant").toContain(
    "page-link-arrow--quiet"
  );
  // Thinner glyph than the family default of 2.2.
  expect(region.strokeWidth, "thinner arrow stroke").toBeLessThan(2.2);
  // Still outlined — unlike `subtle`, which drops its resting frame.
  expect(region.borderStyle, "keeps a resting outline").toBe("solid");
  expect(region.borderWidth, "outline width unchanged").toBe("1px");
  // ...but that outline is not at full strength.
  expect(region.borderAlpha, "quieter outline").toBeLessThan(1);
  expect(region.width, "still a pointer-sized target").toBe("28px");
  expect(region.height, "still a pointer-sized target").toBe("28px");
  expect(region.href, "still navigates").toMatch(/^\/locations\//);
  expect(region.ariaLabel, "still named for assistive tech").toMatch(/Open the/);

  // The prominent variant is untouched: full-strength outline, full stroke.
  await page.goto("/shops/test-e2e-shop-public-alpha", {
    waitUntil: "domcontentloaded",
  });
  const prominent = await page.evaluate(() => {
    const arrow = document.querySelector(".page-link-arrow--prominent");
    if (!arrow) return null;
    const glyph = arrow.querySelector(".page-link-arrow-glyph")!;
    return {
      strokeWidth: Number.parseFloat(getComputedStyle(glyph).strokeWidth),
      borderStyle: getComputedStyle(arrow).borderTopStyle,
    };
  });
  if (prominent) {
    expect(
      prominent.strokeWidth,
      "the prominent arrow keeps the family's full stroke"
    ).toBeGreaterThan(region.strokeWidth);
    expect(prominent.borderStyle, "and its own solid outline").toBe("solid");
  }
});

test("the Region arrow keeps its motion, focus and disclosure separation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/locations", { waitUntil: "domcontentloaded" });

  const heading = page.locator(".location-directory-fold-heading").first();
  const arrow = heading.locator(".page-link-arrow");
  await expect(arrow).toBeVisible();

  // Depart & Return is untouched by the weight change.
  await arrow.hover();
  const animation = await page.evaluate(() => {
    const glyph = document.querySelector(
      ".location-directory-fold-heading .page-link-arrow-glyph"
    )!;
    const style = getComputedStyle(glyph);
    return {
      name: style.animationName,
      duration: style.animationDuration,
      timing: style.animationTimingFunction,
      iteration: style.animationIterationCount,
    };
  });
  expect(animation.name, "same depart animation").toBe(
    "page-link-arrow-depart"
  );
  expect(animation.duration, "same duration").toBe("1.05s");
  expect(animation.timing, "same easing").toBe("cubic-bezier(0.4, 0, 0.3, 1)");
  expect(animation.iteration, "still loops").toBe("infinite");

  // Focus is visible.
  await arrow.focus();
  const focused = await arrow.evaluate((element) => {
    const style = getComputedStyle(element);
    return { outlineStyle: style.outlineStyle, borderColor: style.borderTopColor };
  });
  expect(focused.outlineStyle !== "none", "focus is visible").toBe(true);

  // The Region NAME remains the disclosure trigger; the ARROW remains
  // navigation. They are different controls and must stay that way.
  const separation = await page.evaluate(() => {
    const head = document.querySelector(".location-directory-fold-heading")!;
    const arrowElement = head.querySelector(".page-link-arrow")!;
    const trigger = head.querySelector("button, [aria-expanded]");
    return {
      arrowIsLink: arrowElement.tagName === "A",
      arrowIsNotDisclosure: arrowElement.getAttribute("aria-expanded") === null,
      hasSeparateTrigger: Boolean(trigger) && trigger !== arrowElement,
    };
  });
  expect(separation.arrowIsLink, "the arrow is a link").toBe(true);
  expect(
    separation.arrowIsNotDisclosure,
    "the arrow is never the disclosure control"
  ).toBe(true);
  expect(
    separation.hasSeparateTrigger,
    "the region name keeps its own disclosure trigger"
  ).toBe(true);
});

test("reduced motion still disables the Region arrow's loop", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/locations", { waitUntil: "domcontentloaded" });

  const arrow = page
    .locator(".location-directory-fold-heading .page-link-arrow")
    .first();
  await arrow.hover();
  const animationName = await page.evaluate(
    () =>
      getComputedStyle(
        document.querySelector(
          ".location-directory-fold-heading .page-link-arrow-glyph"
        )!
      ).animationName
  );
  expect(animationName, "no loop under reduced motion").toBe("none");
  // The control still works.
  await expect(arrow).toHaveAttribute("href", /^\/locations\//);
});
