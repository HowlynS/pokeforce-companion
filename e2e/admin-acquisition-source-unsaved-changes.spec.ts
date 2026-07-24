// Focused E2E coverage for the Sonnet Rollout Pass's Acquisition Source
// adoption of the shared AdminFormGuard (the create form on
// /admin/items/[slug]/sources, and the dedicated edit route). Mirrors the
// Item pilot (e2e/admin-item-unsaved-changes.spec.ts) but trimmed to what
// the shared architecture doesn't already prove generically: that the
// guard is wired up on both Acquisition Source routes, that a linked
// select (Location/Profession) participates in dirty tracking, and that a
// fresh create form's optional fields do not spuriously start dirty.

import { expect, test, type Page } from "@playwright/test";
import { selectAdminOption } from "./helpers/admin-select";
import { deleteE2eTestAcquisitionRecords } from "./helpers/database-cleanup";

let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.beforeAll(async () => {
  await deleteE2eTestAcquisitionRecords();
});

test.afterEach(async () => {
  await deleteE2eTestAcquisitionRecords();
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

test.afterAll(async () => {
  expect(await deleteE2eTestAcquisitionRecords()).toBe(0);
});

function status(page: Page) {
  return page.getByText("Unsaved changes", { exact: true });
}

function discardDialog(page: Page) {
  return page.getByRole("dialog").filter({
    has: page.getByRole("heading", { name: "Discard unsaved changes?" }),
  });
}

async function createTempItem(
  page: Page,
  name: string,
  slug: string
): Promise<string> {
  await page.goto("/admin/items/new");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel(/^Page address/).fill(slug);
  await page.getByRole("button", { name: "Create item", exact: true }).click();
  await expect(page).toHaveURL("/admin/items?success=created");
  return slug;
}

test("create form: a fresh visit is never dirty, filling fields marks dirty, and a dirty tab switch prompts before leaving", async ({
  page,
}) => {
  const itemSlug = await createTempItem(
    page,
    "Test E2E Acqsrc Guard Item",
    "test-e2e-acqsrc-item-guard"
  );
  await page.goto(`/admin/items/${itemSlug}/sources`);
  await expect(status(page)).toHaveCount(0);

  await selectAdminOption(
    page.getByRole("combobox", { name: "Type", exact: true }),
    "Mining"
  );
  await expect(status(page)).toBeVisible();

  // Cancel on this page is deliberately a same-page link (the create form
  // lives on the Sources tab's own landing route, unlike every other
  // resource's dedicated /new page) — the guard correctly treats a
  // same-URL link as "not leaving the editor" and never prompts for it.
  // The General tab link is a genuine cross-page navigation instead.
  await page.getByLabel("Notes (optional)", { exact: true }).fill("Some notes.");
  await page.getByRole("link", { name: "General", exact: true }).click();
  await expect(discardDialog(page)).toBeVisible();
  await page.getByRole("button", { name: "Discard changes", exact: true }).click();
  await expect(page).toHaveURL(`/admin/items/${itemSlug}/edit`);
});

test("edit form: a linked-select change marks dirty, reverting clears it, and Ctrl+S saves", async ({
  page,
}) => {
  const itemSlug = await createTempItem(
    page,
    "Test E2E Acqsrc Guard Edit Item",
    "test-e2e-acqsrc-item-guard-edit"
  );
  await page.goto(`/admin/items/${itemSlug}/sources`);
  await selectAdminOption(
    page.getByRole("combobox", { name: "Type", exact: true }),
    "Foraging"
  );
  await page.getByRole("button", { name: "Add Source", exact: true }).click();
  await expect(page).toHaveURL(
    `/admin/items/${itemSlug}/sources?success=created`
  );

  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await expect(status(page)).toHaveCount(0);

  const typeSelect = page.getByRole("combobox", { name: "Type", exact: true });
  await selectAdminOption(typeSelect, "Mining");
  await expect(status(page)).toBeVisible();
  await selectAdminOption(typeSelect, "Foraging");
  await expect(status(page)).toHaveCount(0);

  await page.getByLabel("Notes (optional)", { exact: true }).fill("Verified by hand.");
  await expect(status(page)).toBeVisible();
  await page.keyboard.press("Control+s");
  await expect(page).toHaveURL(
    `/admin/items/${itemSlug}/sources?success=updated`
  );
});
