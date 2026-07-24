// Browser coverage for the post-Milestone-10 Admin Interior Visual Polish
// pass against the REAL application. This suite deliberately does NOT
// re-prove ground already covered exhaustively elsewhere (CRUD lifecycles,
// route ownership, validation, image/verification behavior, hierarchy
// rules, tab wiring/aria-current, record-list search/pagination — see each
// resource's own admin-<resource>.spec.ts, admin-visual-consistency.spec.ts,
// and admin-editor-surface.spec.ts). It targets only what THIS pass
// changed: the EditorHeader eyebrow/long-title resilience, the header-
// placed "restrained danger" delete treatment on Recipe routes, the
// Dashboard's own capped card grid, and the Items/Locations landing
// pages' new records-present-vs-zero-record empty-state distinction. No
// screenshot or pixel-diff infrastructure, and no exact-color assertions
// beyond what a prior slice already established — bounding boxes and
// text content are the narrowest checks that can catch a regression.

import { expect, test, type Page } from "@playwright/test";
import {
  countE2eTestItemRecords,
  deleteE2eTestItemRecords,
} from "./helpers/database-cleanup";

// Browser error hygiene: any uncaught page error fails the test. Serial
// single-worker execution makes this module-level state safe.
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

async function noHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

test("EditorHeader renders the resource-type eyebrow above the one h1, without duplicating it as a second heading", async ({
  page,
}) => {
  // Seeded fixture only — read, never modified.
  await page.goto("/admin/items/iron-ore/edit");

  await expect(page.locator(".admin-editor-eyebrow")).toHaveText("Item");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(
    page.getByRole("heading", { level: 1, name: "Iron Ore", exact: true })
  ).toBeVisible();
});

test("a very long item name wraps inside the header instead of causing horizontal document overflow", async ({
  page,
}) => {
  const LONG_NAME =
    "Test E2E Item Visual Polish A Genuinely Excessive Item Name Meant To Stress The Editor Header Wrapping Behavior At Every Viewport Width";
  const SLUG = "test-e2e-item-visual-polish-long-name";

  await page.goto("/admin/items/new");
  await page.getByLabel("Name", { exact: true }).fill(LONG_NAME);
  await page.getByLabel(/^Page address/).fill(SLUG);
  await page.getByRole("button", { name: "Create item", exact: true }).click();
  await expect(page).toHaveURL(`/admin/items/${SLUG}/edit`);

  await page.setViewportSize({ width: 1440, height: 900 });
  await noHorizontalOverflow(page);
  await expect(
    page.getByRole("heading", { level: 1, name: LONG_NAME, exact: true })
  ).toBeVisible();

  await page.setViewportSize({ width: 1440, height: 650 });
  await noHorizontalOverflow(page);
});

test("Recipe's Danger zone Delete action keeps its restrained placement, separate from Save/Cancel, and opens the confirmation dialog directly over the editor", async ({
  page,
}) => {
  // Seeded fixture only — read, never modified.
  await page.goto("/admin/recipes/iron-sword/edit");

  // Admin Polish Pass 1, Part 5: Delete is now a BUTTON that opens the
  // shared confirmation dialog in place, never an <a href> to the
  // dedicated /delete route (that route still exists — see
  // e2e/admin-recipes.spec.ts and delete-record-dialog.tsx's own module
  // comment for why — it is just no longer what this button links to).
  const deleteButton = page.getByRole("button", { name: "Delete Recipe", exact: true });
  await expect(deleteButton).toBeVisible();
  // Delete moved out of the header and the sticky Save/Cancel bar (Visual
  // Pass sub-slice 9) into the aside's Danger zone panel — solid
  // .btn-danger, matching every other resource's Danger zone button.
  await expect(deleteButton).toHaveClass(/btn-danger/);
  await expect(
    page.locator(".admin-editor-actions").getByRole("button", { name: "Delete Recipe" })
  ).toHaveCount(0);
  await expect(
    page
      .locator(".admin-danger-zone")
      .getByRole("button", { name: "Delete Recipe", exact: true })
  ).toBeVisible();

  await deleteButton.click();
  await expect(page).toHaveURL("/admin/recipes/iron-sword/edit");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Delete Recipe", exact: true })
  ).toBeVisible();
  await page.keyboard.press("Escape");
});

