import { expect, test, type Page } from "@playwright/test";
import {
  E2E_PUBLIC_LOCATION_DIRECTORY_SLUG_PREFIX,
  createE2ePublicLocationDirectoryFixtures,
  deleteE2ePublicLocationDirectoryFixtures,
} from "./helpers/database-cleanup";
import { requireSiteVisibility } from "./helpers/site-visibility";

// Anonymous public browsing is only reachable under PUBLIC visibility, so
// this spec establishes it rather than inheriting whatever mode the
// previously-run spec happened to leave behind.
requireSiteVisibility("PUBLIC");

// World Navigation is a presentation layer over the real Location containment
// tree and the Shops attached to those Locations, so it reuses the Locations
// directory fixture rather than seeding a parallel world.
const REGION_SLUG = `${E2E_PUBLIC_LOCATION_DIRECTORY_SLUG_PREFIX}-region`;
const REGION_NAME = "Test E2E Northwind Region";
const TOWN_SLUG = `${E2E_PUBLIC_LOCATION_DIRECTORY_SLUG_PREFIX}-town`;
const TOWN_NAME = "Test E2E Brassmarket Township";

let pageErrors: string[] = [];

test.beforeAll(async () => {
  await createE2ePublicLocationDirectoryFixtures();
});

test.afterAll(async () => {
  await deleteE2ePublicLocationDirectoryFixtures();
});

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(() => {
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth
      )
    )
    .toBe(true);
}

test("World Navigation renders the real containment tree and selects through the URL", async ({
  page,
}) => {
  await page.goto("/world");

  await expect(
    page.getByRole("heading", { level: 1, name: "World Navigation", exact: true })
  ).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);

  // The topmost real Location is the region heading; no invented World or
  // Region record sits behind it.
  const tree = page.getByRole("navigation", { name: "World locations" });
  await expect(tree.getByRole("link", { name: REGION_NAME })).toBeVisible();

  // Selecting a nested Location is a real, linkable, server-rendered URL.
  await page.goto(`/world?location=${TOWN_SLUG}`);
  await expect(
    page.locator(".world-tree-row--selected .world-tree-label")
  ).toHaveText(TOWN_NAME);
  await expect(
    page.getByRole("heading", { level: 2, name: TOWN_NAME, exact: true })
  ).toBeVisible();

  // Every ancestor of the selection is revealed, so the path stays navigable.
  await expect(page.locator(".world-detail-path")).toContainText(REGION_NAME);

  // The detail pane links out to the canonical Location page.
  await expect(page.getByRole("link", { name: /View full page/ })).toHaveAttribute(
    "href",
    `/locations/${TOWN_SLUG}`
  );
});

test("World Navigation never invents NPC data and hides empty relationships", async ({
  page,
}) => {
  await page.goto(`/world?location=${REGION_SLUG}`);

  // NPC is not a production resource: the handoff's "NPCs Present" panel is
  // omitted entirely rather than stubbed.
  await expect(page.getByText(/NPC/i)).toHaveCount(0);

  // Location facts are always meaningful, so that panel always renders.
  await expect(
    page.getByRole("heading", { level: 3, name: "Location facts", exact: true })
  ).toBeVisible();

  // A region with no directly assigned Shops omits the Shops panel entirely
  // rather than rendering an empty one.
  await expect(
    page.getByRole("heading", { level: 3, name: "Shops", exact: true })
  ).toHaveCount(0);
});

test("the World filter is a real server-rendered GET query", async ({ page }) => {
  await page.goto("/world");

  const search = page.getByRole("search", { name: "Filter locations" });
  await search.getByRole("searchbox").fill(TOWN_NAME);
  await search.getByRole("button", { name: "Filter locations" }).click();

  await expect(page).toHaveURL(/[?&]q=/);
  const tree = page.getByRole("navigation", { name: "World locations" });
  await expect(tree.getByRole("link", { name: TOWN_NAME })).toBeVisible();

  await page.goto("/world?q=Test%20E2E%20No%20Such%20Place");
  await expect(page.locator(".world-sidebar-empty")).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "World locations" })
  ).toHaveCount(0);
});

/** The row bubble the visitor sees, and the link that must own all of it. */
function leafRow(page: Page, name: string) {
  return page.locator(".world-tree-row", {
    has: page.getByRole("link", { name, exact: true }),
  });
}

function branchToggle(page: Page, name: string) {
  return page.getByRole("button", { name: new RegExp(`(Expand|Collapse) ${name}`) });
}

