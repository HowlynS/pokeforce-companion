// Authenticated E2E coverage for the Opus Pass 2 unsaved-changes guard,
// piloted on the Item editor. Runs in the chromium-admin project with the
// storage state saved by auth.setup.ts. Every temporary Item uses the
// test-e2e-item slug prefix and is removed by guard-first, prefix-scoped
// cleanup — a mid-test failure can never strand a row. Tests that never
// click Save (dirty-state, navigation, modal flows) do not persist any
// change; only the Ctrl+S test saves, and it operates on its own temporary
// row. sessionStorage (where drafts live) is fresh per test because
// Playwright gives each test its own browser context.

import { expect, test, type Page } from "@playwright/test";
import {
  countE2eTestItemRecords,
  deleteE2eTestItemRecords,
} from "./helpers/database-cleanup";

let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.beforeAll(async () => {
  await deleteE2eTestItemRecords();
  expect(await countE2eTestItemRecords()).toBe(0);
});

test.afterEach(async () => {
  await deleteE2eTestItemRecords();
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

test.afterAll(async () => {
  expect(await deleteE2eTestItemRecords()).toBe(0);
});

// Creates a temporary Item through the real create form and returns its
// slug. The create form is itself guarded, so this also exercises a
// successful guarded submit.
async function createTempItem(
  page: Page,
  name: string,
  slug: string
): Promise<string> {
  await page.goto("/admin/items/new");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Page address", { exact: true }).fill(slug);
  await page.getByRole("button", { name: "Create item", exact: true }).click();
  await expect(page).toHaveURL(`/admin/items/${slug}/edit`);
  return slug;
}

function status(page: Page) {
  return page.getByText("Unsaved changes", { exact: true });
}

function discardDialog(page: Page) {
  return page.getByRole("dialog").filter({
    has: page.getByRole("heading", { name: "Discard unsaved changes?" }),
  });
}

test("shows Unsaved changes on a meaningful edit and clears it on revert", async ({
  page,
}) => {
  const slug = await createTempItem(page, "Test E2E Item Dirty", "test-e2e-item-dirty");
  await page.goto(`/admin/items/${slug}/edit`);

  await expect(status(page)).toHaveCount(0);

  const nameField = page.getByLabel("Name", { exact: true });
  await nameField.fill("Test E2E Item Dirty Edited");
  await expect(status(page)).toBeVisible();

  // Reverting to the exact original value returns to clean.
  await nameField.fill("Test E2E Item Dirty");
  await expect(status(page)).toHaveCount(0);
});

test("a checkbox toggle marks dirty and toggling back clears it", async ({
  page,
}) => {
  const slug = await createTempItem(page, "Test E2E Item Checkbox", "test-e2e-item-checkbox");
  await page.goto(`/admin/items/${slug}/edit`);

  await expect(status(page)).toHaveCount(0);
  const held = page.getByLabel("Held item", { exact: true });
  await held.check();
  await expect(status(page)).toBeVisible();
  await held.uncheck();
  await expect(status(page)).toHaveCount(0);
});

test("clean Cancel navigates directly with no modal", async ({ page }) => {
  const slug = await createTempItem(page, "Test E2E Item Clean", "test-e2e-item-clean");
  await page.goto(`/admin/items/${slug}/edit`);

  await page.getByRole("link", { name: "Cancel", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/items(\?|$)/);
  await expect(discardDialog(page)).toHaveCount(0);
});

test("dirty Cancel prompts; Keep editing preserves values; Discard leaves", async ({
  page,
}) => {
  const slug = await createTempItem(page, "Test E2E Item Cancel", "test-e2e-item-cancel");
  await page.goto(`/admin/items/${slug}/edit`);

  const nameField = page.getByLabel("Name", { exact: true });
  await nameField.fill("Test E2E Item Cancel Edited");
  await expect(status(page)).toBeVisible();

  await page.getByRole("link", { name: "Cancel", exact: true }).click();
  await expect(discardDialog(page)).toBeVisible();

  // Keep editing: modal closes, value preserved, still on the edit page.
  await page.getByRole("button", { name: "Keep editing", exact: true }).click();
  await expect(discardDialog(page)).toHaveCount(0);
  await expect(page).toHaveURL(`/admin/items/${slug}/edit`);
  await expect(nameField).toHaveValue("Test E2E Item Cancel Edited");

  // Cancel again, then Discard: navigates to the list.
  await page.getByRole("link", { name: "Cancel", exact: true }).click();
  await expect(discardDialog(page)).toBeVisible();
  await page.getByRole("button", { name: "Discard changes", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/items(\?|$)/);
});

test("Escape closes the discard modal and keeps editing", async ({ page }) => {
  const slug = await createTempItem(page, "Test E2E Item Escape", "test-e2e-item-escape");
  await page.goto(`/admin/items/${slug}/edit`);

  await page.getByLabel("Name", { exact: true }).fill("Test E2E Item Escape Edited");
  await page.getByRole("link", { name: "Cancel", exact: true }).click();
  await expect(discardDialog(page)).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(discardDialog(page)).toHaveCount(0);
  await expect(page).toHaveURL(`/admin/items/${slug}/edit`);
});

test("a dirty sidebar link is intercepted; Discard follows the link", async ({
  page,
}) => {
  const slug = await createTempItem(page, "Test E2E Item Sidebar", "test-e2e-item-sidebar");
  await page.goto(`/admin/items/${slug}/edit`);

  await page.getByLabel("Name", { exact: true }).fill("Test E2E Item Sidebar Edited");
  await page
    .getByRole("navigation", { name: "Admin navigation" })
    .getByRole("link", { name: "Recipes", exact: true })
    .click();

  await expect(discardDialog(page)).toBeVisible();
  await page.getByRole("button", { name: "Discard changes", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/recipes(\?|$)/);
});

test("a dirty record-list switch is intercepted; Keep editing stays put", async ({
  page,
}) => {
  const slug = await createTempItem(page, "Test E2E Item Switch", "test-e2e-item-switch");
  await page.goto(`/admin/items/${slug}/edit`);

  await page.getByLabel("Name", { exact: true }).fill("Test E2E Item Switch Edited");

  // Switch to a seeded item's row.
  await page
    .getByRole("navigation", { name: "Items records" })
    .getByRole("link")
    .filter({ has: page.getByText("Iron Ore", { exact: true }) })
    .first()
    .click();

  await expect(discardDialog(page)).toBeVisible();
  await page.getByRole("button", { name: "Keep editing", exact: true }).click();
  await expect(page).toHaveURL(`/admin/items/${slug}/edit`);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Test E2E Item Switch Edited"
  );
});

test("dirty Back is intercepted repeatedly without accumulating entries; Discard reaches the exact previous page once", async ({
  page,
}) => {
  // Establish a KNOWN previous destination (the Recipes list) immediately
  // before the editor, so Discard's target is exact and assertable.
  const slug = await createTempItem(page, "Test E2E Item Back", "test-e2e-item-back");
  await page.goto("/admin/recipes");
  await page.goto(`/admin/items/${slug}/edit`);

  await page.getByLabel("Name", { exact: true }).fill("Test E2E Item Back Edited");
  await expect(status(page)).toBeVisible();

  // Retry Back several times: each opens the modal and Keep editing stays
  // put — no accumulation, no loop.
  for (let i = 0; i < 3; i += 1) {
    await page.goBack();
    await expect(discardDialog(page)).toBeVisible();
    await page.getByRole("button", { name: "Keep editing", exact: true }).click();
    await expect(discardDialog(page)).toHaveCount(0);
    await expect(page).toHaveURL(`/admin/items/${slug}/edit`);
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
      "Test E2E Item Back Edited"
    );
  }

  // Back once more, then Discard: reaches the exact previous page (Recipes)
  // in a single step.
  await page.goBack();
  await expect(discardDialog(page)).toBeVisible();
  await page.getByRole("button", { name: "Discard changes", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/recipes(\?|$)/);
});

test("a clean editor leaves with one Back press; a dirty→reverted editor also leaves with one Back press", async ({
  page,
}) => {
  const slug = await createTempItem(page, "Test E2E Item Revert", "test-e2e-item-revert");
  await page.goto("/admin/recipes");
  await page.goto(`/admin/items/${slug}/edit`);

  // Clean: one Back press leaves directly, no modal.
  await page.goBack();
  await expect(discardDialog(page)).toHaveCount(0);
  await expect(page).toHaveURL(/\/admin\/recipes(\?|$)/);

  // Return, go dirty, then revert to the exact original value.
  await page.goto(`/admin/items/${slug}/edit`);
  const nameField = page.getByLabel("Name", { exact: true });
  await nameField.fill("Test E2E Item Revert Edited");
  await expect(status(page)).toBeVisible();
  await nameField.fill("Test E2E Item Revert");
  await expect(status(page)).toHaveCount(0);

  // Reverted-to-clean leaves with ONE Back press, no modal (the history
  // buffer was consumed on revert).
  await page.goBack();
  await expect(discardDialog(page)).toHaveCount(0);
  await expect(page).toHaveURL(/\/admin\/recipes(\?|$)/);
});

test("after a successful save, the editor stays on the same URL clean and unsaved-changes-free, and Back reaches the previous page within a bounded number of steps", async ({
  page,
}) => {
  // Save-in-place (Admin Polish Pass 2): a successful save redirects back to
  // the SAME canonical editor URL (never the list), showing the persisted
  // server state with dirty state cleared, no discard modal, no data loss.
  // The server action's redirect still pushes one history entry (same URL
  // as the pre-save editor) — same documented App Router + React 19
  // limitation the old list-redirect version of this test described, just
  // against the editor's own URL instead of the list's. That extra entry is
  // harmless: Back through it simply re-shows the identical clean editor, so
  // continued Back still reaches the previous page in a bounded number of
  // steps (never a loop).
  const slug = await createTempItem(page, "Test E2E Item Saveback", "test-e2e-item-saveback");
  await page.goto("/admin/recipes");
  await page.goto(`/admin/items/${slug}/edit`);

  // Edit Description (slug-neutral, so the editor URL stays valid on Back).
  await page
    .getByLabel("Description (optional)", { exact: true })
    .fill("Saved description for the back test.");
  const editUrl = page.url();
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();

  await expect(page).toHaveURL(editUrl);
  await expect(status(page)).toHaveCount(0);
  await expect(discardDialog(page)).toHaveCount(0);

  for (let i = 0; i < 4; i += 1) {
    if (/\/admin\/recipes(\?|$)/.test(page.url())) {
      break;
    }
    await page.goBack();
  }
  await expect(page).toHaveURL(/\/admin\/recipes(\?|$)/);
});

test("Forward remains usable after a clean Back out of the editor", async ({
  page,
}) => {
  // createTempItem's own create-redirect already lands on this exact edit
  // URL, pushed as a new history entry on top of the create form it
  // submitted from (/admin/items/new) — so a clean Back goes straight to
  // that create form, never the list (creation no longer visits the list
  // at all under the Pass 2 create-redirect).
  const slug = await createTempItem(page, "Test E2E Item Fwd", "test-e2e-item-fwd");

  // Clean Back to the create form, then Forward returns to the editor.
  await page.goBack();
  await expect(page).toHaveURL("/admin/items/new");
  await page.goForward();
  await expect(page).toHaveURL(`/admin/items/${slug}/edit`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Test E2E Item Fwd", exact: true })
  ).toBeVisible();
});

test("Ctrl+S saves a valid form and prevents the browser Save dialog", async ({
  page,
}) => {
  const slug = await createTempItem(page, "Test E2E Item Save", "test-e2e-item-save");
  await page.goto(`/admin/items/${slug}/edit`);

  await page
    .getByLabel("Description (optional)", { exact: true })
    .fill("Saved via keyboard shortcut.");
  await expect(status(page)).toBeVisible();

  const editUrl = page.url();
  await page.keyboard.press("Control+s");
  await expect(page).toHaveURL(editUrl);
});

test("Ctrl+S is ignored while the discard modal is open", async ({ page }) => {
  const slug = await createTempItem(page, "Test E2E Item Shortcut", "test-e2e-item-shortcut");
  await page.goto(`/admin/items/${slug}/edit`);

  await page.getByLabel("Name", { exact: true }).fill("Test E2E Item Shortcut Edited");
  await page.getByRole("link", { name: "Cancel", exact: true }).click();
  await expect(discardDialog(page)).toBeVisible();

  await page.keyboard.press("Control+s");
  // Still on the edit page; the modal is still open; no save happened.
  await expect(page).toHaveURL(`/admin/items/${slug}/edit`);
  await expect(discardDialog(page)).toBeVisible();
});

test("on the create form, typing Name auto-syncs Page address and marks the form dirty deterministically", async ({
  page,
}) => {
  await page.goto("/admin/items/new");
  await expect(status(page)).toHaveCount(0);

  // Typing Name programmatically updates the controlled Page-address input
  // (no native input event on it) — the shared form-change signal makes the
  // guard see it, so the form is dirty and the slug tracks the name.
  await page.getByLabel("Name", { exact: true }).fill("Test E2E Item Sync");
  await expect(page.getByLabel("Page address", { exact: true })).toHaveValue(
    "test-e2e-item-sync"
  );
  await expect(status(page)).toBeVisible();
});

test("editing only the Page address (manual override) marks dirty and reverting clears it", async ({
  page,
}) => {
  const slug = await createTempItem(page, "Test E2E Item Manual", "test-e2e-item-manual");
  await page.goto(`/admin/items/${slug}/edit`);
  await expect(status(page)).toHaveCount(0);

  const slugField = page.getByLabel("Page address", { exact: true });
  await slugField.fill("test-e2e-item-manual-2");
  await expect(status(page)).toBeVisible();

  await slugField.fill("test-e2e-item-manual");
  await expect(status(page)).toHaveCount(0);
});

test("selecting an image marks the form dirty", async ({ page }) => {
  const slug = await createTempItem(page, "Test E2E Item Image", "test-e2e-item-image-dirty");
  await page.goto(`/admin/items/${slug}/edit`);
  await expect(status(page)).toHaveCount(0);

  // The file input is visually hidden behind the Choose/Change button; set
  // files directly on it. Selecting a file fires a native change event the
  // guard already sees — asserting the dirty state proves image selection
  // participates in dirty tracking.
  await page.locator('input[type="file"][name="image"]').setInputFiles({
    name: "pixel.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da6360000002000154a24f5d0000000049454e44ae426082",
      "hex"
    ),
  });
  await expect(status(page)).toBeVisible();
});

test("the recovery prompt focuses Restore, and Escape preserves the draft", async ({
  page,
}) => {
  const slug = await createTempItem(page, "Test E2E Item Recover", "test-e2e-item-recover");
  await page.goto(`/admin/items/${slug}/edit`);

  await page.getByLabel("Name", { exact: true }).fill("Test E2E Item Recover Edited");
  await page.waitForTimeout(600);
  await page.reload();

  const recoveryDialog = page.getByRole("dialog").filter({
    has: page.getByRole("heading", { name: "Restore unsaved draft?" }),
  });
  await expect(recoveryDialog).toBeVisible();

  // Restore is the initially-focused, primary action (favoring the user's
  // work) — not Discard.
  await expect(
    page.getByRole("button", { name: "Restore draft", exact: true })
  ).toBeFocused();

  // Escape dismisses WITHOUT deleting the draft: reloading offers it again.
  await page.keyboard.press("Escape");
  await expect(recoveryDialog).toHaveCount(0);
  // The server value is shown (draft not applied), but the draft survives.
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Test E2E Item Recover"
  );

  await page.reload();
  await expect(recoveryDialog).toBeVisible();
  // Now discard it explicitly, and confirm it is gone afterward.
  await page.getByRole("button", { name: "Discard draft", exact: true }).click();
  await page.reload();
  await expect(recoveryDialog).toHaveCount(0);
});

test("a draft is offered and restored after a reload, then cleared on discard", async ({
  page,
}) => {
  const slug = await createTempItem(page, "Test E2E Item Draft", "test-e2e-item-draft");
  await page.goto(`/admin/items/${slug}/edit`);

  await page.getByLabel("Name", { exact: true }).fill("Test E2E Item Draft Edited");
  // Let the debounced draft write land.
  await page.waitForTimeout(600);

  await page.reload();

  const recoveryDialog = page.getByRole("dialog").filter({
    has: page.getByRole("heading", { name: "Restore unsaved draft?" }),
  });
  await expect(recoveryDialog).toBeVisible();

  await page.getByRole("button", { name: "Restore draft", exact: true }).click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Test E2E Item Draft Edited"
  );
  await expect(status(page)).toBeVisible();

  // Reload again and discard the draft: server value returns, no prompt after.
  await page.waitForTimeout(600);
  await page.reload();
  await expect(recoveryDialog).toBeVisible();
  await page.getByRole("button", { name: "Discard draft", exact: true }).click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Test E2E Item Draft"
  );
});

