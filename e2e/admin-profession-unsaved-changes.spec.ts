// Focused E2E coverage for the Sonnet Rollout Pass's Profession adoption of
// the shared AdminFormGuard. Mirrors the Item pilot
// (e2e/admin-item-unsaved-changes.spec.ts) but trimmed to what the shared
// architecture doesn't already prove generically: that the guard is wired
// up at all on Profession's create/edit routes, and that the corrected
// Page-address draft-restoration behavior (Part 3) holds here too.

import { expect, test, type Page } from "@playwright/test";
import {
  deleteE2eTestProfessionRecords,
  countE2eTestProfessionRecords,
} from "./helpers/database-cleanup";

let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.beforeAll(async () => {
  await deleteE2eTestProfessionRecords();
  expect(await countE2eTestProfessionRecords()).toBe(0);
});

test.afterEach(async () => {
  await deleteE2eTestProfessionRecords();
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

test.afterAll(async () => {
  expect(await deleteE2eTestProfessionRecords()).toBe(0);
});

function status(page: Page) {
  return page.getByText("Unsaved changes", { exact: true });
}

function discardDialog(page: Page) {
  return page.getByRole("dialog").filter({
    has: page.getByRole("heading", { name: "Discard unsaved changes?" }),
  });
}

async function createTempProfession(
  page: Page,
  name: string,
  slug: string
): Promise<string> {
  await page.goto("/admin/professions/new");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel(/^Page address/).fill(slug);
  await page
    .getByRole("button", { name: "Create Profession", exact: true })
    .click();
  await expect(page).toHaveURL("/admin/professions?success=created");
  return slug;
}

test("a meaningful edit marks dirty, reverting clears it, and dirty Cancel prompts before leaving", async ({
  page,
}) => {
  const slug = await createTempProfession(
    page,
    "Test E2E Profession Guard",
    "test-e2e-profession-guard"
  );
  await page.goto(`/admin/professions/${slug}/edit`);
  await expect(status(page)).toHaveCount(0);

  const nameField = page.getByLabel("Name", { exact: true });
  await nameField.fill("Test E2E Profession Guard Edited");
  await expect(status(page)).toBeVisible();
  await nameField.fill("Test E2E Profession Guard");
  await expect(status(page)).toHaveCount(0);

  await nameField.fill("Test E2E Profession Guard Edited Again");
  await page.getByRole("link", { name: "Cancel", exact: true }).click();
  await expect(discardDialog(page)).toBeVisible();
  await page.getByRole("button", { name: "Discard changes", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/professions(\?|$)/);
});

test("Ctrl+S saves a valid form", async ({ page }) => {
  const slug = await createTempProfession(
    page,
    "Test E2E Profession Guard Save",
    "test-e2e-profession-guard-save"
  );
  await page.goto(`/admin/professions/${slug}/edit`);

  await page
    .getByLabel("Description (optional)", { exact: true })
    .fill("Saved via keyboard shortcut.");
  await expect(status(page)).toBeVisible();

  await page.keyboard.press("Control+s");
  await expect(page).toHaveURL(/\/admin\/professions\?success=updated/);
});

test("restoring an auto-synced Page-address draft keeps Name -> Page address sync active afterward", async ({
  page,
}) => {
  const slug = await createTempProfession(
    page,
    "Test E2E Profession Sync Draft",
    "test-e2e-profession-sync-draft"
  );
  await page.goto(`/admin/professions/${slug}/edit`);

  const nameField = page.getByLabel("Name", { exact: true });
  const slugField = page.getByLabel(/^Page address/);

  await nameField.fill("Test E2E Profession Sync Draft Two");
  await expect(slugField).toHaveValue("test-e2e-profession-sync-draft-two");
  await page.waitForTimeout(600);

  await page.reload();
  const recoveryDialog = page.getByRole("dialog").filter({
    has: page.getByRole("heading", { name: "Restore unsaved draft?" }),
  });
  await expect(recoveryDialog).toBeVisible();
  await page.getByRole("button", { name: "Restore draft", exact: true }).click();

  await expect(slugField).toHaveValue("test-e2e-profession-sync-draft-two");

  await nameField.fill("Test E2E Profession Sync Draft Three");
  await expect(slugField).toHaveValue("test-e2e-profession-sync-draft-three");
});
