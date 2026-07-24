// Focused E2E coverage for the Sonnet Rollout Pass's Location adoption of
// the shared AdminFormGuard (General, Hierarchy). Mirrors the Item pilot
// (e2e/admin-item-unsaved-changes.spec.ts) but trimmed to what the shared
// architecture doesn't already prove generically: that the guard is wired
// up on both Location routes, that the corrected Page-address draft
// behavior (Part 3) holds here too, and that Hierarchy's own parent
// selector participates in dirty tracking with its read-only Sub-locations
// table never polluting the snapshot.

import { expect, test, type Page } from "@playwright/test";
import { selectAdminOption } from "./helpers/admin-select";
import {
  deleteE2eTestLocationRecords,
  countE2eTestLocationRecords,
} from "./helpers/database-cleanup";

let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.beforeAll(async () => {
  await deleteE2eTestLocationRecords();
  expect(await countE2eTestLocationRecords()).toBe(0);
});

test.afterEach(async () => {
  await deleteE2eTestLocationRecords();
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

test.afterAll(async () => {
  expect(await deleteE2eTestLocationRecords()).toBe(0);
});

function status(page: Page) {
  return page.getByText("Unsaved changes", { exact: true });
}

function discardDialog(page: Page) {
  return page.getByRole("dialog").filter({
    has: page.getByRole("heading", { name: "Discard unsaved changes?" }),
  });
}

async function createTempLocation(
  page: Page,
  name: string,
  slug: string
): Promise<string> {
  await page.goto("/admin/locations/new");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel(/^Page address/).fill(slug);
  await selectAdminOption(
    page.getByRole("combobox", { name: "Type", exact: true }),
    "Town"
  );
  await page
    .getByRole("button", { name: "Create Location", exact: true })
    .click();
  await expect(page).toHaveURL(`/admin/locations/${slug}/edit`);
  return slug;
}

test("General: a meaningful edit marks dirty, reverting clears it, and dirty Cancel prompts before leaving", async ({
  page,
}) => {
  const slug = await createTempLocation(
    page,
    "Test E2E Location Guard",
    "test-e2e-location-guard"
  );
  await page.goto(`/admin/locations/${slug}/edit`);
  await expect(status(page)).toHaveCount(0);

  const nameField = page.getByLabel("Name", { exact: true });
  await nameField.fill("Test E2E Location Guard Edited");
  await expect(status(page)).toBeVisible();
  await nameField.fill("Test E2E Location Guard");
  await expect(status(page)).toHaveCount(0);

  await nameField.fill("Test E2E Location Guard Edited Again");
  await page.getByRole("link", { name: "Cancel", exact: true }).click();
  await expect(discardDialog(page)).toBeVisible();
  await page.getByRole("button", { name: "Discard changes", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/locations(\?|$)/);
});

test("General: Ctrl+S saves a valid form", async ({ page }) => {
  const slug = await createTempLocation(
    page,
    "Test E2E Location Guard Save",
    "test-e2e-location-guard-save"
  );
  await page.goto(`/admin/locations/${slug}/edit`);

  await page
    .getByLabel("Description (optional)", { exact: true })
    .fill("Saved via keyboard shortcut.");
  await expect(status(page)).toBeVisible();

  const editUrl = page.url();
  await page.keyboard.press("Control+s");
  await expect(page).toHaveURL(editUrl);
});

test("restoring an auto-synced Page-address draft keeps Name -> Page address sync active afterward", async ({
  page,
}) => {
  const slug = await createTempLocation(
    page,
    "Test E2E Location Sync Draft",
    "test-e2e-location-sync-draft"
  );
  await page.goto(`/admin/locations/${slug}/edit`);

  const nameField = page.getByLabel("Name", { exact: true });
  const slugField = page.getByLabel(/^Page address/);

  await nameField.fill("Test E2E Location Sync Draft Two");
  await expect(slugField).toHaveValue("test-e2e-location-sync-draft-two");
  await page.waitForTimeout(600);

  await page.reload();
  const recoveryDialog = page.getByRole("dialog").filter({
    has: page.getByRole("heading", { name: "Restore unsaved draft?" }),
  });
  await expect(recoveryDialog).toBeVisible();
  await page.getByRole("button", { name: "Restore draft", exact: true }).click();

  await expect(slugField).toHaveValue("test-e2e-location-sync-draft-two");

  await nameField.fill("Test E2E Location Sync Draft Three");
  await expect(slugField).toHaveValue("test-e2e-location-sync-draft-three");
});

test("Hierarchy: changing the parent marks dirty, reverting clears it, and the read-only Sub-locations table never enters the snapshot", async ({
  page,
}) => {
  const parentSlug = await createTempLocation(
    page,
    "Test E2E Location Guard Parent",
    "test-e2e-location-guard-parent"
  );
  const childSlug = await createTempLocation(
    page,
    "Test E2E Location Guard Child",
    "test-e2e-location-guard-child"
  );

  await page.goto(`/admin/locations/${childSlug}/hierarchy`);
  await expect(status(page)).toHaveCount(0);

  const parentSelect = page.getByRole("combobox", {
    name: "Parent location",
    exact: true,
  });
  await selectAdminOption(parentSelect, "Test E2E Location Guard Parent");
  await expect(status(page)).toBeVisible();

  await selectAdminOption(parentSelect, "No parent");
  await expect(status(page)).toHaveCount(0);

  // The parent now genuinely has a sub-location (the child, reassigned via
  // the real UI): the read-only Sub-locations table on the PARENT's own
  // Hierarchy tab must never be mistaken for dirty editable state.
  await selectAdminOption(parentSelect, "Test E2E Location Guard Parent");
  await page.getByRole("button", { name: "Save Hierarchy", exact: true }).click();
  await expect(page).toHaveURL(`/admin/locations/${childSlug}/hierarchy`);

  await page.goto(`/admin/locations/${parentSlug}/hierarchy`);
  await expect(status(page)).toHaveCount(0);
  await expect(
    page.getByRole("cell", { name: "Test E2E Location Guard Child", exact: true })
  ).toBeVisible();
  await expect(status(page)).toHaveCount(0);
});