test("Items landing (records exist) and Locations landing (zero records) show distinct empty-state copy, each with a working create action", async ({
  page,
}) => {
  await page.goto("/admin/items");
  await expect(
    page.getByRole("heading", { level: 3, name: "Select an item", exact: true })
  ).toBeVisible();
  const itemCreateAction = page
    .locator(".empty-state-action")
    .getByRole("link", { name: "Create Item", exact: true });
  await expect(itemCreateAction).toHaveAttribute("href", "/admin/items/new");

  // The persistent fixture set seeds zero Locations (confirmed by the
  // Dashboard's own "0 locations" count), so this is a genuine zero-
  // record read, not a temporary/created state.
  await page.goto("/admin/locations");
  await expect(
    page.getByRole("heading", { level: 3, name: "No locations yet", exact: true })
  ).toBeVisible();
  const locationCreateAction = page
    .locator(".empty-state-action")
    .getByRole("link", { name: "Create Location", exact: true });
  await expect(locationCreateAction).toHaveAttribute(
    "href",
    "/admin/locations/new"
  );
});

test("the Dashboard's summary-card grid stays capped at a sensible width instead of stretching across the widened frame at 3440px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 3440, height: 1440 });
  await page.goto("/admin");

  const grid = page.locator(".admin-dashboard-grid");
  await expect(grid).toBeVisible();
  const box = await grid.boundingBox();
  expect(box).not.toBeNull();
  // Comfortably under the .admin-frame's own ~3150px ceiling. Visual Pass
  // II Section 1 raised this grid's own cap from 1200px to 1500px (the
  // Visual Pass II correction pass raised it again in spirit only — same
  // 1500px number — to fit all six modules, including Game Versions, on
  // one row) — proves the grid is genuinely capped, not merely narrower
  // by coincidence.
  expect(box!.width).toBeLessThanOrEqual(1500);
});

test("context panels in the aside column never overlap the sticky EditorActions bar", async ({
  page,
}) => {
  await page.goto("/admin/items/iron-ore/edit");
  await page.setViewportSize({ width: 1440, height: 650 });

  const aside = page.locator(".admin-workspace-aside");
  const actions = page.locator(".admin-editor-actions");
  await expect(aside).toBeVisible();
  await expect(actions).toBeVisible();

  // Polled rather than a one-shot read: a freshly resized dev-mode page
  // can briefly report a stale/transitional aside box (still settling
  // from the previous viewport's flex layout) before it stabilizes.
  await expect
    .poll(async () => {
      const asideBox = await aside.boundingBox();
      return asideBox?.width;
    })
    .toBeLessThanOrEqual(320);

  const [asideBox, actionsBox] = await Promise.all([
    aside.boundingBox(),
    actions.boundingBox(),
  ]);
  expect(asideBox).not.toBeNull();
  expect(actionsBox).not.toBeNull();
  // The aside column and the sticky actions bar occupy separate
  // horizontal tracks (record list + main vs. the aside rail sits beside
  // both) — this proves the sticky bar never renders visually on top of
  // the aside's own panels.
  const horizontallyDisjoint =
    asideBox!.x >= actionsBox!.x + actionsBox!.width ||
    actionsBox!.x >= asideBox!.x + asideBox!.width;
  expect(horizontallyDisjoint).toBe(true);
});

test("a no-aside route (Recipe Ingredients) still renders with no context rail at all", async ({
  page,
}) => {
  // Seeded fixture only — read, never modified.
  await page.goto("/admin/recipes/iron-sword/ingredients");

  await expect(page.locator(".admin-workspace-aside")).toHaveCount(0);
  await noHorizontalOverflow(page);
});

test("seeded fixtures are preserved and no suite item remains", async () => {
  expect(await countE2eTestItemRecords()).toBe(0);
});
