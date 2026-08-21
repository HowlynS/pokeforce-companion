// Canonical main-directory List row geometry.
//
// The /recipes directory List is the density authority. Every main directory
// that offers a List view renders the SAME row at the SAME scale: a 44x44
// image stage inside a 50x50 frame, in a 64px row. What differs between them
// is the cells -- a Profession row carries a description and a recipe count
// where an Item row carries a category and a source -- and that is the point.
// Standardising density is not flattening content.
//
// Scope note. Only four public directories have a List view at all: Items,
// Recipes, Professions and Classes. Locations and Shops present grouped wide
// CARDS with their own art scale, which is a different primitive; they are
// deliberately absent here rather than forced into a false abstraction. This
// spec also does NOT touch the compact relationship lists (Used in Recipes,
// Related Recipes) -- those share no vocabulary with a main directory row.

import { expect, test } from "@playwright/test";
import { requireSiteVisibility } from "./helpers/site-visibility";

requireSiteVisibility("PUBLIC");

/** The approved image stage. */
const STAGE = 44;
/** The frame around it: a content-box 48px + a 1px border on each side. */
const FRAME = 50;
/** 6px + 50px + 6px + a 1px border on each side. */
const ROW_HEIGHT = 64;

type ListDirectory = {
  name: string;
  route: string;
  /** The row element itself. */
  row: string;
  /** The framed image area inside the row. */
  frame: string;
};

const DIRECTORIES: ListDirectory[] = [
  {
    name: "Recipes",
    route: "/recipes",
    row: ".recipe-output-card--directory-list",
    // Recipe keeps its own frame selector: the yield badge is a child of
    // this stage and sits just outside its corner, so it must stay a
    // positioning context and must not clip. Its geometry is the shared
    // token set all the same.
    frame: ".recipe-output-card--directory-list .recipe-output-image-stage",
  },
  {
    name: "Items",
    route: "/items",
    row: ".item-catalogue-list-row",
    frame: ".item-catalogue-list-row .directory-list-media",
  },
  {
    name: "Professions",
    route: "/professions",
    row: ".profession-catalogue-list-row",
    frame: ".profession-catalogue-list-row .directory-list-media",
  },
  {
    name: "Classes",
    route: "/classes",
    row: ".class-catalogue-list-row",
    frame: ".class-catalogue-list-row .directory-list-media",
  },
];

// Desktop widths only. Below 680px the Recipe List deliberately becomes a
// stacked grid, which is a designed transform rather than drift.
const WIDTHS = [1920, 2560, 3440] as const;

