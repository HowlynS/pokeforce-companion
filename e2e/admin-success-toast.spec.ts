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
import { deleteE2eTestItemRecords } from "./helpers/database-cleanup";

const ITEM = {
  name: "Test E2E Item Toast",
  slug: "test-e2e-item-toast",
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
  await deleteE2eTestItemRecords();
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
