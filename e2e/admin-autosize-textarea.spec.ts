// Authenticated coverage for the shared AutosizeTextarea (Admin
// Visual/UX Correction pass, follow-up #2) against the REAL application
// and the isolated Supabase test project. This is deliberately E2E, not
// a Vitest unit/component test: the behavior under test (measuring
// scrollHeight, growing/shrinking the rendered height on every
// keystroke or paste, capping growth and switching to internal
// scrolling) only exists in a real browser — this codebase's unit suite
// runs in a Node (non-jsdom) environment with no DOM, and
// react-dom/server static renders never run effects at all (see
// autosize-textarea.test.tsx for what IS covered there: prop
// forwarding, class application, no value transformation). Runs in the
// chromium-admin project with the storage state saved by auth.setup.ts.
//
// Every test uses the Item General editor's Description field (present
// on create and edit, and directly comparable to the pre-conversion
// fixed rows={4} textarea) — the underlying resize logic is identical
// for every converted field (Category/Profession/Location Description,
// Location Extra information, Acquisition Source Notes), so this one
// field is the representative, focused target rather than re-testing
// the same mechanism five more times.

import { expect, test, type Page } from "@playwright/test";
import {
  countE2eTestItemRecords,
  deleteE2eTestItemRecords,
} from "./helpers/database-cleanup";

const SHORT_TEXT = "A short description.";
// Long enough to exceed the ~7.5rem (120px) minimum but comfortably
// under the ~28rem (448px) maximum at a 16px root font size.
const LONG_TEXT = Array.from(
  { length: 10 },
  (_, i) => `Paragraph line ${i + 1} of a longer pasted description.`
).join("\n");
// Long enough to exceed the ~28rem (448px) maximum and force internal
// scrolling.
const VERY_LONG_TEXT = Array.from(
  { length: 40 },
  (_, i) => `Line ${i + 1} of a very long pasted description that keeps going.`
).join("\n");

let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(async () => {
  await deleteE2eTestItemRecords();
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

test.beforeAll(async () => {
  await deleteE2eTestItemRecords();
  expect(await countE2eTestItemRecords()).toBe(0);
});

test.afterAll(async () => {
  const remaining = await deleteE2eTestItemRecords();
  expect(remaining).toBe(0);
});

function descriptionField(page: Page) {
  return page.getByLabel(/^Description/);
}

async function heightOf(page: Page) {
  const box = await descriptionField(page).boundingBox();
  return box!.height;
}

async function overflowYOf(page: Page) {
  return descriptionField(page).evaluate(
    (el) => getComputedStyle(el).overflowY
  );
}

test("a blank/short field renders at the shared minimum height, with no internal scrollbar", async ({
  page,
}) => {
  await page.goto("/admin/items/new");

  const blankHeight = await heightOf(page);
  // ~7.5rem at the default 16px root — a tolerant range rather than an
  // exact pixel match, since border/box-sizing can shift it a couple of
  // pixels either way.
  expect(blankHeight).toBeGreaterThanOrEqual(110);
  expect(blankHeight).toBeLessThanOrEqual(135);
  expect(await overflowYOf(page)).toBe("hidden");

  await descriptionField(page).fill(SHORT_TEXT);
  const shortHeight = await heightOf(page);
  // A single short sentence still fits comfortably inside the minimum —
  // no visible growth for genuinely short content.
  expect(shortHeight).toBeLessThanOrEqual(135);
});

test("typing long content grows the textarea immediately, past the minimum height", async ({
  page,
}) => {
  await page.goto("/admin/items/new");

  const before = await heightOf(page);
  await descriptionField(page).fill(LONG_TEXT);
  const after = await heightOf(page);

  expect(after).toBeGreaterThan(before + 40);
  // Still comfortably under the maximum — no internal scrollbar yet.
  expect(after).toBeLessThan(448);
  expect(await overflowYOf(page)).toBe("hidden");
});

test("pasting large content grows the textarea to fit — the same input-event pathway a real clipboard paste uses", async ({
  page,
}) => {
  await page.goto("/admin/items/new");

  // Playwright has no built-in OS clipboard paste simulation without
  // extra permissions; .fill() sets the value and dispatches the same
  // native "input" event a real paste produces once the browser has
  // already inserted the pasted text — exactly the event this
  // component's onChange listens to, so this exercises the identical
  // code path.
  await descriptionField(page).fill(LONG_TEXT);
  const height = await heightOf(page);

  expect(height).toBeGreaterThan(150);
  expect(height).toBeLessThan(448);
});

test("removing content shrinks the textarea back down", async ({ page }) => {
  await page.goto("/admin/items/new");

  await descriptionField(page).fill(LONG_TEXT);
  const grown = await heightOf(page);
  expect(grown).toBeGreaterThan(150);

  await descriptionField(page).fill(SHORT_TEXT);
  const shrunk = await heightOf(page);

  expect(shrunk).toBeLessThan(grown);
  expect(shrunk).toBeLessThanOrEqual(135);
});

test("content far exceeding the maximum caps growth and switches to internal scrolling — never before the cap", async ({
  page,
}) => {
  await page.goto("/admin/items/new");

  await descriptionField(page).fill(VERY_LONG_TEXT);
  const height = await heightOf(page);

  // Capped at ~28rem (448px) — a tolerant range for border/box-sizing.
  expect(height).toBeGreaterThanOrEqual(440);
  expect(height).toBeLessThanOrEqual(460);
  expect(await overflowYOf(page)).toBe("auto");

  // The field is still fully usable — scrolled content remains reachable
  // and the field keeps accepting input.
  await expect(descriptionField(page)).toBeVisible();
  await expect(descriptionField(page)).toBeEditable();
});

test("initial persisted long content sets the correct expanded height on first render, before any interaction", async ({
  page,
}) => {
  const ITEM = {
    name: "Test E2E Item Autosize Initial",
    slug: "test-e2e-item-autosize-initial",
  };

  // Create it with long content through the real form first.
  await page.goto("/admin/items/new");
  await page.getByLabel("Name", { exact: true }).fill(ITEM.name);
  await page.getByLabel(/^Page address/).fill(ITEM.slug);
  await descriptionField(page).fill(LONG_TEXT);
  await page.getByRole("button", { name: "Create item", exact: true }).click();
  // Creation redirects straight to the new item's own editor (Admin
  // Polish Pass 2, Part 2) — a completely fresh render, no typing or
  // interaction with the field at all — which must already show the
  // expanded height derived from the persisted content alone.
  await expect(page).toHaveURL(`/admin/items/${ITEM.slug}/edit`);
  const height = await heightOf(page);

  expect(height).toBeGreaterThan(150);
  expect(height).toBeLessThan(448);
});

test("the submitted form value is exactly what was typed — no value transformation from the resize behavior", async ({
  page,
}) => {
  const ITEM = {
    name: "Test E2E Item Autosize Submission",
    slug: "test-e2e-item-autosize-submission",
  };

  await page.goto("/admin/items/new");
  await page.getByLabel("Name", { exact: true }).fill(ITEM.name);
  await page.getByLabel(/^Page address/).fill(ITEM.slug);
  await descriptionField(page).fill(VERY_LONG_TEXT);
  await page.getByRole("button", { name: "Create item", exact: true }).click();
  await expect(page).toHaveURL(`/admin/items/${ITEM.slug}/edit`);
  // The exact same text round-trips through persistence and back into
  // the field, byte-for-byte — proves the resize logic never touched
  // the field's actual value.
  await expect(descriptionField(page)).toHaveValue(VERY_LONG_TEXT);
});
