// Focused E2E coverage for SaveShortcutLabel (Admin Polish Pass 2, Part 4)
// — the OS-aware Ctrl+S/Cmd+S hint rendered inside AdminFormGuard's own
// actions row. The pure label logic itself (isMacPlatform/
// formatSaveShortcutLabel/saveShortcutAccessibleLabel) is already fully
// unit-tested in src/lib/admin/save-shortcut.test.ts; this spec proves the
// component actually reads the browser's own platform signal and renders
// the right label in a real page, on the Item General editor as one
// representative guarded form (every other guarded form shares the same
// component, already proven generic by save-shortcut-label.test.tsx's own
// static-render coverage).

import { expect, test } from "@playwright/test";
import { deleteE2eTestItemRecords } from "./helpers/database-cleanup";

const ITEM = {
  name: "Test E2E Item Shortcut Label",
  slug: "test-e2e-item-shortcut-label",
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

function shortcutHint(page: import("@playwright/test").Page) {
  return page.locator(".admin-editor-shortcut-hint");
}

// Stubs exactly the two signals SaveShortcutLabel itself reads, in the
// order it reads them (userAgentData.platform first, navigator.platform
// as the fallback) — a direct, non-brittle emulation of the real browser
// API rather than a UI trick. Chromium's own navigator.userAgentData
// reports the real host OS (e.g. "Windows"), which the component checks
// FIRST, so overriding navigator.platform alone is not enough: it must be
// stubbed too, or the real host value wins.
async function emulateMacPlatform(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, "platform", {
      value: "MacIntel",
      configurable: true,
    });
    Object.defineProperty(window.navigator, "userAgentData", {
      value: { platform: "macOS" },
      configurable: true,
    });
  });
}

test("on a real (non-Mac) test runner, the shortcut hint shows the Ctrl+S label", async ({
  page,
}) => {
  await page.goto("/admin/items/iron-ore/edit");
  const hint = shortcutHint(page);
  await expect(hint).toBeVisible();
  await expect(hint).toHaveText("Ctrl+S");
  await expect(hint).toHaveAttribute("aria-label", "Save shortcut: Control S");
});

test("emulating a macOS platform signal upgrades the hint to the Command label", async ({
  page,
}) => {
  await emulateMacPlatform(page);

  await page.goto("/admin/items/iron-ore/edit");
  const hint = shortcutHint(page);
  await expect(hint).toBeVisible();
  await expect(hint).toHaveText("⌘S");
  await expect(hint).toHaveAttribute(
    "aria-label",
    "Save shortcut: Command S"
  );
});

test("Ctrl+S still saves the form when the hint shows the Mac label", async ({
  page,
}) => {
  // Confirms Part 4's own requirement that the label is cosmetic only —
  // both physical shortcuts keep working regardless of the displayed hint.
  await emulateMacPlatform(page);

  await page.goto("/admin/items/new");
  await page.getByLabel("Name", { exact: true }).fill(ITEM.name);
  await page.getByLabel(/^Page address/).fill(ITEM.slug);
  await page.getByRole("button", { name: "Create item", exact: true }).click();
  await expect(page).toHaveURL(`/admin/items/${ITEM.slug}/edit`);
  await expect(shortcutHint(page)).toHaveText("⌘S");

  await page
    .getByLabel("Description (optional)", { exact: true })
    .fill("Saved via the Mac-labeled shortcut.");
  await expect(page.getByText("Unsaved changes", { exact: true })).toBeVisible();

  const editUrl = page.url();
  await page.keyboard.press("Control+s");
  await expect(page).toHaveURL(editUrl);
  await expect(page.getByText("Unsaved changes", { exact: true })).toHaveCount(0);
});
