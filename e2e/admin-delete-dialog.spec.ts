// Focused E2E coverage for the shared DeleteRecordDialog (Massive Admin
// Interaction Completion Pass, Phase 2) — behavior that is genuinely
// cross-cutting across every resource's dedicated /delete route rather
// than re-proven per resource. Each resource's own admin-<resource>.spec.ts
// already exercises the CRUD lifecycle and business-logic gating (blocked
// counts, error redirects, cascades) through this same dialog; this spec
// adds what those don't: the dialog's own accessibility mechanics (focus,
// Escape, backdrop, Tab trap) and the interaction with AdminFormGuard when
// Delete is reached from a genuinely dirty edit form — proving the two
// prompts are sequential, never stacked, since the /delete route carries
// no AdminFormGuard of its own.

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
  await expect(page).toHaveURL("/admin/items?success=created");
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

test("reaching Delete from a dirty edit form shows exactly one dialog at a time — the discard prompt, then (after confirming) the delete dialog — never both at once", async ({
  page,
}) => {
  await createItem(page);
  await page.goto(`/admin/items/${ITEM.slug}/edit`);

  // Make the form genuinely dirty.
  const name = page.getByLabel("Name", { exact: true });
  await name.fill("Test E2E Item Delete Dialog Edited");
  await expect(page.getByText("Unsaved changes", { exact: true })).toBeVisible();

  // Delete lives in the aside's Danger zone panel, an ordinary link —
  // AdminFormGuard intercepts it exactly like any other navigation away
  // from a dirty form.
  await page.getByRole("link", { name: "Delete item", exact: true }).click();

  const discardDialog = page.getByRole("dialog").filter({
    has: page.getByRole("heading", { name: "Discard unsaved changes?" }),
  });
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(discardDialog).toBeVisible();

  await page.getByRole("button", { name: "Discard changes", exact: true }).click();

  // The discard prompt is gone and the delete-confirmation dialog has
  // replaced it — sequentially, never simultaneously — on the route the
  // server actions' own error redirects target.
  await expect(page).toHaveURL(`/admin/items/${ITEM.slug}/delete`);
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(
    page.getByRole("heading", { level: 2, name: "Delete Item" })
  ).toBeVisible();
});

test("clean (non-dirty) navigation to Delete shows the delete dialog immediately, with no discard prompt at all", async ({
  page,
}) => {
  await createItem(page);
  await page.goto(`/admin/items/${ITEM.slug}/edit`);

  await page.getByRole("link", { name: "Delete item", exact: true }).click();

  await expect(page).toHaveURL(`/admin/items/${ITEM.slug}/delete`);
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(
    page.getByRole("heading", { level: 2, name: "Delete Item" })
  ).toBeVisible();
});
