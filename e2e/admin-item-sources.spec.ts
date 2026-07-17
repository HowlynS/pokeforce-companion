// Authenticated Acquisition Source admin lifecycle against the REAL
// application and the isolated Supabase test project. Runs in the
// chromium-admin project with the storage state saved by auth.setup.ts.
// Every test is fully self-contained: it creates its own temporary Item
// (and, where needed, Location/Profession), each carrying its own
// test-e2e-acqsrc- prefix, and afterEach sweeps everything — a mid-test
// failure can never strand a row or leak state into the next test.
// AcquisitionSource has no slug of its own, so its rows are cleaned up
// through those relations. No public "How to obtain" section exists yet
// (Slice 8E), so verification stamping is observed through the admin
// table's own Verified column.

import { expect, test, type Page } from "@playwright/test";
import {
  countE2eTestAcquisitionRecords,
  deleteE2eTestAcquisitionRecords,
} from "./helpers/database-cleanup";

const VERIFICATION_CHECKBOX_LABEL =
  "Mark gameplay data as verified for the selected game version.";

// Browser error hygiene: any uncaught page error fails the test. Serial
// single-worker execution makes this module-level state safe.
let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(async () => {
  // Defensive prefix-scoped cleanup even when a test failed mid-lifecycle.
  await deleteE2eTestAcquisitionRecords();
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

test.beforeAll(async () => {
  // Remove stale rows from interrupted earlier runs; the guard inside the
  // helper throws here if the environment is not the verified test project.
  await deleteE2eTestAcquisitionRecords();
  expect(await countE2eTestAcquisitionRecords()).toBe(0);
});

test.afterAll(async () => {
  const remaining = await deleteE2eTestAcquisitionRecords();
  // afterEach should already have removed everything — fail loudly if not.
  expect(remaining).toBe(0);
});

// The admin table row for a record, located by its exact Name cell (first
// column) — not just any cell.
// One row of the shared Item record list (Slice 9B.4), located by its
// exact primary text inside the list's navigation landmark.
function recordRow(page: Page, name: string) {
  return page
    .getByRole("navigation", { name: "Items records" })
    .getByRole("link")
    .filter({ has: page.getByText(name, { exact: true }) });
}

// Creates a minimal temporary Item through the real admin form (on the
// dedicated /admin/items/new page since Slice 9B.4).
async function createTemporaryItem(page: Page, data: { name: string; slug: string }) {
  await page.goto("/admin/items/new");
  await page.getByLabel("Name", { exact: true }).fill(data.name);
  await page.getByLabel(/^Slug/).fill(data.slug);
  await page.getByRole("button", { name: "Create Item", exact: true }).click();
  await expect(page).toHaveURL("/admin/items?success=created");
}

// Adds a source with only its type set, through the real create form.
async function addTypeOnlySource(page: Page, itemSlug: string, typeLabel: string) {
  await page.goto(`/admin/items/${itemSlug}/sources`);
  await page
    .getByRole("combobox", { name: "Type", exact: true })
    .selectOption({ label: typeLabel });
  await page.getByRole("button", { name: "Add Source", exact: true }).click();
  await expect(page).toHaveURL(
    `/admin/items/${itemSlug}/sources?success=created`
  );
}

test("acquisition source create/edit/delete lifecycle through the real admin UI", async ({
  page,
}) => {
  const ITEM = {
    name: "Test E2E Acqsrc Item Lifecycle",
    slug: "test-e2e-acqsrc-item-lifecycle",
  };
  const LOCATION = {
    name: "Test E2E Acqsrc Location Lifecycle",
    slug: "test-e2e-acqsrc-location-lifecycle",
    type: "Route",
  };
  const PROFESSION = {
    name: "Test E2E Acqsrc Profession Lifecycle",
    slug: "test-e2e-acqsrc-profession-lifecycle",
  };

  // --- Set up the temporary Item, Location, and Profession --------------
  await createTemporaryItem(page, ITEM);

  await page.goto("/admin/locations");
  await page.getByLabel("Name", { exact: true }).fill(LOCATION.name);
  await page.getByLabel(/^Slug/).fill(LOCATION.slug);
  await page
    .getByRole("combobox", { name: "Type", exact: true })
    .selectOption({ label: LOCATION.type });
  await page
    .getByRole("button", { name: "Create Location", exact: true })
    .click();
  await expect(page).toHaveURL("/admin/locations?success=created");

  await page.goto("/admin/professions");
  await page.getByLabel("Name", { exact: true }).fill(PROFESSION.name);
  await page.getByLabel(/^Slug/).fill(PROFESSION.slug);
  await page
    .getByRole("button", { name: "Create Profession", exact: true })
    .click();
  await expect(page).toHaveURL("/admin/professions?success=created");

  // --- Navigate to the item's Sources page via the real links: the
  // record-list row opens the editor, whose toolbar links to sources
  // (the old table's per-row Sources link went with the table, 9B.4). ----
  await page.goto("/admin/items");
  await recordRow(page, ITEM.name).click();
  await expect(page).toHaveURL(`/admin/items/${ITEM.slug}/edit`);
  await page
    .getByRole("link", { name: "Manage acquisition sources", exact: true })
    .click();
  await expect(page).toHaveURL(`/admin/items/${ITEM.slug}/sources`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Acquisition Sources" })
  ).toBeVisible();
  await expect(page.getByText("No acquisition sources yet")).toBeVisible();

  // --- Create a source with only type + label + quantity (no relations) -
  await page
    .getByRole("combobox", { name: "Type", exact: true })
    .selectOption({ label: "Foraging" });
  await page.getByLabel(/^Source label/).fill("Seed Merchant");
  await page.getByLabel(/^Quantity/).fill("1-3");
  await page.getByRole("button", { name: "Add Source", exact: true }).click();

  await expect(page).toHaveURL(
    `/admin/items/${ITEM.slug}/sources?success=created`
  );
  await expect(page.getByRole("status")).toHaveText("Acquisition source added.");

  const sourceRow = page
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: "Seed Merchant", exact: true }) });
  await expect(sourceRow).toBeVisible();
  await expect(
    sourceRow.getByRole("cell", { name: "Foraging", exact: true })
  ).toBeVisible();
  await expect(
    sourceRow.getByRole("cell", { name: "1-3", exact: true })
  ).toBeVisible();
  // Verified column reads No: the checkbox was never checked.
  await expect(
    sourceRow.getByRole("cell", { name: "No", exact: true })
  ).toBeVisible();

  // --- Edit: change type, link the temporary Location and Profession, ---
  // --- and verify via the opt-in checkbox --------------------------------
  await sourceRow.getByRole("link", { name: "Edit" }).click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/items/${ITEM.slug}/sources/.+/edit`)
  );
  await expect(
    page.getByRole("heading", { level: 1, name: "Edit Acquisition Source" })
  ).toBeVisible();

  await page
    .getByRole("combobox", { name: "Type", exact: true })
    .selectOption({ label: "NPC or shop" });
  await page
    .getByRole("combobox", { name: "Location (optional)", exact: true })
    .selectOption({ label: LOCATION.name });
  await page
    .getByRole("combobox", { name: "Profession (optional)", exact: true })
    .selectOption({ label: PROFESSION.name });
  const verifyCheckbox = page.getByLabel(VERIFICATION_CHECKBOX_LABEL);
  await expect(verifyCheckbox).not.toBeChecked();
  await verifyCheckbox.check();
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();

  await expect(page).toHaveURL(
    `/admin/items/${ITEM.slug}/sources?success=updated`
  );
  await expect(page.getByRole("status")).toHaveText("Acquisition source updated.");

  const updatedRow = page
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: "Seed Merchant", exact: true }) });
  await expect(
    updatedRow.getByRole("cell", { name: "NPC or shop", exact: true })
  ).toBeVisible();
  await expect(
    updatedRow.getByRole("cell", { name: LOCATION.name, exact: true })
  ).toBeVisible();
  await expect(
    updatedRow.getByRole("cell", { name: PROFESSION.name, exact: true })
  ).toBeVisible();
  // Verified column now reads Yes.
  await expect(
    updatedRow.getByRole("cell", { name: "Yes", exact: true })
  ).toBeVisible();

  // --- A later NORMAL edit must preserve the verification stamp ----------
  await updatedRow.getByRole("link", { name: "Edit" }).click();
  await expect(page.getByLabel(VERIFICATION_CHECKBOX_LABEL)).not.toBeChecked();
  await page.getByLabel(/^Quantity/).fill("2-4");
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(page).toHaveURL(
    `/admin/items/${ITEM.slug}/sources?success=updated`
  );

  const preservedRow = page
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: "Seed Merchant", exact: true }) });
  await expect(
    preservedRow.getByRole("cell", { name: "2-4", exact: true })
  ).toBeVisible();
  await expect(
    preservedRow.getByRole("cell", { name: "Yes", exact: true })
  ).toBeVisible();

  // --- Delete -------------------------------------------------------------
  await preservedRow.getByRole("link", { name: "Delete" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Delete Acquisition Source" })
  ).toBeVisible();
  await expect(page.getByText("Source label: Seed Merchant")).toBeVisible();
  await page
    .getByRole("button", { name: "Delete Permanently", exact: true })
    .click();

  await expect(page).toHaveURL(
    `/admin/items/${ITEM.slug}/sources?success=deleted`
  );
  await expect(page.getByRole("status")).toHaveText("Acquisition source removed.");
  await expect(page.getByText("No acquisition sources yet")).toBeVisible();
});

test("the item edit page links to its acquisition sources", async ({ page }) => {
  const ITEM = {
    name: "Test E2E Acqsrc Item Link",
    slug: "test-e2e-acqsrc-item-link",
  };
  await createTemporaryItem(page, ITEM);

  await page.goto(`/admin/items/${ITEM.slug}/edit`);
  await page.getByRole("link", { name: "Manage acquisition sources" }).click();
  await expect(page).toHaveURL(`/admin/items/${ITEM.slug}/sources`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Acquisition Sources" })
  ).toBeVisible();
});

test("deleting the item cascades its acquisition sources", async ({ page }) => {
  const ITEM = {
    name: "Test E2E Acqsrc Item Cascade",
    slug: "test-e2e-acqsrc-item-cascade",
  };
  await createTemporaryItem(page, ITEM);

  await page.goto(`/admin/items/${ITEM.slug}/sources`);
  await page
    .getByRole("combobox", { name: "Type", exact: true })
    .selectOption({ label: "Mining" });
  await page.getByRole("button", { name: "Add Source", exact: true }).click();
  await expect(page).toHaveURL(
    `/admin/items/${ITEM.slug}/sources?success=created`
  );
  expect(await countE2eTestAcquisitionRecords()).toBe(2); // item + source

  // No relation blocker exists for acquisition sources — the item deletes
  // immediately, cascading the source with it.
  await page.goto(`/admin/items/${ITEM.slug}/delete`);
  await page
    .getByRole("button", { name: "Delete Permanently", exact: true })
    .click();
  await expect(page).toHaveURL("/admin/items?success=deleted");

  expect(await countE2eTestAcquisitionRecords()).toBe(0);
});

test("an unknown item slug fails safely on every sources route", async ({
  page,
}) => {
  const unknownSlug = "test-e2e-acqsrc-item-does-not-exist";

  const listResponse = await page.goto(`/admin/items/${unknownSlug}/sources`);
  expect(listResponse?.status()).toBe(404);

  const editResponse = await page.goto(
    `/admin/items/${unknownSlug}/sources/whatever-id/edit`
  );
  expect(editResponse?.status()).toBe(404);

  const deleteResponse = await page.goto(
    `/admin/items/${unknownSlug}/sources/whatever-id/delete`
  );
  expect(deleteResponse?.status()).toBe(404);
});

test("an unknown source id under a real item fails safely", async ({
  page,
}) => {
  const ITEM = {
    name: "Test E2E Acqsrc Item Unknown Source",
    slug: "test-e2e-acqsrc-item-unknown-source",
  };
  await createTemporaryItem(page, ITEM);

  const editResponse = await page.goto(
    `/admin/items/${ITEM.slug}/sources/does-not-exist-id/edit`
  );
  expect(editResponse?.status()).toBe(404);

  const deleteResponse = await page.goto(
    `/admin/items/${ITEM.slug}/sources/does-not-exist-id/delete`
  );
  expect(deleteResponse?.status()).toBe(404);
});

test("visiting a source's edit or delete page under a DIFFERENT item's slug fails safely", async ({
  page,
}) => {
  const ITEM_A = {
    name: "Test E2E Acqsrc Item Owner A",
    slug: "test-e2e-acqsrc-item-owner-a",
  };
  const ITEM_B = {
    name: "Test E2E Acqsrc Item Owner B",
    slug: "test-e2e-acqsrc-item-owner-b",
  };
  await createTemporaryItem(page, ITEM_A);
  await createTemporaryItem(page, ITEM_B);
  await addTypeOnlySource(page, ITEM_A.slug, "Farming");

  // The real Edit link on Item A's own sources page carries Item A's slug
  // and the source's real id.
  const editHref = await page
    .getByRole("link", { name: "Edit", exact: true })
    .getAttribute("href");
  expect(editHref).toMatch(
    new RegExp(`^/admin/items/${ITEM_A.slug}/sources/.+/edit$`)
  );
  const sourceId = editHref?.split("/sources/")[1]?.split("/edit")[0];

  // The SAME source id, but under Item B's slug — a mismatched route —
  // must be treated exactly like a source that does not exist.
  const mismatchedEditResponse = await page.goto(
    `/admin/items/${ITEM_B.slug}/sources/${sourceId}/edit`
  );
  expect(mismatchedEditResponse?.status()).toBe(404);

  const mismatchedDeleteResponse = await page.goto(
    `/admin/items/${ITEM_B.slug}/sources/${sourceId}/delete`
  );
  expect(mismatchedDeleteResponse?.status()).toBe(404);

  // The source survived under its real owner, completely unaffected.
  await page.goto(`/admin/items/${ITEM_A.slug}/sources`);
  await expect(
    page.getByRole("cell", { name: "Farming", exact: true })
  ).toBeVisible();
});

test("submitting an edit with a mismatched itemSlug is rejected without changing the source", async ({
  page,
}) => {
  const ITEM_A = {
    name: "Test E2E Acqsrc Item Stale Edit A",
    slug: "test-e2e-acqsrc-item-stale-edit-a",
  };
  const ITEM_B = {
    name: "Test E2E Acqsrc Item Stale Edit B",
    slug: "test-e2e-acqsrc-item-stale-edit-b",
  };
  await createTemporaryItem(page, ITEM_A);
  await createTemporaryItem(page, ITEM_B);
  await addTypeOnlySource(page, ITEM_A.slug, "Farming");

  // Open the REAL edit page for Item A's source (a legitimate page load,
  // its hidden itemSlug field correctly reads Item A)...
  await page
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: "Farming", exact: true }) })
    .getByRole("link", { name: "Edit" })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Edit Acquisition Source" })
  ).toBeVisible();

  // ...then tamper the hidden itemSlug field to Item B before submitting,
  // simulating a stale or forged submission that disagrees with the
  // source's real owner.
  await page
    .locator('input[name="itemSlug"]')
    .evaluate((el, value) => {
      (el as HTMLInputElement).value = value;
    }, ITEM_B.slug);
  await page
    .getByRole("combobox", { name: "Type", exact: true })
    .selectOption({ label: "Mining" });
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();

  // Rejected as a missing source relative to the (tampered) Item B route —
  // never silently applied to Item A's real row.
  await expect(page).toHaveURL(
    `/admin/items/${ITEM_B.slug}/sources?error=missing_source`
  );
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "That acquisition source no longer exists." })
  ).toBeVisible();

  // Item A's source is completely unchanged (still Farming, not Mining).
  await page.goto(`/admin/items/${ITEM_A.slug}/sources`);
  await expect(
    page.getByRole("cell", { name: "Farming", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Mining", exact: true })
  ).toHaveCount(0);
});

test("submitting a delete with a mismatched itemSlug is rejected without deleting the source", async ({
  page,
}) => {
  const ITEM_A = {
    name: "Test E2E Acqsrc Item Stale Delete A",
    slug: "test-e2e-acqsrc-item-stale-delete-a",
  };
  const ITEM_B = {
    name: "Test E2E Acqsrc Item Stale Delete B",
    slug: "test-e2e-acqsrc-item-stale-delete-b",
  };
  await createTemporaryItem(page, ITEM_A);
  await createTemporaryItem(page, ITEM_B);
  await addTypeOnlySource(page, ITEM_A.slug, "Fishing");

  // Open the REAL delete confirmation page for Item A's source...
  await page
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: "Fishing", exact: true }) })
    .getByRole("link", { name: "Delete" })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Delete Acquisition Source" })
  ).toBeVisible();

  // ...then tamper the hidden itemSlug field to Item B before confirming.
  await page
    .locator('input[name="itemSlug"]')
    .evaluate((el, value) => {
      (el as HTMLInputElement).value = value;
    }, ITEM_B.slug);
  await page
    .getByRole("button", { name: "Delete Permanently", exact: true })
    .click();

  await expect(page).toHaveURL(
    `/admin/items/${ITEM_B.slug}/sources?error=missing_source`
  );

  // Item A's source survived, completely untouched.
  await page.goto(`/admin/items/${ITEM_A.slug}/sources`);
  await expect(
    page.getByRole("cell", { name: "Fishing", exact: true })
  ).toBeVisible();
});