// Sonnet Rollout Pass, Part 2: the "Unsaved changes" status must sit
// immediately beside Save (DOM order Cancel -> Save -> status), never
// pushed to a detached far-right zone (the retired `margin-left: auto`).
test("the Unsaved-changes status follows Save in DOM order, not detached to the far right", async ({
  page,
}) => {
  const slug = await createTempItem(
    page,
    "Test E2E Item Status Order",
    "test-e2e-item-status-order"
  );
  await page.goto(`/admin/items/${slug}/edit`);

  await page.getByLabel("Name", { exact: true }).fill("Test E2E Item Status Order Edited");
  await expect(status(page)).toBeVisible();

  const actionsRow = page.locator(".admin-editor-actions");
  const childTexts = await actionsRow.evaluate((el) =>
    Array.from(el.children).map((child) => child.textContent?.trim() ?? "")
  );
  const cancelIndex = childTexts.findIndex((text) => text === "Cancel");
  const saveIndex = childTexts.findIndex((text) => text.includes("Save Changes"));
  const statusIndex = childTexts.findIndex((text) => text.includes("Unsaved changes"));
  expect(cancelIndex).toBeGreaterThanOrEqual(0);
  expect(saveIndex).toBeGreaterThan(cancelIndex);
  expect(statusIndex).toBeGreaterThan(saveIndex);

  // The retired far-right class must never reappear on the status element.
  const statusClass = await page
    .locator(".admin-form-status")
    .first()
    .getAttribute("class");
  expect(statusClass ?? "").not.toContain("margin-left");
});

