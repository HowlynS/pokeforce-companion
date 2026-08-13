// Browser coverage for the shared public catalogue Grid/List entrance
// animation. Before the CatalogueViewSwitch fix, React reconciled the
// outgoing and incoming views position-by-position, reused the existing DOM
// nodes, and only swapped their className — so the shared `cx-item-in`
// entrance the directory plays on first render never replayed on a switch.
//
// These tests deliberately do NOT assert on class names alone (the class was
// always present, even while the animation was not running). They instrument
// real `animationstart` events, read the browser's own resolved
// animation-delay values, and prove the DOM nodes are genuinely recreated —
// all observable, deterministic facts rather than sleep-and-hope timing.
//
// Read-only against the deterministic seed, except for the public Location
// directory fixture (created and removed here exactly as public-locations
// .spec.ts already does), matching the established non-destructive
// convention.

import { expect, test, type Page } from "@playwright/test";
import {
  createE2ePublicLocationDirectoryFixtures,
  deleteE2ePublicLocationDirectoryFixtures,
} from "./helpers/database-cleanup";
import { requireSiteVisibility } from "./helpers/site-visibility";

// Anonymous public browsing is only reachable under PUBLIC visibility, so
// this spec establishes it rather than inheriting whatever mode the
// previously-run spec happened to leave behind.
requireSiteVisibility("PUBLIC");

type EntranceProbeEntry = { name: string; target: Element };

declare global {
  interface Window {
    __cxEntranceAnimations?: EntranceProbeEntry[];
  }
}

/** The Claude Design stagger the directories already use on first render. */
const STAGGER_STEP_MS = 30;
const STAGGER_CAP_MS = 330;

type CatalogueCase = {
  name: string;
  path: string;
  /** Selector matching exactly the elements that carry the entrance class. */
  grid: string;
  list: string;
  /**
   * Container the stagger index restarts within. Most directories stagger
   * across one flat row set; the Location detail directory splits its
   * children into per-type folds, and each fold restarts at index 0 — its
   * own pre-existing choreography, which this fix leaves untouched.
   */
  staggerGroup?: string;
};

const CATALOGUES: CatalogueCase[] = [
  {
    name: "Items directory",
    path: "/items",
    grid: ".item-catalogue-card",
    list: ".item-catalogue-list-row",
  },
  {
    name: "Recipes directory",
    path: "/recipes",
    grid: ".recipe-output-card--directory-grid",
    list: ".recipe-output-card--directory-list",
  },
  {
    name: "Professions directory",
    path: "/professions",
    grid: ".profession-catalogue-card",
    list: ".profession-catalogue-list-row",
  },
  {
    name: "Classes directory",
    path: "/classes",
    grid: ".class-catalogue-card",
    list: ".class-catalogue-list-row",
  },
  {
    name: "Profession detail Recipes directory",
    path: "/professions/smithing",
    grid: ".profession-recipe-grid > .cx-item-in",
    list: ".profession-recipe-list > .cx-item-in",
  },
  {
    name: "Location detail Sub-locations directory",
    path: "/locations/test-e2e-location-public-directory-region",
    grid: ".location-detail-child-card",
    list: ".location-detail-child-list-row",
    staggerGroup: ".location-directory-fold",
  },
];

let pageErrors: string[] = [];

test.beforeAll(async () => {
  await createE2ePublicLocationDirectoryFixtures();
});

test.afterAll(async () => {
  await deleteE2ePublicLocationDirectoryFixtures();
});

