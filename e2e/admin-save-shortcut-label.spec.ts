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

// The button the shortcut badge must render INSIDE (Admin UI Corrections
// pass) — the same submit button the badge used to sit beside, as a
// sibling, before this pass moved it in.
function saveButton(page: import("@playwright/test").Page) {
  return page.locator("button.admin-editor-submit");
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

test("on a real (non-Mac) test runner, the shortcut badge shows Ctrl+S inside the Save button", async ({
  page,
}) => {
  await page.goto("/admin/items/iron-ore/edit");
  const hint = shortcutHint(page);
  await expect(hint).toBeVisible();
  await expect(hint).toHaveText("Ctrl+S");
  // Admin UI Corrections pass: purely decorative now that it renders
  // inside the button — see the "descendant of the Save button" and
  // "accessible name" tests below for the full structural/a11y proof.
  await expect(hint).toHaveAttribute("aria-hidden", "true");
});

test("emulating a macOS platform signal upgrades the badge to the Command label", async ({
  page,
}) => {
  await emulateMacPlatform(page);

  await page.goto("/admin/items/iron-ore/edit");
  const hint = shortcutHint(page);
  await expect(hint).toBeVisible();
  await expect(hint).toHaveText("⌘S");
  await expect(hint).toHaveAttribute("aria-hidden", "true");
});

test("the shortcut badge — icon, label, and Ctrl+S — are all descendants of the same Save button, never an external sibling", async ({
  page,
}) => {
  await page.goto("/admin/items/iron-ore/edit");

  const button = saveButton(page);
  await expect(button).toBeVisible();
  // The Save icon, the "Save Changes" text, and the shortcut badge must
  // all resolve as descendants of this one button element.
  await expect(button.locator("svg.admin-editor-submit-icon")).toHaveCount(1);
  await expect(button).toContainText("Save Changes");
  await expect(button.locator(".admin-editor-shortcut-hint")).toHaveText(
    "Ctrl+S"
  );

  // The badge no longer exists as a sibling of the button — the ONLY
  // shortcut-hint element on the page is the one inside it.
  await expect(shortcutHint(page)).toHaveCount(1);
  await expect(page.locator(".admin-editor-shortcut-hint")).toHaveCount(1);
});

test("the shortcut badge is not a separate focus target, and the button's own accessible name stays clean", async ({
  page,
}) => {
  await page.goto("/admin/items/iron-ore/edit");

  const button = saveButton(page);
  // aria-hidden content is excluded from the accessible name computation,
  // so the button's own name is exactly its visible label — never
  // "Save Changes Ctrl+S" or similar duplication.
  await expect(button).toHaveAccessibleName("Save Changes");

  // Tabbing focus onto the button lands on the BUTTON itself; the badge
  // inside it is not independently reachable (no separate tab stop).
  await button.focus();
  const focusedIsButton = await page.evaluate(() => {
    const active = document.activeElement;
    return active?.classList.contains("admin-editor-submit") ?? false;
  });
  expect(focusedIsButton).toBe(true);

  await page.keyboard.press("Tab");
  const focusedShortcutBadge = await page.evaluate(() => {
    return (
      document.activeElement?.classList.contains(
        "admin-editor-shortcut-hint"
      ) ?? false
    );
  });
  expect(focusedShortcutBadge).toBe(false);
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