test("the whole highlighted Location row is the click target", async ({ page }) => {
  await page.goto(`/world?location=${REGION_SLUG}`);

  const row = leafRow(page, TOWN_NAME);
  const link = row.getByRole("link", { name: TOWN_NAME, exact: true });

  // Structural guarantee: the row bubble is exactly the link's own box, so no
  // decorative wrapper can create a larger, dead hit area around it.
  const rowBox = (await row.boundingBox())!;
  const linkBox = (await link.boundingBox())!;
  expect(Math.abs(rowBox.width - linkBox.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(rowBox.height - linkBox.height)).toBeLessThanOrEqual(1);

  // Behavioural guarantee: each far corner of the visible bubble activates it.
  const corners = [
    { x: rowBox.x + 3, y: rowBox.y + 3 },
    { x: rowBox.x + rowBox.width - 3, y: rowBox.y + rowBox.height - 3 },
    { x: rowBox.x + 3, y: rowBox.y + rowBox.height - 3 },
  ];

  for (const corner of corners) {
    await page.goto(`/world?location=${REGION_SLUG}`);
    await page.mouse.click(corner.x, corner.y);
    await expect(page).toHaveURL(new RegExp(`location=${TOWN_SLUG}`));
  }

  // Keyboard reachability survives the structural change.
  await link.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`location=${TOWN_SLUG}`));
});

test("branch disclosure toggles, and keeps toggling, without losing content", async ({
  page,
}) => {
  await page.goto(`/world?location=${REGION_SLUG}`);

  const toggle = branchToggle(page, REGION_NAME);
  const child = page.getByRole("link", { name: TOWN_NAME, exact: true });

  // The selected Location's own branch starts revealed.
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(child).toBeVisible();

  for (let pass = 0; pass < 3; pass += 1) {
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(child).toBeHidden();

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(child).toBeVisible();
  }

  // Repeated toggling leaves the branch at its true content height — never a
  // collapsed or clipped box.
  const revealed = await page
    .locator(".world-tree-branch--open")
    .first()
    .boundingBox();
  expect(revealed!.height).toBeGreaterThan(0);
});

test("selecting a Location replays the right-pane entrance and keeps tree state", async ({
  page,
}) => {
  await page.goto(`/world?location=${REGION_SLUG}`);

  const content = page.locator(".world-detail-content");
  await expect(content).toHaveAttribute("data-world-location", REGION_SLUG);

  // The entrance is a real, named animation rather than a screenshot guess.
  await expect
    .poll(() =>
      page
        .locator(".world-detail-path")
        .evaluate((node) =>
          node.getAnimations().map((animation) => (animation as CSSAnimation).animationName)
        )
    )
    .toContain("cx-world-detail-in");

  await page.evaluate(() => {
    (window as unknown as { __worldEntrances: number }).__worldEntrances = 0;
    document.addEventListener(
      "animationstart",
      (event) => {
        if ((event as AnimationEvent).animationName === "cx-world-detail-in") {
          (window as unknown as { __worldEntrances: number }).__worldEntrances += 1;
        }
      },
      true
    );
  });

  await page.getByRole("link", { name: TOWN_NAME, exact: true }).click();

  // The keyed subtree remounts, so the entrance plays again on selection —
  // not only on first load.
  await expect(content).toHaveAttribute("data-world-location", TOWN_SLUG);
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { __worldEntrances: number }).__worldEntrances
      )
    )
    .toBeGreaterThan(0);

  // The key is scoped to the right pane: the tree keeps its own state.
  await expect(branchToggle(page, REGION_NAME)).toHaveAttribute(
    "aria-expanded",
    "true"
  );
  await expect(
    page.locator(".world-tree-row--selected .world-tree-label")
  ).toHaveText(TOWN_NAME);
});

test.describe("under reduced motion", () => {
  test("World Navigation swaps and discloses instantly but still works", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/world?location=${REGION_SLUG}`);

    // The emulation is asserted, not assumed: a silently ignored preference
    // would make every assertion below vacuous.
    expect(
      await page.evaluate(
        () => matchMedia("(prefers-reduced-motion: reduce)").matches
      )
    ).toBe(true);

    // No entrance animation at all — not a delayed or zero-length one.
    await expect
      .poll(() =>
        page
          .locator(".world-detail-path")
          .evaluate((node) => node.getAnimations().length)
      )
      .toBe(0);

    const durations = await page.evaluate(() => {
      const chevron = document.querySelector(".world-tree-chevron")!;
      const branch = document.querySelector(".world-tree-branch")!;
      return [
        getComputedStyle(chevron).transitionDuration,
        getComputedStyle(branch).transitionDuration,
      ];
    });
    for (const duration of durations) {
      expect(duration.split(",").every((part) => part.trim() === "0s")).toBe(true);
    }

    // Interaction is untouched: disclosure and selection both still work.
    const toggle = branchToggle(page, REGION_NAME);
    const child = page.getByRole("link", { name: TOWN_NAME, exact: true });
    await toggle.click();
    await expect(child).toBeHidden();
    await toggle.click();
    await expect(child).toBeVisible();

    await child.click();
    await expect(page).toHaveURL(new RegExp(`location=${TOWN_SLUG}`));
    await expect(
      page.getByRole("heading", { level: 2, name: TOWN_NAME, exact: true })
    ).toBeVisible();
  });
});

test("World Navigation has no horizontal overflow at the calibration widths", async ({
  page,
}) => {
  for (const [width, height] of [
    [1920, 1080],
    [2560, 1440],
    [3440, 1440],
    [1000, 1100],
    [390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto(`/world?location=${TOWN_SLUG}`);
    await expectNoHorizontalOverflow(page);
  }
});