let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(() => {
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

async function openListView(
  page: import("@playwright/test").Page,
  route: string
) {
  const response = await page.goto(route, { waitUntil: "domcontentloaded" });
  expect(response?.status(), `${route} must render`).toBe(200);
  // View mode is client state, not a URL parameter, so the List view is
  // reached the way a reader reaches it.
  await page.getByRole("button", { name: "List", exact: true }).click();
}

for (const width of WIDTHS) {
  test(`every main directory List shares one row geometry at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1080 });

    for (const directory of DIRECTORIES) {
      await openListView(page, directory.route);
      const label = `${directory.name} @${width}`;

      const row = page.locator(directory.row).first();
      await expect(row, label).toBeVisible();

      const measured = await page.evaluate(
        ({ rowSelector, frameSelector }) => {
          const round = (value: number) => Math.round(value * 10) / 10;
          const rowEl = document.querySelector(rowSelector)!;
          const frameEl = document.querySelector(frameSelector)!;
          const stageEl = frameEl.querySelector(".public-sprite-stage")!;
          const rowBox = rowEl.getBoundingClientRect();
          const frameBox = frameEl.getBoundingClientRect();
          const stageBox = stageEl.getBoundingClientRect();
          const image = stageEl.querySelector("img");
          const imageBox = image?.getBoundingClientRect() ?? null;
          const fallback = stageEl.querySelector(".public-sprite-fallback");
          const fallbackBox = fallback?.getBoundingClientRect() ?? null;
          const rowStyle = getComputedStyle(rowEl);

          const within = (inner: DOMRect | null, outer: DOMRect) =>
            inner === null ||
            (inner.left >= outer.left - 0.5 &&
              inner.right <= outer.right + 0.5 &&
              inner.top >= outer.top - 0.5 &&
              inner.bottom <= outer.bottom + 0.5);

          return {
            rowHeight: round(rowBox.height),
            frame: [round(frameBox.width), round(frameBox.height)],
            stage: [round(stageBox.width), round(stageBox.height)],
            rowPaddingTop: rowStyle.paddingTop,
            rowPaddingBottom: rowStyle.paddingBottom,
            rowGap: rowStyle.columnGap,
            rowRadius: rowStyle.borderTopLeftRadius,
            // Nothing may escape its stage, image or fallback alike.
            imageContained: within(imageBox, stageBox),
            fallbackContained: within(fallbackBox, stageBox),
            stageContained: within(stageBox, frameBox),
            // A no-image fallback stays centred in its own stage.
            fallbackCentreOffset: fallbackBox
              ? round(
                  Math.abs(
                    (fallbackBox.left + fallbackBox.right) / 2 -
                      (stageBox.left + stageBox.right) / 2
                  )
                )
              : null,
            // The row must still be tall enough for its own content.
            contentFits: Array.from(rowEl.children).every(
              (child) =>
                child.getBoundingClientRect().height <= rowBox.height + 0.5
            ),
          };
        },
        { rowSelector: directory.row, frameSelector: directory.frame }
      );

      // ---- The approved image stage ---------------------------------
      expect(measured.stage, `${label}: image stage is ${STAGE}x${STAGE}`).toEqual(
        [STAGE, STAGE]
      );
      expect(measured.frame, `${label}: frame is ${FRAME}x${FRAME}`).toEqual([
        FRAME,
        FRAME,
      ]);

      // ---- The row scales around it ---------------------------------
      expect(measured.rowHeight, `${label}: row height`).toBeCloseTo(
        ROW_HEIGHT,
        0
      );
      expect(measured.rowPaddingTop, `${label}: row padding-top`).toBe("6px");
      expect(measured.rowPaddingBottom, `${label}: row padding-bottom`).toBe(
        "6px"
      );
      expect(measured.rowGap, `${label}: row gap`).toBe("14px");
      expect(measured.rowRadius, `${label}: row radius`).toBe("9px");

      // ---- Nothing escapes ------------------------------------------
      expect(measured.stageContained, `${label}: stage inside frame`).toBe(true);
      expect(measured.imageContained, `${label}: image inside stage`).toBe(true);
      expect(measured.fallbackContained, `${label}: fallback inside stage`).toBe(
        true
      );
      if (measured.fallbackCentreOffset !== null) {
        expect(
          measured.fallbackCentreOffset,
          `${label}: no-image fallback stays centred`
        ).toBeLessThanOrEqual(0.5);
      }

      expect(measured.contentFits, `${label}: row fits its own content`).toBe(
        true
      );

      const overflows = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth
      );
      expect(overflows, `${label}: no horizontal overflow`).toBe(false);
    }
  });
}

test("the shared token set owns main-directory List density", async ({
  page,
}) => {
  // A directory that reintroduces a private copy of the row geometry would
  // still pass the measurements above if it happened to copy the right
  // numbers. This asserts the numbers come from ONE place.
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/recipes", { waitUntil: "domcontentloaded" });

  const tokens = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const read = (name: string) => root.getPropertyValue(name).trim();
    return {
      stage: read("--directory-list-stage-size"),
      frame: read("--directory-list-frame-size"),
      gap: read("--directory-list-row-gap"),
      paddingBlock: read("--directory-list-row-padding-block"),
      paddingInline: read("--directory-list-row-padding-inline"),
      radius: read("--directory-list-row-radius"),
    };
  });

  expect(tokens.stage, "--directory-list-stage-size").toBe("44px");
  expect(tokens.frame, "--directory-list-frame-size").toBe("48px");
  expect(tokens.gap, "--directory-list-row-gap").toBe("14px");
  expect(tokens.paddingBlock, "--directory-list-row-padding-block").toBe("6px");
  expect(tokens.paddingInline, "--directory-list-row-padding-inline").toBe(
    "14px"
  );
  expect(tokens.radius, "--directory-list-row-radius").toBe("9px");
});

test("the Items List frame stays unhued", async ({ page }) => {
  // Every other List frame carries its resource hue. Items deliberately does
  // not: at 44px the Item sapphire reads as a blue box rather than as
  // resource identity, which is the regression an earlier Item-hue repair
  // pass removed. The opt-out is a token, so it is visible in the cascade.
  await page.setViewportSize({ width: 1920, height: 1080 });

  await openListView(page, "/items");
  const itemsHue = await page
    .locator(".item-catalogue-list-row .directory-list-media")
    .first()
    .evaluate((element) =>
      getComputedStyle(element).getPropertyValue("--directory-list-media-hue").trim()
    );
  expect(itemsHue, "Items List frame opts out of the hue").toBe("0");

  await openListView(page, "/professions");
  const professionHue = await page
    .locator(".profession-catalogue-list-row .directory-list-media")
    .first()
    .evaluate((element) =>
      getComputedStyle(element).getPropertyValue("--directory-list-media-hue").trim()
    );
  expect(
    professionHue,
    "Professions keep the default hue strength"
  ).not.toBe("0");
});
