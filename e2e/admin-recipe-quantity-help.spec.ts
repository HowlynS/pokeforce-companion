// Authenticated E2E coverage for the shared info-tooltip pattern on the
// Recipe General editor (Opus Pass 1). Runs in the chromium-admin project
// with the storage state saved by auth.setup.ts. These tests are strictly
// read-only: they exercise the two quantity-help tooltips (structure,
// hover, keyboard focus, click/tap, Escape, outside-click, one-open-at-a-
// time, no layout shift/overflow) on the create page and a seeded recipe's
// edit page WITHOUT ever submitting a form, so no database row is created
// or modified and no cleanup is required.
//
// The interactive tooltip behavior lives here rather than in a Node
// component test because the shared component-test approach renders to
// static markup only (no DOM, no events) — the same static-vs-browser
// split AutosizeTextarea and RecordSlugField already use.

import { expect, test, type Locator, type Page } from "@playwright/test";

// A representative wide admin width, where the Output card's Minimum and
// Maximum fields sit side by side — the layout the approved mock-up targets.
test.use({ viewport: { width: 1440, height: 900 } });

const MIN_TRIGGER_NAME = "More information about Minimum quantity";
const MAX_TRIGGER_NAME = "More information about Maximum quantity";
const MIN_COPY = "The smallest number of items this recipe can produce.";
const MAX_COPY =
  "The largest number of items this recipe can produce. Use the same value as minimum when the output is fixed.";

// Browser error hygiene: any uncaught page error fails the test.
let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(() => {
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

function minTrigger(page: Page): Locator {
  return page.getByRole("button", { name: MIN_TRIGGER_NAME, exact: true });
}

function maxTrigger(page: Page): Locator {
  return page.getByRole("button", { name: MAX_TRIGGER_NAME, exact: true });
}

function minTooltip(page: Page): Locator {
  return page.getByText(MIN_COPY, { exact: true });
}

function maxTooltip(page: Page): Locator {
  return page.getByText(MAX_COPY, { exact: true });
}

test("the Output card keeps its labels, inputs, and Resulting item, with the help copy tucked into tooltips rather than permanent paragraphs", async ({
  page,
}) => {
  await page.goto("/admin/recipes/new");

  // The Output section heading is unchanged.
  await expect(
    page.getByRole("heading", { level: 2, name: "Output", exact: true })
  ).toBeVisible();

  // Resulting item control and both quantity inputs remain present and
  // labeled exactly as before.
  await expect(
    page.getByRole("combobox", { name: "Resulting item", exact: true })
  ).toBeVisible();
  await expect(page.getByLabel("Minimum quantity", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Maximum quantity", { exact: true })).toBeVisible();

  // Both info triggers are present with their accessible names.
  await expect(minTrigger(page)).toBeVisible();
  await expect(maxTrigger(page)).toBeVisible();

  // The former permanent helper paragraphs are gone: the copy now exists
  // ONLY inside the closed (hidden) tooltips, so it is not visible at rest.
  await expect(minTooltip(page)).toBeHidden();
  await expect(maxTooltip(page)).toBeHidden();
});

test("hovering the Minimum info icon opens its tooltip; moving away closes it", async ({
  page,
}) => {
  await page.goto("/admin/recipes/new");

  await minTrigger(page).hover();
  await expect(minTooltip(page)).toBeVisible();

  // Move the pointer well away from the trigger and its tooltip.
  await page.getByRole("heading", { level: 1 }).hover();
  await expect(minTooltip(page)).toBeHidden();
});

test("keyboard-focusing the Maximum info icon opens its tooltip; Escape closes it", async ({
  page,
}) => {
  await page.goto("/admin/recipes/new");

  await maxTrigger(page).focus();
  await expect(maxTrigger(page)).toBeFocused();
  await expect(maxTooltip(page)).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(maxTooltip(page)).toBeHidden();
  // Focus is preserved on the trigger (the content is non-interactive, so
  // focus never moved into it).
  await expect(maxTrigger(page)).toBeFocused();
});

test("clicking a trigger opens its tooltip; clicking outside closes it", async ({
  page,
}) => {
  await page.goto("/admin/recipes/new");

  await minTrigger(page).click();
  await expect(minTooltip(page)).toBeVisible();

  // A pointerdown outside the trigger/tooltip closes it.
  await page.getByRole("heading", { level: 1 }).click();
  await expect(minTooltip(page)).toBeHidden();
});

test("only one tooltip is open at a time", async ({ page }) => {
  await page.goto("/admin/recipes/new");

  await minTrigger(page).focus();
  await expect(minTooltip(page)).toBeVisible();

  // Focusing the other trigger opens ITS tooltip and closes the first.
  await maxTrigger(page).focus();
  await expect(maxTooltip(page)).toBeVisible();
  await expect(minTooltip(page)).toBeHidden();
});

test("the quantity inputs still accept values, and opening a tooltip causes no layout shift or horizontal overflow", async ({
  page,
}) => {
  await page.goto("/admin/recipes/new");

  const minInput = page.getByLabel("Minimum quantity", { exact: true });
  const maxInput = page.getByLabel("Maximum quantity", { exact: true });

  await minInput.fill("2");
  await maxInput.fill("3");
  await expect(minInput).toHaveValue("2");
  await expect(maxInput).toHaveValue("3");

  // The input's own box before opening the tooltip.
  const before = await minInput.boundingBox();
  expect(before).not.toBeNull();

  await minTrigger(page).hover();
  await expect(minTooltip(page)).toBeVisible();

  // The tooltip is absolutely positioned, so the field it annotates must
  // not move when it opens (no layout shift).
  const after = await minInput.boundingBox();
  expect(after).not.toBeNull();
  expect(after!.x).toBeCloseTo(before!.x, 0);
  expect(after!.y).toBeCloseTo(before!.y, 0);

  // No page-level horizontal scrollbar while a tooltip is open.
  const overflow = await page.evaluate(() => {
    const el = document.documentElement;
    return el.scrollWidth - el.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(0);
});

test("the same tooltips are present on a seeded recipe's edit page", async ({
  page,
}) => {
  // Seeded fixture, read only — never submitted, so nothing is modified.
  await page.goto("/admin/recipes/stamina-brew/edit");
  await expect(
    page.getByRole("heading", { level: 1, name: "Stamina Brew", exact: true })
  ).toBeVisible();

  await expect(page.getByLabel("Minimum quantity", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Maximum quantity", { exact: true })).toBeVisible();
  await expect(minTrigger(page)).toBeVisible();
  await expect(maxTrigger(page)).toBeVisible();
  await expect(minTooltip(page)).toBeHidden();

  // The tooltip still opens on the edit page.
  await minTrigger(page).focus();
  await expect(minTooltip(page)).toBeVisible();
});
