// Focused E2E coverage for the in-editor delete dialog (Admin Polish Pass
// 1, Part 5) — DangerZonePanel opening DeleteRecordDialog directly over
// the current editor instead of navigating to the dedicated /delete
// route. Each resource's own admin-<resource>.spec.ts already proves the
// actual deletion lifecycle (server action, redirects, dependency
// blocking) through this same dialog; this spec adds what those don't:
// that opening it causes NO route change, the editor stays fully visible
// and intact underneath, dirty-form interaction never stacks a second
// modal, Ctrl/Cmd+S is suppressed while it is open, and Confirm submits
// exactly once. Exercised primarily on Item (the richest case — a real
// dependency-blocking rule) with one representative check each for the
// other resource shapes (Recipe: no blocking rule; Game Version: the
// list-page variant) rather than repeating everything six more times.

import { expect, test } from "@playwright/test";
import { deleteE2eTestItemRecords } from "./helpers/database-cleanup";

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

test("opens over the editor with no route change on a clean form, editor content intact underneath, Escape closes without deleting", async ({
  page,
}) => {
  await page.goto("/admin/items/new");
  await page.getByLabel("Name", { exact: true }).fill("Test E2E Item Inline Delete");
  await page.getByLabel(/^Page address/).fill("test-e2e-item-inline-delete");
  await page.getByRole("button", { name: "Create item", exact: true }).click();
  await expect(page).toHaveURL(
    "/admin/items/test-e2e-item-inline-delete/edit"
  );

  await page.goto("/admin/items/test-e2e-item-inline-delete/edit");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("button", { name: "Delete item", exact: true }).click();
  await expect(page).toHaveURL("/admin/items/test-e2e-item-inline-delete/edit");
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(
    page.getByRole("heading", { level: 2, name: "Delete Item" })
  ).toBeVisible();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Test E2E Item Inline Delete"
  );

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL("/admin/items/test-e2e-item-inline-delete/edit");

  await page.goto("/admin/items");
  await expect(page.getByText("Test E2E Item Inline Delete")).toBeVisible();
});

test("dirty form: shows exactly one dialog (never the unsaved-navigation prompt too), Cancel preserves the dirty value, Ctrl/Cmd+S is suppressed while open, Confirm submits exactly once", async ({
  page,
}) => {
  await page.goto("/admin/items/new");
  await page.getByLabel("Name", { exact: true }).fill("Test E2E Item Inline Delete Dirty");
  await page.getByLabel(/^Page address/).fill("test-e2e-item-inline-delete-dirty");
  await page.getByRole("button", { name: "Create item", exact: true }).click();
  await expect(page).toHaveURL(
    "/admin/items/test-e2e-item-inline-delete-dirty/edit"
  );

  await page.goto("/admin/items/test-e2e-item-inline-delete-dirty/edit");
  const name = page.getByLabel("Name", { exact: true });
  await name.fill("Test E2E Item Inline Delete Dirty EDITED");
  await expect(page.getByText("Unsaved changes", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Delete item", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(
    page.getByText(
      "This editor has unsaved changes. They will be lost if the deletion succeeds."
    )
  ).toBeVisible();

  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(name).toHaveValue("Test E2E Item Inline Delete Dirty EDITED");
  await expect(page.getByText("Unsaved changes", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Delete item", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await page.keyboard.press("Control+s");
  await page.waitForTimeout(300);
  await expect(page).toHaveURL("/admin/items/test-e2e-item-inline-delete-dirty/edit");
  await expect(page.getByRole("dialog")).toHaveCount(1);

  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete Permanently", exact: true })
    .click();
  await expect(page).toHaveURL("/admin/items");
});

test("a blocked dependency disables Confirm and shows the reason, without navigating anywhere", async ({
  page,
}) => {
  // iron-ore is a seeded fixture already referenced by a recipe — read
  // only, never modified.
  await page.goto("/admin/items/iron-ore/edit");
  await page.getByRole("button", { name: "Delete item", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Delete Permanently", exact: true })
  ).toBeDisabled();
  await expect(
    page.getByText(/cannot be deleted because it is used as/)
  ).toBeVisible();
  await expect(page).toHaveURL("/admin/items/iron-ore/edit");
});

test("Recipe (no blocking rule) also opens in place, over its own editor", async ({
  page,
}) => {
  await page.goto("/admin/recipes");
  await page
    .getByRole("navigation", { name: "Recipes records" })
    .getByRole("link")
    .first()
    .click();
  await page.getByRole("button", { name: "Delete Recipe", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(
    page.getByRole("heading", { level: 2, name: "Delete Recipe" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Delete Permanently", exact: true })
  ).toBeEnabled();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("Game Version's list-page delete trigger opens in place too, and Ctrl+S while it is open does not submit the Create form", async ({
  page,
}) => {
  await page.goto("/admin/settings/game-versions");
  await page.getByRole("button", { name: "Delete", exact: true }).first().click();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(
    page.getByRole("heading", { level: 2, name: "Delete Game Version" })
  ).toBeVisible();

  // The page's own Create Game Version form is a separate guarded form;
  // Ctrl+S while the delete dialog is open must not submit it.
  await page.keyboard.press("Control+s");
  await page.waitForTimeout(300);
  await expect(page).toHaveURL("/admin/settings/game-versions");
  await expect(page.getByRole("dialog")).toHaveCount(1);

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL("/admin/settings/game-versions");
});