// Sonnet Rollout Pass, Part 3: restoring a draft that was still auto-syncing
// (Name -> Page address) must leave auto-sync ACTIVE, so a further Name
// edit after restoration keeps updating Page address. Before the fix,
// AdminFormGuard's generic native-value restoration path fired a native
// change event on the Page-address input, which RecordSlugField's onChange
// unconditionally treated as a manual edit, permanently disabling sync.
test("restoring an auto-synced draft keeps Name -> Page address sync active afterward", async ({
  page,
}) => {
  const slug = await createTempItem(
    page,
    "Test E2E Item Sync Draft",
    "test-e2e-item-sync-draft"
  );
  await page.goto(`/admin/items/${slug}/edit`);

  const nameField = page.getByLabel("Name", { exact: true });
  const slugField = page.getByLabel("Page address", { exact: true });

  // Edit Name only — Page address auto-syncs from it, never touched directly.
  await nameField.fill("Test E2E Item Sync Draft Two");
  await expect(slugField).toHaveValue("test-e2e-item-sync-draft-two");
  await page.waitForTimeout(600);

  await page.reload();
  const recoveryDialog = page.getByRole("dialog").filter({
    has: page.getByRole("heading", { name: "Restore unsaved draft?" }),
  });
  await expect(recoveryDialog).toBeVisible();
  await page.getByRole("button", { name: "Restore draft", exact: true }).click();

  await expect(nameField).toHaveValue("Test E2E Item Sync Draft Two");
  await expect(slugField).toHaveValue("test-e2e-item-sync-draft-two");

  // The bug: after restoring, Page address stopped tracking Name. Prove
  // sync is still live by editing Name again.
  await nameField.fill("Test E2E Item Sync Draft Three");
  await expect(slugField).toHaveValue("test-e2e-item-sync-draft-three");
});

