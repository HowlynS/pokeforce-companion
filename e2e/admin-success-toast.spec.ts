// Focused E2E coverage for the shared AdminSuccessToast (Admin Polish
// Pass 2, Part 3) — the redirect-safe flash-message system that surfaces
// after a successful admin create/save/delete. Each resource's own
// admin-<resource>.spec.ts already asserts the exact message text at the
// point of its own create/save/delete, so this spec deliberately does not
// repeat that per resource. What it proves instead, using the Item
// workspace as one representative surface (per the shared toast's own
// single implementation in admin-success-toast.tsx): the live-region
// semantics, the flash param's one-shot consumption (no repeat on
// refresh), manual dismissal, auto-dismissal, and that a FAILED mutation
// never shows a toast at all.

import { expect, test } from "@playwright/test";
import { selectAdminOption } from "./helpers/admin-select";
import {
  deleteE2eTestItemRecords,
  deleteE2eTestRecipeRecords,
} from "./helpers/database-cleanup";

const ITEM = {
  name: "Test E2E Item Toast",
  slug: "test-e2e-item-toast",
} as const;

const RECIPE = {
  name: "Test E2E Recipe Toast",
  slug: "test-e2e-recipe-toast",
} as const;

let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.beforeAll(async () => {
  await deleteE2eTestItemRecords();
  await deleteE2eTestRecipeRecords();
});

