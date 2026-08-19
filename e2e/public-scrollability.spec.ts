import { expect, test, type Page } from "@playwright/test";
import { requireSiteVisibility } from "./helpers/site-visibility";

// Anonymous public browsing.
requireSiteVisibility("PUBLIC");

let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(() => {
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

/**
 * The contract every public route must satisfy: if the last record sits
 * below the fold, there must be a REAL user-scrollable ancestor (or a
 * scrollable document) that can bring it into view.
 *
 * `scrollIntoView` alone proves nothing here — the browser will happily
 * scroll an `overflow: hidden` container programmatically even though a
 * visitor never can. So the check looks for a genuine scroll port first,
 * then scrolls it the way a person would (wheel / scrollTop) and confirms
 * the final record actually became visible.
 */
async function expectLastRecordReachable(
  page: Page,
  selector: string,
  label: string,
) {
  const state = await page.evaluate((sel) => {
    const nodes = Array.from(document.querySelectorAll(sel));
    const el = nodes[nodes.length - 1];
    if (!el) return { count: 0 } as const;

    let scroller: Element | null = null;
    let node: Element | null = el;
    while (node && node !== document.documentElement) {
      const style = getComputedStyle(node);
      if (
        /(auto|scroll)/.test(style.overflowY) &&
        node.scrollHeight > node.clientHeight + 1
      ) {
        scroller = node;
        break;
      }
      node = node.parentElement;
    }

    const docScrollable =
      document.documentElement.scrollHeight >
      document.documentElement.clientHeight + 1;

    return {
      count: nodes.length,
      belowFold: el.getBoundingClientRect().bottom > window.innerHeight + 1,
      hasScroller: scroller !== null,
      scrollerClass: scroller?.className?.toString().slice(0, 60) ?? null,
      docScrollable,
    } as const;
  }, selector);

  expect(state.count, `${label}: expected records to be present`).toBeGreaterThan(
    0,
  );
  if (!state.belowFold) return; // Everything already fits; nothing to reach.

  expect(
    state.hasScroller || state.docScrollable,
    `${label}: the last record is below the fold but nothing can be scrolled to reach it`,
  ).toBe(true);

  // Now scroll the way a visitor would and prove the record becomes visible.
  const visible = await page.evaluate(
    async ({ sel }) => {
      const nodes = Array.from(document.querySelectorAll(sel));
      const el = nodes[nodes.length - 1];
      if (!el) return false;

      let node: Element | null = el;
      let scroller: Element | null = null;
      while (node && node !== document.documentElement) {
        const style = getComputedStyle(node);
        if (
          /(auto|scroll)/.test(style.overflowY) &&
          node.scrollHeight > node.clientHeight + 1
        ) {
          scroller = node;
          break;
        }
        node = node.parentElement;
      }

      if (scroller) {
        scroller.scrollTop = scroller.scrollHeight;
      } else {
        window.scrollTo(0, document.documentElement.scrollHeight);
      }
      await new Promise((resolve) => setTimeout(resolve, 250));

      const rect = el.getBoundingClientRect();
      return rect.bottom <= window.innerHeight + 2 && rect.top >= -2;
    },
    { sel: selector },
  );

  expect(
    visible,
    `${label}: the last record never became fully visible after scrolling`,
  ).toBe(true);
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

const VIEWPORTS = [
  { name: "1920x1080", width: 1920, height: 1080 },
  { name: "2560x1440", width: 2560, height: 1440 },
  { name: "3440x1440", width: 3440, height: 1440 },
  { name: "1000x900", width: 1000, height: 900 },
  { name: "390x844", width: 390, height: 844 },
] as const;

const DIRECTORIES = [
  { route: "/professions", selector: ".profession-catalogue-card" },
  { route: "/items", selector: ".item-catalogue-card" },
  { route: "/recipes", selector: ".recipe-output-card" },
  { route: "/classes", selector: ".class-catalogue-card" },
  { route: "/search?q=e", selector: "main a" },
] as const;

test("every public directory can reach its final record at every calibration width", async ({
  page,
}) => {
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    for (const { route, selector } of DIRECTORIES) {
      await page.goto(route);
      const label = `${route} @ ${viewport.name}`;
      await expectLastRecordReachable(page, selector, label);
      await expectNoHorizontalOverflow(page, label);
    }
  }
});

/**
 * The specific regression: at >=1181px the catalogue shell is height-locked
 * (`height: 100vh; overflow: hidden`) and each catalogue owns a bounded
 * internal scroll. `.directory-body` sets `align-items: flex-start`, which
 * used to stop `.directory-content` from stretching to that bounded height —
 * so the grid never received a constrained height, its own `overflow-y:
 * auto` never engaged, and the overflow was silently clipped by the shell
 * with no scroll path at all. /professions had more cards than fit at
 * 1080p, so its last records were unreachable.
 */
test("the height-locked catalogue shell hands its grid a real scroll port", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/professions");

  const shell = page.locator(".public-site-shell--catalogue");
  await expect(shell).toHaveCount(1);
  // The contained-scroll design itself is intentional and preserved.
  await expect(shell).toHaveCSS("overflow-y", "hidden");

  const content = page.locator(".directory-content").first();
  await expect(content).toHaveCSS("align-self", "stretch");

  const measurements = await page.evaluate(() => {
    const body = document.querySelector(".directory-body");
    const content = document.querySelector(".directory-content");
    const grid = document.querySelector(".profession-catalogue-grid");
    if (!body || !content || !grid) throw new Error("Expected the directory chain");
    return {
      bodyHeight: Math.round(body.getBoundingClientRect().height),
      contentHeight: Math.round(content.getBoundingClientRect().height),
      gridScrollable: grid.scrollHeight > grid.clientHeight + 1,
      gridOverflowY: getComputedStyle(grid).overflowY,
    };
  });

  // The content column no longer outgrows the bounded body...
  expect(measurements.contentHeight).toBeLessThanOrEqual(
    measurements.bodyHeight + 1,
  );
  // ...so the grid is the element that actually scrolls.
  expect(measurements.gridOverflowY).toBe("auto");
  expect(measurements.gridScrollable).toBe(true);

  // And the scroll port is discoverable rather than a fully hidden scrollbar.
  await expect(page.locator(".profession-catalogue-grid")).toHaveCSS(
    "scrollbar-width",
    "thin",
  );
});

test("the last Profession is reachable by keyboard, not only by wheel", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/professions");

  const cards = page.locator(".profession-catalogue-card");
  const count = await cards.count();
  expect(count).toBeGreaterThan(0);
  const last = cards.nth(count - 1);

  // Focusing the final record must bring it fully into view — this is the
  // path a keyboard user takes through the grid.
  await last.focus();
  await expect(last).toBeFocused();
  await page.waitForTimeout(200);

  const visible = await last.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    return rect.bottom <= window.innerHeight + 2 && rect.top >= -2;
  });
  expect(visible, "the focused final Profession must be fully visible").toBe(
    true,
  );
});