// The manual-override counterpart: a Page address the contributor typed
// themselves before reload must be restored AND stay manually overridden —
// a further Name edit must not overwrite it.
test("restoring a manually overridden Page-address draft keeps sync disabled afterward", async ({
  page,
}) => {
  const slug = await createTempItem(
    page,
    "Test E2E Item Manual Draft",
    "test-e2e-item-manual-draft"
  );
  await page.goto(`/admin/items/${slug}/edit`);

  const nameField = page.getByLabel("Name", { exact: true });
  const slugField = page.getByLabel("Page address", { exact: true });

  // A direct edit to Page address switches it to manual mode.
  await slugField.fill("test-e2e-item-manual-draft-override");
  await expect(status(page)).toBeVisible();
  await page.waitForTimeout(600);

  await page.reload();
  const recoveryDialog = page.getByRole("dialog").filter({
    has: page.getByRole("heading", { name: "Restore unsaved draft?" }),
  });
  await expect(recoveryDialog).toBeVisible();
  await page.getByRole("button", { name: "Restore draft", exact: true }).click();

  await expect(slugField).toHaveValue("test-e2e-item-manual-draft-override");

  // Editing Name after restoration must NOT overwrite the manual override.
  await nameField.fill("Test E2E Item Manual Draft Renamed");
  await expect(slugField).toHaveValue("test-e2e-item-manual-draft-override");
});
