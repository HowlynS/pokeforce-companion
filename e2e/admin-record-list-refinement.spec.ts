// Browser coverage for the shared admin record-list viewport/thumbnail
// refinement, against the REAL application, the isolated Supabase test
// project, and its real game-images bucket. This suite deliberately does
// NOT re-prove ground already covered exhaustively elsewhere (full image
// upload/replace/remove/delete lifecycles — see admin-item-images.spec.ts
// and its Recipe/Profession/Location siblings; GET search, q preservation,
// quick-switching mechanics, and empty states — see each resource's own
// admin-<resource>.spec.ts). It targets only what THIS refinement changed:
// RecordList's new image-capable row mode (thumbnail + fallback) and the
// record-list column's viewport-bounded height with internally scrolling
// rows. At the time this suite was written, Categories had not yet joined
// the image-capable resources — the Category Images slice added that
// afterward (see admin-category-images.spec.ts), so this suite's own
// Categories check now proves the same thumbnail mode applies there too.
//
// No seed fixture carries a stored image (the seed script never sets
// `image`), so every seeded row already exercises the missing-image
// fallback — only the "real thumbnail" case needs a temporary upload, and
// only Item's upload path is exercised here since the thumbnail markup
// itself lives entirely in the one shared RecordList component (already
// proven per-resource in record-list.test.tsx).

import { expect, test, type Locator, type Page } from "@playwright/test";
import path from "node:path";
import {
  countE2eTestItemImageRecords,
  countE2eTestLocationRecords,
  countItemFolderObjects,
  deleteE2eTestItemImageRecords,
  deleteE2eTestLocationRecords,
} from "./helpers/database-cleanup";

const PNG_FIXTURE = path.join(__dirname, "fixtures", "tiny-valid.png");

// A seeded Item, referenced read-only: never assigned an image by the
// seed script, so its record-list row always renders the fallback slot.
const SEEDED_ITEM_WITHOUT_IMAGE = "Iron Ore";

let itemFolderBaseline = 0;

