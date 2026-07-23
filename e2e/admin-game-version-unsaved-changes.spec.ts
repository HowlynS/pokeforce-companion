// Focused E2E coverage for the Sonnet Rollout Pass's Game Version adoption
// of the shared AdminFormGuard: the inline Create form on the settings
// overview page, and the dedicated Edit route. Unlike every other
// resource, the overview page also renders a separate "Mark as current"
// <form> per non-current row — this spec's central requirement is that
// those forms never participate in the Create form's own guard, and that
// Ctrl/Cmd+S always targets Create specifically.

import { expect, test, type Page } from "@playwright/test";
import {
  createE2eTestGameVersion,
  deleteE2eTestGameVersionRecords,
} from "./helpers/database-cleanup";

let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.beforeAll(async () => {
  await deleteE2eTestGameVersionRecords();
});

test.afterEach(async () => {
  await deleteE2eTestGameVersionRecords();
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

test.afterAll(async () => {
  expect(await deleteE2eTestGameVersionRecords()).toBe(0);
});

function status(page: Page) {
  return page.getByText("Unsaved changes", { exact: true });
}

function discardDialog(page: Page) {
  return page.getByRole("dialog").filter({
    has: page.getByRole("heading", { name: "Discard unsaved changes?" }),
  });
}

test("Create form: a fresh visit is never dirty, typing marks dirty, Ctrl+S submits Create (never Mark as current)", async ({
  page,
}) => {
  // A non-current historical version gives the page a real "Mark as
  // current" form to prove the guard ignores.
  await createE2eTestGameVersion("test-e2e-gv-unsaved-historical");

  await page.goto("/admin/settings/game-versions");
  await expect(status(page)).toHaveCount(0);

  await expect(
    page.getByRole("button", { name: "Mark as current", exact: true }).first()
  ).toBeVisible();

  await page.locator('#create-game-version input[name="name"]').fill(
    "test-e2e-gv-unsaved-created"
  );
  await expect(status(page)).toBeVisible();

  await page.keyboard.press("Control+s");
  await expect(page).toHaveURL(/\/admin\/settings\/game-versions\?success=/);
  await expect(
    page.getByRole("cell", { name: "test-e2e-gv-unsaved-created", exact: true })
  ).toBeVisible();
});

test("Create form: dirty Cancel prompts before leaving; Mark as current stays a normal, unguarded action", async ({
  page,
}) => {
  await createE2eTestGameVersion("test-e2e-gv-unsaved-markcurrent");

  await page.goto("/admin/settings/game-versions");
  await page
    .locator('#create-game-version input[name="name"]')
    .fill("test-e2e-gv-unsaved-dirty");
  await expect(status(page)).toBeVisible();

  // Mark as current is a genuinely different <form> — clicking it is an
  // ordinary submission, never intercepted by the Create form's guard.
  const row = page.getByRole("row").filter({
    has: page.getByRole("cell", { name: "test-e2e-gv-unsaved-markcurrent", exact: true }),
  });
  await row.getByRole("button", { name: "Mark as current", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/settings\/game-versions\?success=marked_current/);
  await expect(discardDialog(page)).toHaveCount(0);
});

test("Edit form: a meaningful edit marks dirty, reverting clears it, and Ctrl+S saves", async ({
  page,
}) => {
  await createE2eTestGameVersion("test-e2e-gv-unsaved-edit");

  await page.goto("/admin/settings/game-versions");
  const editHref = await page
    .getByRole("row")
    .filter({
      has: page.getByRole("cell", { name: "test-e2e-gv-unsaved-edit", exact: true }),
    })
    .getByRole("link", { name: "Edit", exact: true })
    .getAttribute("href");
  if (!editHref) {
    throw new Error("Could not locate the Edit link for the test Game Version.");
  }

  await page.goto(editHref);
  await expect(status(page)).toHaveCount(0);

  const nameField = page.getByLabel("Name", { exact: true });
  await nameField.fill("test-e2e-gv-unsaved-edit-changed");
  await expect(status(page)).toBeVisible();
  await nameField.fill("test-e2e-gv-unsaved-edit");
  await expect(status(page)).toHaveCount(0);

  await page
    .getByLabel("Description (optional)", { exact: true })
    .fill("Edited via keyboard shortcut.");
  await expect(status(page)).toBeVisible();
  await page.keyboard.press("Control+s");
  await expect(page).toHaveURL(/\/admin\/settings\/game-versions\?success=updated/);
});
