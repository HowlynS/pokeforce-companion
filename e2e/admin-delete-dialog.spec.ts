// Focused E2E coverage for the shared DeleteRecordDialog as rendered by
// each resource's DEDICATED /delete route (Massive Admin Interaction
// Completion Pass, Phase 2) — reached only by direct URL here, exactly as
// a contributor would if they bookmarked it, followed a stale link, or
// landed on it via a server action's own blocked/failed-delete redirect
// (see delete-record-dialog.tsx's own module comment). Since Admin Polish
// Pass 1, Part 5, the NORMAL in-app path to Delete no longer goes through
// this route at all — DangerZonePanel opens the same dialog directly over
// the editor instead, covered separately by
// e2e/admin-in-editor-delete.spec.ts (including its own proof that a dirty
// form's discard prompt and the delete dialog are never stacked, which no
// longer applies here since this route is reached by direct navigation,
// never a click AdminFormGuard could intercept). This spec covers what
// only the dedicated route's OWN cancelHref-navigation mode exercises: the
// dialog's Tab-trap/Escape/backdrop mechanics and Cancel being a real,
// navigable link — each resource's own admin-<resource>.spec.ts already
// exercises the CRUD lifecycle and business-logic gating (blocked counts,
// error redirects, cascades) through this same instance.

import { expect, test } from "@playwright/test";
import { deleteE2eTestItemRecords } from "./helpers/database-cleanup";

const ITEM = {
  name: "Test E2E Item Delete Dialog",
  slug: "test-e2e-item-delete-dialog",
} as const;

let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.beforeAll(async () => {
  await deleteE2eTestItemRecords();
});

test.afterEach(async () => {
  await deleteE2eTestItemRecords();
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

test.afterAll(async () => {
  expect(await deleteE2eTestItemRecords()).toBe(0);
});

async function createItem(page: import("@playwright/test").Page) {
  await page.goto("/admin/items/new");
  await page.getByLabel("Name", { exact: true }).fill(ITEM.name);
  await page.getByLabel(/^Page address/).fill(ITEM.slug);
  await page.getByRole("button", { name: "Create item", exact: true }).click();
  await expect(page).toHaveURL(`/admin/items/${ITEM.slug}/edit`);
}

test("the dialog opens with Cancel focused, traps Tab, and Escape navigates back without deleting", async ({
  page,
}) => {
  await createItem(page);
  await page.goto(`/admin/items/${ITEM.slug}/delete`);

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  const cancel = dialog.getByRole("link", { name: "Cancel", exact: true });
  const confirm = dialog.getByRole("button", { name: "Delete Permanently", exact: true });
  await expect(cancel).toBeFocused();

  // Tab from Cancel reaches Confirm, and Tab again wraps back to Cancel —
  // the dialog, not the record list behind it, owns the Tab order.
  await page.keyboard.press("Tab");
  await expect(confirm).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(cancel).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(`/admin/items/${ITEM.slug}/edit`);
  await expect(dialog).toHaveCount(0);

  // Nothing was deleted — the record survived Escape.
  await page.goto("/admin/items");
  await expect(page.getByText(ITEM.name)).toBeVisible();
});

test("a backdrop click dismisses the dialog the same way Escape does", async ({
  page,
}) => {
  await createItem(page);
  await page.goto(`/admin/items/${ITEM.slug}/delete`);

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // Click the overlay itself, outside the dialog box.
  await page.locator(".admin-modal-overlay").click({ position: { x: 10, y: 10 } });
  await expect(page).toHaveURL(`/admin/items/${ITEM.slug}/edit`);
  await expect(dialog).toHaveCount(0);
});

test("Cancel is a real link: its href is the exact edit route, reachable without any JavaScript navigation handler", async ({
  page,
}) => {
  await createItem(page);
  await page.goto(`/admin/items/${ITEM.slug}/delete`);

  const cancel = page
    .getByRole("dialog")
    .getByRole("link", { name: "Cancel", exact: true });
  await expect(cancel).toHaveAttribute(
    "href",
    `/admin/items/${ITEM.slug}/edit`
  );
});

test("direct navigation to the dedicated route shows the dialog immediately, with no other prompt involved", async ({
  page,
}) => {
  await createItem(page);
  await page.goto(`/admin/items/${ITEM.slug}/delete`);

  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(
    page.getByRole("heading", { level: 2, name: "Delete Item" })
  ).toBeVisible();
});
