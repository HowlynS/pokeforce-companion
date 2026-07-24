// Browser coverage for the shared admin record-list viewport/thumbnail
// refinement, against the REAL application, the isolated Supabase test
// project, and its real game-images bucket. This suite deliberately does
// NOT re-prove ground already covered exhaustively elsewhere (full image
// upload/replace/remove/delete lifecycles — see admin-item-images.spec.ts
// and its Recipe/Profession/Location siblings; GET search, q preservation,
// quick-switching mechanics, and empty states — see each resource's own
// admin-<resource>.spec.ts). It targets only what THIS refinement changed:
// RecordList's image-capable row mode (thumbnail + fallback), the
// record-list column's viewport-bounded height with internally scrolling
// rows, and — added by the row visual polish pass — the row's own visual
// contract: a populated media slot with no framed tile, a restrained
// dashed missing-image slot, hover that shifts the surface without moving
// anything, a selected state stronger than hover on more than colour
// alone, a keyboard focus ring that survives the column's clipping, and
// line-bounded text that keeps long names from overflowing or stretching
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
// proven per-resource in record-list.test.tsx). Nothing seeds a Location
// either, so the fifth resource list gets its own guarded temporary
// record rather than sharing the four-route loop.

import { expect, test, type Locator, type Page } from "@playwright/test";
import { selectAdminOption } from "./helpers/admin-select";
import path from "node:path";
import {
  countE2eTestItemImageRecords,
  countE2eTestLocationRecords,
  countItemFolderObjects,
  deleteE2eTestItemImageRecords,
  deleteE2eTestLocationRecords,
} from "./helpers/database-cleanup";

const PNG_FIXTURE = path.join(__dirname, "fixtures", "tiny-valid.png");

// The one gold accent the whole admin surface shares
// (--color-accent: #facc15), as Chromium resolves it. Matches the
// existing pattern in admin-visual-consistency.spec.ts — the only
// exact-color assertions in this suite are against a flat token value,
// never an anti-aliased or blended surface.
const GOLD_ACCENT_RGB = "rgb(250, 204, 21)";

// Chromium's computed value for a fully transparent background.
const TRANSPARENT = "rgba(0, 0, 0, 0)";

/**
 * True when a computed colour carries an alpha below 1. Chromium
 * serialises a color-mix() result as `color(srgb r g b / a)` and plain
 * values as `rgb(...)` / `rgba(..., a)`, so both forms are handled — the
 * assertion is about translucency, never about an exact blended colour.
 */
function isTranslucent(color: string): boolean {
  const modern = color.match(/\/\s*([\d.]+)\s*\)$/);
  if (modern) {
    return Number(modern[1]) < 1;
  }
  const legacy = color.match(/^rgba\([^)]*,\s*([\d.]+)\s*\)$/);
  if (legacy) {
    return Number(legacy[1]) < 1;
  }
  return false;
}

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

/** The row-state channels the visual pass touches, read in one round trip. */
function rowStyles(row: Locator) {
  return row.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      backgroundColor: style.backgroundColor,
      borderLeftColor: style.borderLeftColor,
      borderLeftWidth: style.borderLeftWidth,
      boxShadow: style.boxShadow,
    };
  });
}

/** The media-slot channels that decide whether a framed tile is drawn. */
function thumbStyles(thumb: Locator) {
  return thumb.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      borderTopWidth: style.borderTopWidth,
      borderRightWidth: style.borderRightWidth,
      borderBottomWidth: style.borderBottomWidth,
      borderLeftWidth: style.borderLeftWidth,
      borderTopStyle: style.borderTopStyle,
      backgroundColor: style.backgroundColor,
      backgroundImage: style.backgroundImage,
      boxShadow: style.boxShadow,
    };
  });
}