test.afterEach(async () => {
  await deleteE2eTestItemRecords();
  await deleteE2eTestRecipeRecords();
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

test.afterAll(async () => {
  await deleteE2eTestItemRecords();
  await deleteE2eTestRecipeRecords();
});

function toast(page: import("@playwright/test").Page) {
  return page.getByRole("status").filter({ hasText: /created|saved|deleted/ });
}

test("a successful create shows the toast as an accessible live region, and it is gone after the auto-dismiss duration", async ({
  page,
}) => {
  await page.goto("/admin/items/new");
  await page.getByLabel("Name", { exact: true }).fill(ITEM.name);
  await page.getByLabel(/^Page address/).fill(ITEM.slug);
  await page.getByRole("button", { name: "Create item", exact: true }).click();
  await expect(page).toHaveURL(`/admin/items/${ITEM.slug}/edit`);

  const banner = toast(page);
  await expect(banner).toHaveText("Item created");
  // role=status carries an implicit aria-live=polite; asserted explicitly
  // here since AdminSuccessToast sets it directly on the message span
  // (never on a wrapper that would also swallow the dismiss button into
  // the same accessible-name computation).
  await expect(banner).toHaveAttribute("aria-live", "polite");

  await expect(banner).toBeHidden({ timeout: 7000 });
});

test("the flash param is stripped from the URL immediately and does not reappear on refresh", async ({
  page,
}) => {
  await page.goto("/admin/items/new");
  await page.getByLabel("Name", { exact: true }).fill(ITEM.name);
  await page.getByLabel(/^Page address/).fill(ITEM.slug);
  await page.getByRole("button", { name: "Create item", exact: true }).click();

  // The settled URL carries no `success` query — the toast's own
  // history.replaceState cleanup runs on mount.
  await expect(page).toHaveURL(`/admin/items/${ITEM.slug}/edit`);
  await expect(toast(page)).toHaveText("Item created");

  // A hard reload re-requests the now-clean URL: no `success` param means
  // no toast, ever again, for this mutation.
  await page.reload();
  await expect(toast(page)).toHaveCount(0);
});

test("the manual dismiss button removes the toast immediately, without waiting for the auto-dismiss timer", async ({
  page,
}) => {
  await page.goto("/admin/items/new");
  await page.getByLabel("Name", { exact: true }).fill(ITEM.name);
  await page.getByLabel(/^Page address/).fill(ITEM.slug);
  await page.getByRole("button", { name: "Create item", exact: true }).click();

  const banner = toast(page);
  await expect(banner).toBeVisible();
  await page.getByRole("button", { name: "Dismiss", exact: true }).click();
  await expect(banner).toHaveCount(0);
});

test("a failed save shows the existing validation error and never a success toast", async ({
  page,
}) => {
  await page.goto("/admin/items/new");
  await page.getByLabel("Name", { exact: true }).fill(ITEM.name);
  await page.getByLabel(/^Page address/).fill(ITEM.slug);
  await page.getByRole("button", { name: "Create item", exact: true }).click();
  await expect(page).toHaveURL(`/admin/items/${ITEM.slug}/edit`);

  // A second creation attempt with the same page address fails validation
  // (duplicate slug) and stays on the create form — no toast anywhere.
  await page.goto("/admin/items/new");
  await page.getByLabel("Name", { exact: true }).fill("Test E2E Item Toast Duplicate");
  await page.getByLabel(/^Page address/).fill(ITEM.slug);
  await page.getByRole("button", { name: "Create item", exact: true }).click();

  await expect(page).toHaveURL("/admin/items/new");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(toast(page)).toHaveCount(0);
});

test("the toast overlay causes zero layout shift — stable editor elements never move while it appears or disappears", async ({
  page,
}) => {
  await page.goto("/admin/items/new");
  await page.getByLabel("Name", { exact: true }).fill(ITEM.name);
  await page.getByLabel(/^Page address/).fill(ITEM.slug);
  await page.getByRole("button", { name: "Create item", exact: true }).click();
  await expect(page).toHaveURL(`/admin/items/${ITEM.slug}/edit`);

  const title = page.locator(".admin-editor-title");
  const actionsBar = page.locator(".admin-editor-actions");

  const banner = toast(page);
  await expect(banner).toBeVisible();
  const titleBoxWhileVisible = await title.boundingBox();
  const actionsBoxWhileVisible = await actionsBar.boundingBox();

  await page.getByRole("button", { name: "Dismiss", exact: true }).click();
  await expect(banner).toHaveCount(0);
  const titleBoxAfterDismiss = await title.boundingBox();
  const actionsBoxAfterDismiss = await actionsBar.boundingBox();

  // Reload the (already-cleaned) URL for a "the toast was never shown at
  // all" baseline, to prove appearance — not just disappearance — moves
  // nothing either.
  await page.reload();
  await expect(toast(page)).toHaveCount(0);
  const titleBoxNeverShown = await title.boundingBox();
  const actionsBoxNeverShown = await actionsBar.boundingBox();

  expect(titleBoxWhileVisible).toEqual(titleBoxAfterDismiss);
  expect(titleBoxWhileVisible).toEqual(titleBoxNeverShown);
  expect(actionsBoxWhileVisible).toEqual(actionsBoxAfterDismiss);
  expect(actionsBoxWhileVisible).toEqual(actionsBoxNeverShown);
});

test("the toast does not cover the title or tabs, and stays within the content region on a route with no record-list aside", async ({
  page,
}) => {
  // The Recipe Ingredients tab renders inside the workspace with no aside
  // column at all — a deliberately different shape from the Item General
  // editor every other test in this spec uses, proving the overlay's
  // positioning does not depend on an aside being present. A temporary
  // recipe (never the shared seeded "iron-sword" fixture other specs read
  // but never modify) is created here so this test can actually SAVE on
  // that route without mutating shared data.
  await page.goto("/admin/recipes/new");
  await page.getByLabel("Name", { exact: true }).fill(RECIPE.name);
  await page.getByLabel(/^Page address/).fill(RECIPE.slug);
  await selectAdminOption(
    page.getByRole("combobox", { name: "Resulting item", exact: true }),
    "Iron Ingot"
  );
  await selectAdminOption(
    page.getByRole("combobox", { name: "Required class", exact: true }),
    "Trainer"
  );
  const ingredientGroup = page.getByRole("group", {
    name: "Ingredients (fill at least one row)",
  });
  await selectAdminOption(ingredientGroup.getByRole("combobox").nth(0), "Iron Ore");
  await ingredientGroup.getByRole("spinbutton").nth(0).fill("1");
  await page
    .getByRole("button", { name: "Create Recipe", exact: true })
    .click();
  await expect(page).toHaveURL(`/admin/recipes/${RECIPE.slug}/edit`);

  await page.goto(`/admin/recipes/${RECIPE.slug}/ingredients`);
  await expect(page.locator(".admin-workspace-aside")).toHaveCount(0);
  await page.getByRole("spinbutton").first().fill("2");
  await page
    .getByRole("button", { name: "Save Ingredients", exact: true })
    .click();

  const banner = page.getByRole("status").filter({ hasText: "Ingredients saved" });
  await expect(banner).toBeVisible();

  const title = page.locator(".admin-editor-title");
  const tabs = page.getByRole("navigation", { name: "Recipe editor sections" });
  const [titleBox, tabsBox, toastBox] = await Promise.all([
    title.boundingBox(),
    tabs.boundingBox(),
    banner.boundingBox(),
  ]);

  expect(titleBox).not.toBeNull();
  expect(tabsBox).not.toBeNull();
  expect(toastBox).not.toBeNull();
  // The toast's bottom edge must sit above the title's own top edge — it
  // may share space with the small eyebrow label above the title, but
  // never with the title text itself.
  expect(toastBox!.y + toastBox!.height).toBeLessThanOrEqual(titleBox!.y);
  // The tabs sit well below the title, so if the toast clears the title it
  // necessarily clears the tabs too — checked directly anyway.
  expect(toastBox!.y + toastBox!.height).toBeLessThanOrEqual(tabsBox!.y);

  // No horizontal overflow: the toast never extends past the viewport.
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  expect(toastBox!.x).toBeGreaterThanOrEqual(0);
  expect(toastBox!.x + toastBox!.width).toBeLessThanOrEqual(viewport!.width);
});

test("the in-editor delete confirmation dialog stays above a toast that is still visible", async ({
  page,
}) => {
  await page.goto("/admin/items/new");
  await page.getByLabel("Name", { exact: true }).fill(ITEM.name);
  await page.getByLabel(/^Page address/).fill(ITEM.slug);
  await page.getByRole("button", { name: "Create item", exact: true }).click();
  await expect(page).toHaveURL(`/admin/items/${ITEM.slug}/edit`);

  // Open the delete confirmation WHILE the create toast is still visible
  // (well inside its 5s auto-dismiss window).
  const banner = toast(page);
  await expect(banner).toBeVisible();
  await page.getByRole("button", { name: "Delete item", exact: true }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  // The dialog's own confirm action is genuinely clickable — not
  // intercepted by a higher-stacked toast — proving the modal renders
  // above it.
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete Permanently", exact: true })
    .click();
  await expect(page).toHaveURL("/admin/items");
  await expect(toast(page)).toHaveText("Item deleted");
});

test("the toast stays pinned in the viewport even when the page is scrolled to reach a below-the-fold action", async ({
  page,
}) => {
  // A real regression caught during this pass's own visual review: an
  // earlier `position: absolute` implementation also avoided layout
  // shift, but scrolled away with the page — on a shorter viewport, the
  // Delete button (near the bottom of the aside column) requires
  // scrolling to reach, and the auto-scroll that click triggers left the
  // toast rendered far above the now-scrolled visible viewport. `position:
  // fixed` must never reproduce that.
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/admin/items/new");
  await page.getByLabel("Name", { exact: true }).fill(ITEM.name);
  await page.getByLabel(/^Page address/).fill(ITEM.slug);
  await page.getByRole("button", { name: "Create item", exact: true }).click();
  await expect(page).toHaveURL(`/admin/items/${ITEM.slug}/edit`);

  const banner = toast(page);
  await expect(banner).toBeVisible();

  // Clicking Delete auto-scrolls the page to bring it into view (it sits
  // below the fold at this viewport height).
  await page.getByRole("button", { name: "Delete item", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();

  // The toast must still be genuinely visible on screen — not merely
  // present in the DOM with a bounding box scrolled off above y=0.
  await expect(banner).toBeVisible();
  const box = await banner.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);

  await page.keyboard.press("Escape");
});

test("a successful delete shows its own toast on the destination list page", async ({
  page,
}) => {
  await page.goto("/admin/items/new");
  await page.getByLabel("Name", { exact: true }).fill(ITEM.name);
  await page.getByLabel(/^Page address/).fill(ITEM.slug);
  await page.getByRole("button", { name: "Create item", exact: true }).click();
  await expect(page).toHaveURL(`/admin/items/${ITEM.slug}/edit`);

  await page.getByRole("button", { name: "Delete item", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete Permanently", exact: true })
    .click();

  await expect(page).toHaveURL("/admin/items");
  await expect(toast(page)).toHaveText("Item deleted");
});
