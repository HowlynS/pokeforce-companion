// Focused E2E coverage for the Sonnet Rollout Pass's Category adoption of
// the shared AdminFormGuard. Mirrors the Item pilot
// (e2e/admin-item-unsaved-changes.spec.ts) but trimmed to what the shared
// architecture doesn't already prove generically: that the guard is wired
// up at all on Category's create/edit routes (Categories carry no image
// upload or verification stamp of their own to exercise), and that the
// corrected Page-address draft-restoration behavior (Part 3) holds here
// too.

import { expect, test, type Page } from "@playwright/test";
import {
  deleteE2eTestCategories,
  countE2eTestCategories,
} from "./helpers/database-cleanup";

let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.beforeAll(async () => {
  await deleteE2eTestCategories();
  expect(await countE2eTestCategories()).toBe(0);
});

test.afterEach(async () => {
  await deleteE2eTestCategories();
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

test.afterAll(async () => {
  expect(await deleteE2eTestCategories()).toBe(0);
});

function status(page: Page) {
  return page.getByText("Unsaved changes", { exact: true });
}

function discardDialog(page: Page) {
  return page.getByRole("dialog").filter({
    has: page.getByRole("heading", { name: "Discard unsaved changes?" }),
  });
}

async function createTempCategory(
  page: Page,
  name: string,
  slug: string
): Promise<string> {
  await page.goto("/admin/categories/new");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel(/^Page address/).fill(slug);
  await page
    .getByRole("button", { name: "Create Category", exact: true })
    .click();
  await expect(page).toHaveURL(`/admin/categories/${slug}/edit`);
  return slug;
}

test("a meaningful edit marks dirty, reverting clears it, and dirty Cancel prompts before leaving", async ({
  page,
}) => {
  await createTempCategory(
    page,
    "Test E2E Category Guard",
    "test-e2e-category-guard"
  );
  // Creation's redirect already landed on this exact editor — a
  // redundant same-URL re-navigation would race the still-settling
  // client navigation and can observe stale, pre-mutation content.
  await expect(status(page)).toHaveCount(0);

  const nameField = page.getByLabel("Name", { exact: true });
  await nameField.fill("Test E2E Category Guard Edited");
  await expect(status(page)).toBeVisible();
  await nameField.fill("Test E2E Category Guard");
  await expect(status(page)).toHaveCount(0);

  await nameField.fill("Test E2E Category Guard Edited Again");
  await page.getByRole("link", { name: "Cancel", exact: true }).click();
  await expect(discardDialog(page)).toBeVisible();
  await page.getByRole("button", { name: "Discard changes", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/categories(\?|$)/);
});

test("Ctrl+S saves a valid form", async ({ page }) => {
  const slug = await createTempCategory(
    page,
    "Test E2E Category Guard Save",
    "test-e2e-category-guard-save"
  );

  await page
    .getByLabel("Description (optional)", { exact: true })
    .fill("Saved via keyboard shortcut.");
  await expect(status(page)).toBeVisible();

  await page.keyboard.press("Control+s");
  // Save-in-place (Admin Polish Pass 2, Part 1): stays on this same
  // canonical editor rather than returning to the list.
  await expect(page).toHaveURL(`/admin/categories/${slug}/edit`);
});

test("restoring an auto-synced Page-address draft keeps Name -> Page address sync active afterward", async ({
  page,
}) => {
  await createTempCategory(
    page,
    "Test E2E Category Sync Draft",
    "test-e2e-category-sync-draft"
  );

  const nameField = page.getByLabel("Name", { exact: true });
  const slugField = page.getByLabel(/^Page address/);

  await nameField.fill("Test E2E Category Sync Draft Two");
  await expect(slugField).toHaveValue("test-e2e-category-sync-draft-two");
  await page.waitForTimeout(600);

  await page.reload();
  const recoveryDialog = page.getByRole("dialog").filter({
    has: page.getByRole("heading", { name: "Restore unsaved draft?" }),
  });
  await expect(recoveryDialog).toBeVisible();
  await page.getByRole("button", { name: "Restore draft", exact: true }).click();

  await expect(slugField).toHaveValue("test-e2e-category-sync-draft-two");

  await nameField.fill("Test E2E Category Sync Draft Three");
  await expect(slugField).toHaveValue("test-e2e-category-sync-draft-three");
});