test("Items, Recipes, Professions, and Categories record lists render image-capable rows with the same fixed media slot", async ({
  page,
}) => {
  // Categories joined the image-capable resources in the Category Images
  // slice — every converted resource now shares the same thumbnail mode.
  // (Locations are covered separately below: nothing seeds a Location, so
  // that list needs a temporary record before it has any row at all.)
  for (const route of [
    "/admin/items",
    "/admin/recipes",
    "/admin/professions",
    "/admin/categories",
  ]) {
    await page.goto(route);

    const firstRow = recordRows(page).locator(".admin-record-link-media").first();
    await expect(firstRow).toBeVisible();

    const firstThumb = recordRows(page)
      .locator(".admin-record-thumb-wrap")
      .first();
    await expect(firstThumb).toBeVisible();
    // The reserved alignment area is unchanged by the visual pass — only
    // what is (or is not) drawn inside it changed.
    await expect(firstThumb).toHaveCSS("width", "64px");
    await expect(firstThumb).toHaveCSS("height", "64px");

    // Both text tiers stay rendered beside the media slot.
    await expect(firstRow.locator(".admin-record-primary")).toBeVisible();
  }
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
  await page.getByLabel(/^Page address/).fill(ITEM.slug);
  await selectAdminOption(
    page.getByRole("combobox", { name: "Category", exact: true }),
    "Materials"
  );
  await page.locator('input[name="image"]').setInputFiles(PNG_FIXTURE);
  await page.getByRole("button", { name: "Create item", exact: true }).click();
  await expect(page).toHaveURL(`/admin/items/${ITEM.slug}/edit`);

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

  // --- The populated slot draws NO framed tile ------------------------
  // Transparent sprites must float in the reserved area: no border on any
  // edge, no opaque canvas behind the artwork, no shadow/glow/ring. The
  // image itself still scales without cropping or distortion.
  const populated = await thumbStyles(imageThumb);
  expect(populated.borderTopWidth).toBe("0px");
  expect(populated.borderRightWidth).toBe("0px");
  expect(populated.borderBottomWidth).toBe("0px");
  expect(populated.borderLeftWidth).toBe("0px");
  expect(populated.backgroundColor).toBe(TRANSPARENT);
  expect(populated.backgroundImage).toBe("none");
  expect(populated.boxShadow).toBe("none");
  await expect(img).toHaveCSS("object-fit", "contain");

  // --- The empty slot stays present, restrained, and clearly distinct --
  // A faint dashed outline over a translucent fill: visible enough to
  // explain the reserved space, quiet enough never to read as a real
  // thumbnail or an empty form input.
  const fallback = await thumbStyles(fallbackThumb);
  expect(parseFloat(fallback.borderTopWidth)).toBeGreaterThan(0);
  expect(fallback.borderTopStyle).toBe("dashed");
  expect(fallback.backgroundColor).not.toBe(TRANSPARENT);
  // Translucent, not an opaque tile.
  expect(
    isTranslucent(fallback.backgroundColor),
    `the fallback fill must stay translucent, got ${fallback.backgroundColor}`
  ).toBe(true);
  expect(fallback.boxShadow).toBe("none");
  // And unmistakably a different treatment from the populated slot.
  expect(fallback.backgroundColor).not.toBe(populated.backgroundColor);
  expect(fallback.borderTopWidth).not.toBe(populated.borderTopWidth);
});

