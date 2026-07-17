// Authenticated coverage for the live Item duplicate-name feedback on the
// REAL create and edit forms. Runs in the chromium-admin project with the
// storage state saved by auth.setup.ts. NON-DESTRUCTIVE by design: no form
// submission ever succeeds (the single submission attempt uses a seeded
// duplicate name, which the authoritative server action rejects), so no
// row, Auth user, or Storage object is ever created or removed — the final
// test proves it. Seeded names come from prisma/seed.ts.

import { expect, test, type Page } from "@playwright/test";
import { readFixtureCounts } from "./helpers/database-cleanup";

// Never submitted anywhere; only typed to observe the "available" state.
const UNIQUE_NAME = "Test E2E Unique Feedback Name";

// The live region's exact texts (the duplicate one matches the server
// action's own error message, by design).
const AVAILABLE_TEXT = "This name is available.";
const TAKEN_TEXT = "An item with that name already exists.";
const CURRENT_TEXT = "This is the current name.";

// Browser error hygiene: any uncaught page error fails the test. Serial
// single-worker execution makes this module-level state safe.
let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(() => {
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

function nameInput(page: Page) {
  return page.getByLabel("Name", { exact: true });
}

// The polite live region under the Name input (deliberately not
// role="status" — that role belongs to the pages' success messages).
function feedback(page: Page) {
  return page.locator("#item-name-availability");
}

test("the create form reports a unique name as available", async ({
  page,
}) => {
  await page.goto("/admin/items/new");

  await nameInput(page).fill(UNIQUE_NAME);

  await expect(feedback(page)).toHaveText(AVAILABLE_TEXT);
});

test("the create form reports a seeded name with different casing and whitespace as taken", async ({
  page,
}) => {
  await page.goto("/admin/items/new");

  await nameInput(page).fill("  iRoN oRe  ");

  await expect(feedback(page)).toHaveText(TAKEN_TEXT);
});

test("a blank name produces no availability result", async ({ page }) => {
  await page.goto("/admin/items/new");

  // Fresh form: no request, empty region.
  await expect(feedback(page)).toHaveText("");

  // Clearing after typing returns to the empty region even if a check for
  // the previous value was still in flight.
  await nameInput(page).fill(UNIQUE_NAME);
  await nameInput(page).fill("");
  await expect(feedback(page)).toHaveText("");

  // Whitespace-only input counts as blank too.
  await nameInput(page).fill("   ");
  await expect(feedback(page)).toHaveText("");
});

test("the edit form treats its unchanged current name as non-conflicting", async ({
  page,
}) => {
  await page.goto("/admin/items/iron-ore/edit");

  // The prefilled saved name needs no request at all.
  await expect(nameInput(page)).toHaveValue("Iron Ore");
  await expect(feedback(page)).toHaveText(CURRENT_TEXT);

  // A casing/whitespace variant of the OWN name is still "current" under
  // the trimmed, case-insensitive duplicate rule.
  await nameInput(page).fill("  IRON ORE ");
  await expect(feedback(page)).toHaveText(CURRENT_TEXT);
});

test("the edit form detects the name of another existing item", async ({
  page,
}) => {
  await page.goto("/admin/items/iron-ore/edit");

  await nameInput(page).fill("Copper Ore");
  await expect(feedback(page)).toHaveText(TAKEN_TEXT);

  // Restoring the own name recovers the non-conflicting state.
  await nameInput(page).fill("Iron Ore");
  await expect(feedback(page)).toHaveText(CURRENT_TEXT);
});

test("rapid typing resolves to the latest entered value", async ({ page }) => {
  await page.goto("/admin/items/new");

  // Duplicate immediately followed by a unique name: the final state must
  // reflect the LATEST value and stay stable (stale responses are dropped).
  await nameInput(page).fill("Iron Ore");
  await nameInput(page).fill(UNIQUE_NAME);
  await expect(feedback(page)).toHaveText(AVAILABLE_TEXT);
  await page.waitForTimeout(700);
  await expect(feedback(page)).toHaveText(AVAILABLE_TEXT);

  // And the reverse order must settle on the duplicate warning.
  await nameInput(page).fill(UNIQUE_NAME);
  await nameInput(page).fill("Iron Ore");
  await expect(feedback(page)).toHaveText(TAKEN_TEXT);
  await page.waitForTimeout(700);
  await expect(feedback(page)).toHaveText(TAKEN_TEXT);
});

test("a duplicate submission remains rejected by the authoritative server check", async ({
  page,
}) => {
  await page.goto("/admin/items/new");

  // Submit despite the live warning: the server action, not the client
  // feedback, is the protection — and it rejects the trimmed,
  // case-insensitive duplicate exactly as before.
  await nameInput(page).fill("  iRoN oRe  ");
  await expect(feedback(page)).toHaveText(TAKEN_TEXT);
  await page.getByRole("button", { name: "Create Item", exact: true }).click();

  await expect(page).toHaveURL("/admin/items/new?error=duplicate_name");
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "An item with that name already exists." })
  ).toBeVisible();
});

test("the feedback region is accessible and works with keyboard input", async ({
  page,
}) => {
  await page.goto("/admin/items/new");

  // The input names its live region; the region is polite and present
  // before any content arrives.
  await expect(nameInput(page)).toHaveAttribute(
    "aria-describedby",
    "item-name-availability"
  );
  await expect(feedback(page)).toHaveAttribute("aria-live", "polite");

  // Real key events (not programmatic value setting) drive the check.
  await nameInput(page).click();
  await nameInput(page).pressSequentially("Iron Ore");
  await expect(feedback(page)).toHaveText(TAKEN_TEXT);

  // The submit button is never disabled by the feedback.
  await expect(
    page.getByRole("button", { name: "Create Item", exact: true })
  ).toBeEnabled();
});

test("seeded fixtures are unchanged — the suite never wrote anything", async () => {
  expect(await readFixtureCounts()).toEqual({
    categories: 5,
    professions: 10,
    items: 16,
    recipes: 8,
    recipeIngredients: 15,
  });
});