test.beforeEach(async ({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  // Installed before any page script runs, on every navigation, so the very
  // first entrance animation of the initial render is captured too.
  await page.addInitScript(() => {
    window.__cxEntranceAnimations = [];
    document.addEventListener(
      "animationstart",
      (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        window.__cxEntranceAnimations?.push({
          name: (event as AnimationEvent).animationName,
          target,
        });
      },
      true,
    );
  });
});

test.afterEach(() => {
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

/** How many `cx-item-in` entrances have fired on elements matching `selector`. */
function countEntrances(page: Page, selector: string): Promise<number> {
  return page.evaluate(
    (matcher) =>
      (window.__cxEntranceAnimations ?? []).filter(
        (entry) => entry.name === "cx-item-in" && entry.target.matches(matcher),
      ).length,
    selector,
  );
}

function clearEntrances(page: Page): Promise<void> {
  return page.evaluate(() => {
    window.__cxEntranceAnimations = [];
  });
}

/**
 * Waits until every currently rendered row of `selector` has reported an
 * entrance, then returns. Polling on a count that can only grow is stable —
 * it never depends on catching a particular frame.
 */
async function expectEveryRowToEnter(page: Page, selector: string) {
  const expected = await page.locator(selector).count();
  expect(expected, `${selector} should render at least one row`).toBeGreaterThan(0);
  await expect
    .poll(() => countEntrances(page, selector), {
      message: `every ${selector} should replay the shared entrance animation`,
    })
    .toBe(expected);
}

/**
 * The browser's own resolved animation-delay for each row, in milliseconds,
 * in DOM order, split into the groups the stagger index restarts within.
 */
function readStaggerDelays(
  page: Page,
  selector: string,
  groupSelector: string | undefined,
): Promise<number[][]> {
  return page.evaluate(
    ([matcher, grouper]) => {
      const groups = new Map<Element | null, number[]>();
      for (const element of Array.from(document.querySelectorAll(matcher))) {
        const group = grouper ? element.closest(grouper) : null;
        const delay = Math.round(
          parseFloat(getComputedStyle(element).animationDelay || "0") * 1000,
        );
        groups.set(group, [...(groups.get(group) ?? []), delay]);
      }
      return Array.from(groups.values());
    },
    [selector, groupSelector ?? null] as const,
  );
}

/** The approved Claude Design stagger: 30ms per index, capped at 330ms. */
function expectStagger(delays: number[][]) {
  expect(delays.length).toBeGreaterThan(0);
  for (const group of delays) {
    expect(group).toEqual(
      Array.from({ length: group.length }, (_, index) =>
        Math.min(index * STAGGER_STEP_MS, STAGGER_CAP_MS),
      ),
    );
  }
}

function gridButton(page: Page) {
  return page.getByRole("button", { name: "Grid", exact: true });
}

function listButton(page: Page) {
  return page.getByRole("button", { name: "List", exact: true });
}

for (const catalogue of CATALOGUES) {
  test(`${catalogue.name} replays the catalogue entrance on every Grid/List switch`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(catalogue.path);

    // 1. The initial Grid render animates — the behavior every switch must match.
    await expectEveryRowToEnter(page, catalogue.grid);
    const gridRowCount = await page.locator(catalogue.grid).count();
    expectStagger(
      await readStaggerDelays(page, catalogue.grid, catalogue.staggerGroup),
    );

    // Mark a live grid node so a genuine remount (not a className swap) is
    // provable independently of the animation instrumentation.
    await page
      .locator(catalogue.grid)
      .first()
      .evaluate((node) => {
        (node as HTMLElement).dataset.cxRemountProbe = "original";
      });

    // 2. Grid -> List.
    await clearEntrances(page);
    await listButton(page).click();
    await expect(page.locator(catalogue.list).first()).toBeVisible();
    await expect(page.locator(catalogue.grid)).toHaveCount(0);
    await expectEveryRowToEnter(page, catalogue.list);
    const listRowCount = await page.locator(catalogue.list).count();
    expect(listRowCount).toBe(gridRowCount);
    expectStagger(
      await readStaggerDelays(page, catalogue.list, catalogue.staggerGroup),
    );

    // 3. List -> Grid, on fresh nodes: the marked node is gone, proving the
    //    presentation subtree remounted rather than being reused in place.
    await clearEntrances(page);
    await gridButton(page).click();
    await expect(page.locator(catalogue.grid).first()).toBeVisible();
    await expectEveryRowToEnter(page, catalogue.grid);
    await expect(page.locator("[data-cx-remount-probe]")).toHaveCount(0);

    // 4. Repeated toggling keeps retriggering — never a one-shot animation.
    for (let round = 0; round < 2; round += 1) {
      await clearEntrances(page);
      await listButton(page).click();
      await expectEveryRowToEnter(page, catalogue.list);

      await clearEntrances(page);
      await gridButton(page).click();
      await expectEveryRowToEnter(page, catalogue.grid);
    }
  });
}

test("switching views at 3440x1440 still replays the entrance for every catalogue", async ({
  page,
}) => {
  await page.setViewportSize({ width: 3440, height: 1440 });

  for (const catalogue of CATALOGUES) {
    await page.goto(catalogue.path);
    await expectEveryRowToEnter(page, catalogue.grid);

    await clearEntrances(page);
    await listButton(page).click();
    await expectEveryRowToEnter(page, catalogue.list);

    await clearEntrances(page);
    await gridButton(page).click();
    await expectEveryRowToEnter(page, catalogue.grid);

    // The mode change is the only layout change: the page never gains a
    // horizontal scrollbar on either side of the switch.
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
      `${catalogue.name} must not overflow horizontally`,
    ).toBe(true);
  }
});

test("switching views preserves search, filters, pagination, and the URL", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/items?category=materials");

  const url = page.url();
  const searchInput = page.locator(".directory-search-field input[name='q']");
  // An unsubmitted search term is pure client state in the toolbar — exactly
  // the state a too-broad remount key would have destroyed.
  await searchInput.fill("iron");

  const readPagination = () =>
    page.evaluate(() =>
      Array.from(document.querySelectorAll(".public-catalogue-pagination")).map(
        (nav) => nav.textContent ?? "",
      ),
    );
  const readOverview = () =>
    page.evaluate(() =>
      Array.from(
        document.querySelectorAll(".directory-overview-stats div"),
      ).map((node) => node.textContent ?? ""),
    );

  const filterLabel = await page.locator(".directory-filter-trigger").textContent();
  const paginationBefore = await readPagination();
  const overviewBefore = await readOverview();
  const gridCount = await page.locator(".item-catalogue-card").count();
  expect(gridCount).toBeGreaterThan(0);

  await listButton(page).click();
  await expect(page.locator(".item-catalogue-list-row")).toHaveCount(gridCount);
  await gridButton(page).click();
  await expect(page.locator(".item-catalogue-card")).toHaveCount(gridCount);

  expect(page.url(), "the view toggle must never touch the URL").toBe(url);
  await expect(searchInput).toHaveValue("iron");
  await expect(page.locator(".directory-filter-trigger")).toHaveText(
    filterLabel ?? "",
  );
  expect(await readPagination()).toEqual(paginationBefore);
  expect(await readOverview()).toEqual(overviewBefore);
});