test("the selected row reads more strongly than an ordinary row, and hover shifts the surface without moving anything", async ({
  page,
}) => {
  // Seeded fixture only — opened read-only so its row is the selected one.
  await page.goto("/admin/items/iron-ore/edit");

  const selected = recordRows(page).locator(
    '.admin-record-link[aria-current="page"]'
  );
  await expect(selected).toHaveCount(1);

  const ordinary = recordRows(page)
    .locator('.admin-record-link:not([aria-current="page"])')
    .first();
  await expect(ordinary).toBeVisible();

  const selectedStyles = await rowStyles(selected);
  const restingStyles = await rowStyles(ordinary);

  // Selection is signalled on three independent channels, so it never
  // depends on colour alone: a tinted surface, a solid gold left edge,
  // and the inset shadow that visually doubles that edge.
  expect(selectedStyles.backgroundColor).not.toBe(restingStyles.backgroundColor);
  expect(selectedStyles.borderLeftColor).toBe(GOLD_ACCENT_RGB);
  expect(selectedStyles.borderLeftColor).not.toBe(restingStyles.borderLeftColor);
  expect(selectedStyles.boxShadow).not.toBe("none");
  expect(restingStyles.boxShadow).toBe("none");
  // The reserved left edge is the same width in both states, so moving
  // the selection can never reflow a row.
  expect(selectedStyles.borderLeftWidth).toBe(restingStyles.borderLeftWidth);

  // --- Hover: surface changes, geometry does not ----------------------
  const boxBefore = await ordinary.boundingBox();
  expect(boxBefore, "the hovered row must have a bounding box").not.toBeNull();

  await ordinary.hover();
  // Poll rather than sleep: the surface transitions over 0.15s.
  await expect
    .poll(
      () => ordinary.evaluate((el) => getComputedStyle(el).backgroundColor),
      { message: "hover must change the row surface" }
    )
    .not.toBe(restingStyles.backgroundColor);

  const hoveredStyles = await rowStyles(ordinary);
  // Hover stays clearly weaker than selection.
  expect(hoveredStyles.backgroundColor).not.toBe(selectedStyles.backgroundColor);
  expect(hoveredStyles.boxShadow).toBe("none");

  const boxAfter = await ordinary.boundingBox();
  expect(boxAfter).not.toBeNull();
  // No transform, no scale, no size change — a small tolerance only for
  // subpixel layout rounding.
  expect(Math.abs(boxAfter!.x - boxBefore!.x)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(boxAfter!.y - boxBefore!.y)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(boxAfter!.width - boxBefore!.width)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(boxAfter!.height - boxBefore!.height)).toBeLessThanOrEqual(0.5);
});

test("a record row keeps a visible gold focus ring when reached from the keyboard", async ({
  page,
}) => {
  await page.goto("/admin/items");

  // Enter the column at its search field, then tab forward until focus
  // lands on a record row. Bounded, and keyboard-driven so :focus-visible
  // genuinely applies (a programmatic .focus() would not match it).
  await page.getByRole("searchbox", { name: "Search items" }).click();

  let focusedRow = false;
  for (let press = 0; press < 6 && !focusedRow; press += 1) {
    await page.keyboard.press("Tab");
    focusedRow = await page.evaluate(() =>
      Boolean(
        document.activeElement?.classList.contains("admin-record-link")
      )
    );
  }
  expect(focusedRow, "tabbing forward must reach a record row").toBe(true);

  const outline = await page.evaluate(() => {
    const style = getComputedStyle(document.activeElement as HTMLElement);
    return {
      style: style.outlineStyle,
      width: style.outlineWidth,
      color: style.outlineColor,
    };
  });
  expect(outline.style).toBe("solid");
  expect(parseFloat(outline.width)).toBeGreaterThanOrEqual(2);
  expect(outline.color).toBe(GOLD_ACCENT_RGB);
});

/**
 * Creates one temporary Location through the real admin form. The slug
 * MUST carry the suite's browser-test Location prefix, so afterEach's
 * prefix-scoped cleanup always reclaims it.
 *
 * The Name field runs a debounced availability check as a Server Action
 * (RecordNameField). Next.js serialises Server Actions, so clicking
 * Create while that check is still in flight queues the submission
 * behind it — under a loaded dev server that queueing can outlast the
 * navigation assertion. Waiting for the live region to leave its
 * "Checking…" state is a real readiness signal (polled by the web-first
 * assertion, never a fixed sleep) and removes the race. This suite
 * creates two Locations back to back, which is what exposed it.
 */