// Browser error hygiene: any uncaught page error fails the test. Serial
// single-worker execution makes this module-level state safe.
let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(async () => {
  // Defensive cleanup even when a test failed mid-flow: exact recorded
  // Storage objects first (via the Item-image helper), then the
  // prefix-scoped Location rows.
  await deleteE2eTestItemImageRecords();
  await deleteE2eTestLocationRecords();
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

test.beforeAll(async () => {
  // Remove stale rows/objects from interrupted earlier runs; the guard
  // inside the helper throws here if the environment is not the verified
  // test project. Only then is the folder baseline recorded.
  await deleteE2eTestItemImageRecords();
  await deleteE2eTestLocationRecords();
  expect(await countE2eTestItemImageRecords()).toBe(0);
  expect(await countE2eTestLocationRecords()).toBe(0);
  itemFolderBaseline = await countItemFolderObjects();
});

test.afterAll(async () => {
  const remaining =
    (await deleteE2eTestItemImageRecords()) +
    (await deleteE2eTestLocationRecords());
  // afterEach should already have removed everything — fail loudly if not.
  expect(remaining).toBe(0);
});

function recordRow(page: Page, listName: string, primary: string): Locator {
  return page
    .getByRole("navigation", { name: `${listName} records` })
    .getByRole("link")
    .filter({ has: page.getByText(primary, { exact: true }) });
}

function recordList(page: Page): Locator {
  return page.locator(".admin-record-list");
}

function recordRows(page: Page): Locator {
  return page.locator(".admin-record-rows");
}

function thumbWrap(row: Locator): Locator {
  return row.locator(".admin-record-thumb-wrap");
}

test("Items, Recipes, Professions, and Categories record lists render image-capable rows", async ({
  page,
}) => {
  // Categories joined the image-capable resources in the Category Images
  // slice — every converted resource now shares the same thumbnail mode.
  await page.goto("/admin/items");
  await expect(
    recordRows(page).locator(".admin-record-thumb-wrap").first()
  ).toBeVisible();
  await expect(
    recordRows(page).locator(".admin-record-link-media").first()
  ).toBeVisible();

  await page.goto("/admin/recipes");
  await expect(
    recordRows(page).locator(".admin-record-thumb-wrap").first()
  ).toBeVisible();

  await page.goto("/admin/professions");
  await expect(
    recordRows(page).locator(".admin-record-thumb-wrap").first()
  ).toBeVisible();

  await page.goto("/admin/categories");
  await expect(
    recordRows(page).locator(".admin-record-thumb-wrap").first()
  ).toBeVisible();
  await expect(
    recordRows(page).locator(".admin-record-link-media").first()
  ).toBeVisible();
});

test("a real uploaded image renders a decoded, decorative thumbnail; a seeded item without one shows the hidden fallback", async ({
  page,
}) => {
  const ITEM = {
    name: "Test E2E Item Image Recordlist",
    slug: "test-e2e-item-image-recordlist",
  };

  await page.goto("/admin/items/new");
  await page.getByLabel("Name", { exact: true }).fill(ITEM.name);
  await page.getByLabel(/^Slug/).fill(ITEM.slug);
  await page
    .getByRole("combobox", { name: "Category", exact: true })
    .selectOption({ label: "Materials" });
  await page.getByLabel(/^Image \(optional/).setInputFiles(PNG_FIXTURE);
  await page.getByRole("button", { name: "Create item", exact: true }).click();
  await expect(page).toHaveURL("/admin/items?success=created");

  // --- Real thumbnail: decoded, decorative (empty alt) ---------------
  const imageRow = recordRow(page, "Items", ITEM.name);
  const imageThumb = thumbWrap(imageRow);
  await expect(imageThumb).not.toHaveClass(/admin-record-thumb-empty/);
  const img = imageThumb.locator("img.admin-record-thumb-img");
  await img.scrollIntoViewIfNeeded();
  await expect(img).toHaveAttribute("alt", "");
  await expect
    .poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth), {
      message: "the thumbnail must decode to a non-zero natural width",
    })
    .toBeGreaterThan(0);

  // --- Missing-image fallback: no <img>, hidden from assistive tech --
  const fallbackRow = recordRow(page, "Items", SEEDED_ITEM_WITHOUT_IMAGE);
  const fallbackThumb = thumbWrap(fallbackRow);
  await expect(fallbackThumb).toHaveClass(/admin-record-thumb-empty/);
  await expect(fallbackThumb).toHaveAttribute("aria-hidden", "true");
  await expect(fallbackThumb.locator("img")).toHaveCount(0);

  // Every row still reserves the same fixed media slot regardless of
  // which records happen to have an image.
  await expect(thumbWrap(imageRow)).toHaveCSS("width", "64px");
  await expect(thumbWrap(imageRow)).toHaveCSS("height", "64px");
  await expect(thumbWrap(fallbackRow)).toHaveCSS("width", "64px");
  await expect(thumbWrap(fallbackRow)).toHaveCSS("height", "64px");
});

test("a Location without an image shows the same hidden fallback slot", async ({
  page,
}) => {
  const LOCATION = {
    name: "Test E2E Location Recordlist",
    slug: "test-e2e-location-recordlist",
  };

  await page.goto("/admin/locations/new");
  await page.getByLabel("Name", { exact: true }).fill(LOCATION.name);
  await page.getByLabel(/^Slug/).fill(LOCATION.slug);
  await page
    .getByRole("combobox", { name: "Type", exact: true })
    .selectOption({ label: "Town" });
  await page
    .getByRole("button", { name: "Create Location", exact: true })
    .click();
  await expect(page).toHaveURL("/admin/locations?success=created");

  const row = recordRow(page, "Locations", LOCATION.name);
  const thumb = thumbWrap(row);
  await expect(thumb).toHaveClass(/admin-record-thumb-empty/);
  await expect(thumb).toHaveAttribute("aria-hidden", "true");
  await expect(thumb.locator("img")).toHaveCount(0);
});

test("quick switching between items keeps exactly one selected row, unaffected by the media layout", async ({
  page,
}) => {
  await page.goto("/admin/items");
  const row = recordRow(page, "Items", SEEDED_ITEM_WITHOUT_IMAGE);
  await row.click();
  await expect(page).toHaveURL(new RegExp(`/admin/items/[^/]+/edit`));

  const selectedRow = recordRow(page, "Items", SEEDED_ITEM_WITHOUT_IMAGE);
  await expect(selectedRow).toHaveAttribute("aria-current", "page");
  await expect(
    recordRows(page).locator('[aria-current="page"]')
  ).toHaveCount(1);
});

test("at a deliberately short desktop viewport, the record-list column stays within the viewport and its row region scrolls internally", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await page.goto("/admin/items");

  const list = recordList(page);
  const rows = recordRows(page);

  // The column is sticky (top: 24px): at scroll position 0 it still sits
  // in normal document flow below the page header, so its bounding box
  // only reflects the viewport cap once scrolled far enough to engage.
  // Scrolling the page fully forces that, which is exactly the scenario
  // the cap exists for (a long page with the list still fully reachable).
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const listBox = await list.boundingBox();
  expect(listBox, "the record-list column must have a bounding box").not.toBeNull();
  // A small tolerance for subpixel layout rounding.
  expect(listBox!.y + listBox!.height).toBeLessThanOrEqual(600 + 1);
  expect(listBox!.y).toBeGreaterThanOrEqual(0);

  // No horizontal overflow anywhere in the column.
  const listOverflowX = await list.evaluate(
    (el) => el.scrollWidth - el.clientWidth
  );
  expect(listOverflowX).toBeLessThanOrEqual(1);
  const rowsOverflowX = await rows.evaluate(
    (el) => el.scrollWidth - el.clientWidth
  );
  expect(rowsOverflowX).toBeLessThanOrEqual(1);

  // With 16 seeded items, the row region's content is taller than its
  // visible area at this height — it must overflow internally.
  const { scrollHeight, clientHeight } = await rows.evaluate((el) => ({
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
  }));
  expect(scrollHeight).toBeGreaterThan(clientHeight);

  // The row region itself is the element that scrolls (not the page).
  await rows.evaluate((el) => {
    el.scrollTop = 40;
  });
  const scrolledTop = await rows.evaluate((el) => el.scrollTop);
  expect(scrolledTop).toBeGreaterThan(0);
});

test("a taller viewport gives the row region more visible height than a short one", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await page.goto("/admin/items");
  const shortHeight = await recordRows(page).evaluate((el) => el.clientHeight);

  await page.setViewportSize({ width: 1280, height: 1100 });
  // Re-render at the new viewport size (CSS is viewport-relative; no
  // navigation is needed, but a fresh layout pass is worth forcing via a
  // reload to avoid relying on incidental resize-relayout timing).
  await page.reload();
  const tallHeight = await recordRows(page).evaluate((el) => el.clientHeight);

  expect(tallHeight).toBeGreaterThan(shortHeight);
});

test("seeded fixtures are preserved and no suite row, object, or image remains", async () => {
  expect(await countE2eTestItemImageRecords()).toBe(0);
  expect(await countE2eTestLocationRecords()).toBe(0);
  expect(await countItemFolderObjects()).toBe(itemFolderBaseline);
});