test("under reduced motion, view switching is instant, animation-free, and never hides content", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1920, height: 1080 });

  for (const catalogue of CATALOGUES) {
    await page.goto(catalogue.path);
    await expect(page.locator(catalogue.grid).first()).toBeVisible();

    await clearEntrances(page);
    await listButton(page).click();

    await expect(page.locator(catalogue.list).first()).toBeVisible();
    // No entrance animation is scheduled at all: the `cx-item-in` rules live
    // behind prefers-reduced-motion:no-preference, so under `reduce` the rows
    // have no running animation and render at their resting state.
    expect(
      await page.evaluate(
        (matcher) =>
          Array.from(document.querySelectorAll(matcher)).flatMap((element) =>
            element.getAnimations().map((animation) => animation.playState),
          ),
        catalogue.list,
      ),
      `${catalogue.name} rows must not animate under reduced motion`,
    ).toEqual([]);
    expect(
      await page.evaluate(
        (matcher) =>
          Array.from(document.querySelectorAll(matcher)).map(
            (element) => getComputedStyle(element).opacity,
          ),
        catalogue.list,
      ),
      `${catalogue.name} rows must be fully opaque immediately`,
    ).not.toContain("0");
    expect(await countEntrances(page, catalogue.list)).toBe(0);

    await clearEntrances(page);
    await gridButton(page).click();
    await expect(page.locator(catalogue.grid).first()).toBeVisible();
    expect(await countEntrances(page, catalogue.grid)).toBe(0);
  }
});