async function createTestLocation(
  page: Page,
  location: { name: string; slug: string }
): Promise<void> {
  expect(location.slug.startsWith("test-e2e-location")).toBe(true);

  await page.goto("/admin/locations/new");
  await page.getByLabel("Name", { exact: true }).fill(location.name);
  await page.getByLabel(/^Page address/).fill(location.slug);
  await selectAdminOption(
    page.getByRole("combobox", { name: "Type", exact: true }),
    "Town"
  );

  // Settled = anything other than the in-flight message; the component
  // never blocks submission, so every settled outcome is fine here.
  await expect(page.locator("#location-name-availability")).not.toHaveText(
    "Checking name availability..."
  );

  await page
    .getByRole("button", { name: "Create Location", exact: true })
    .click();
  await expect(page).toHaveURL(`/admin/locations/${location.slug}/edit`);
}

test("the Locations list joins the same image-capable layout, and a Location without an image shows the hidden fallback slot", async ({
  page,
}) => {
  const LOCATION = {
    name: "Test E2E Location Recordlist",
    slug: "test-e2e-location-recordlist",
  };

  // Nothing seeds a Location, so the fifth resource list needs one row
  // before it can be compared with the other four.
  await createTestLocation(page, LOCATION);

  const row = recordRow(page, "Locations", LOCATION.name);
  await expect(row).toHaveClass(/admin-record-link-media/);

  const thumb = thumbWrap(row);
  await expect(thumb).toHaveClass(/admin-record-thumb-empty/);
  await expect(thumb).toHaveAttribute("aria-hidden", "true");
  await expect(thumb.locator("img")).toHaveCount(0);
  await expect(thumb).toHaveCSS("width", "64px");
  await expect(thumb).toHaveCSS("height", "64px");

  // Both text tiers render beside it, exactly as on the other four lists.
  await expect(row.locator(".admin-record-primary")).toBeVisible();
  await expect(row.locator(".admin-record-secondary")).toBeVisible();
});

test("a very long record name stays inside the column and never stretches the row past the media slot", async ({
  page,
}) => {
  const SHORT = {
    name: "Test E2E Location Recordlist Short",
    slug: "test-e2e-location-recordlist-short",
  };
  const LONG = {
    name: "Test E2E Location Recordlist Extraordinarily Long Descriptive Name That Must Not Overflow",
    slug: "test-e2e-location-recordlist-long",
  };

  await createTestLocation(page, SHORT);
  await createTestLocation(page, LONG);

  const longRow = recordRow(page, "Locations", LONG.name);
  const shortRow = recordRow(page, "Locations", SHORT.name);
  await expect(longRow).toBeVisible();
  await expect(shortRow).toBeVisible();

  // Neither the column nor its scrolling row region gains horizontal
  // overflow (a small tolerance for subpixel layout rounding).
  const listOverflowX = await recordList(page).evaluate(
    (el) => el.scrollWidth - el.clientWidth
  );
  expect(listOverflowX).toBeLessThanOrEqual(1);
  const rowsOverflowX = await recordRows(page).evaluate(
    (el) => el.scrollWidth - el.clientWidth
  );
  expect(rowsOverflowX).toBeLessThanOrEqual(1);

  const listBox = await recordList(page).boundingBox();
  const longBox = await longRow.boundingBox();
  const shortBox = await shortRow.boundingBox();
  expect(listBox).not.toBeNull();
  expect(longBox).not.toBeNull();
  expect(shortBox).not.toBeNull();
  expect(longBox!.width).toBeLessThanOrEqual(listBox!.width + 1);

  // The name is line-bounded, so one unusually long record does not make
  // its row taller than every other row: the 64px media slot still sets
  // the height for both.
  expect(Math.abs(longBox!.height - shortBox!.height)).toBeLessThanOrEqual(1);
  await expect(thumbWrap(longRow)).toHaveCSS("height", "64px");

  // Both tiers stay rendered — clamped, never removed.
  await expect(longRow.locator(".admin-record-primary")).toBeVisible();
  await expect(longRow.locator(".admin-record-secondary")).toBeVisible();
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
