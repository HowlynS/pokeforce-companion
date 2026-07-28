import { expect, test, type Page } from "@playwright/test";
import {
  countE2eTestGameVersionRecords,
  deleteE2eTestGameVersionRecords,
} from "./helpers/database-cleanup";

const VERSION_NAME = "test-e2e-gv-date-picker";
let pageErrors: string[] = [];

test.beforeAll(async () => {
  await deleteE2eTestGameVersionRecords();
  expect(await countE2eTestGameVersionRecords()).toBe(0);
});

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(async () => {
  await deleteE2eTestGameVersionRecords();
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

test.afterAll(async () => {
  expect(await deleteE2eTestGameVersionRecords()).toBe(0);
});

function trigger(page: Page) {
  return page.getByRole("button", {
    name: "Choose release date",
    exact: true,
  });
}

function calendar(page: Page) {
  return page.getByRole("dialog", {
    name: "Choose release date",
    exact: true,
  });
}

test("keyboard date selection marks dirty, restores its draft, and persists without a date shift", async ({
  page,
}) => {
  await page.goto("/admin/settings/game-versions");
  await trigger(page).click();
  const dialog = calendar(page);
  await expect(dialog).toBeVisible();

  await dialog.getByLabel("Choose the Year").selectOption({ label: "2026" });
  await dialog.getByLabel("Choose the Month").selectOption({ label: "July" });
  const firstDay = dialog.getByRole("button", {
    name: /July 1st, 2026$/,
  });
  await firstDay.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");

  await expect(dialog).toHaveCount(0);
  await expect(trigger(page)).toBeFocused();
  await expect(page.getByLabel(/^Release date/)).toHaveValue("02 Jul 2026");
  await expect(page.getByText("Unsaved changes", { exact: true })).toBeVisible();

  await page.waitForTimeout(600);
  await page.reload();
  const recovery = page.getByRole("dialog").filter({
    has: page.getByRole("heading", { name: "Restore unsaved draft?" }),
  });
  await expect(recovery).toBeVisible();
  await recovery
    .getByRole("button", { name: "Restore draft", exact: true })
    .click();
  await expect(page.getByLabel(/^Release date/)).toHaveValue("02 Jul 2026");

  await page.getByLabel("Name", { exact: true }).fill(VERSION_NAME);
  await page.keyboard.press("Control+s");
  await expect(page).toHaveURL(
    "/admin/settings/game-versions?success=created"
  );
  const row = page.getByRole("row").filter({
    has: page.getByRole("cell", { name: VERSION_NAME, exact: true }),
  });
  await expect(
    row.getByRole("cell", { name: "02 Jul 2026", exact: true })
  ).toBeVisible();
});

test("trigger keyboard, month navigation, Escape, outside close, and portalled positioning remain accessible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1000, height: 900 });
  await page.goto("/admin/settings/game-versions");

  await trigger(page).focus();
  await page.keyboard.press("Enter");
  await expect(calendar(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(calendar(page)).toHaveCount(0);
  await expect(trigger(page)).toBeFocused();

  await page.keyboard.press("Space");
  await expect(calendar(page)).toBeVisible();
  await calendar(page)
    .getByRole("button", { name: /next month/i })
    .click();
  await page.locator("body").click({ position: { x: 4, y: 4 } });
  await expect(calendar(page)).toHaveCount(0);
  await expect(trigger(page)).toBeFocused();

  await page.setViewportSize({ width: 768, height: 520 });
  await page.getByLabel(/^Release date/).evaluate((element) =>
    element.scrollIntoView({ block: "end" })
  );
  await trigger(page).click();
  const popover = page.locator(".admin-date-popover");
  await expect(popover).toHaveAttribute("data-ready", "true");
  await expect(popover).toHaveAttribute("data-placement", "above");

  const geometry = await popover.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      documentOverflow:
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    };
  });
  expect(geometry.left).toBeGreaterThanOrEqual(0);
  expect(geometry.top).toBeGreaterThanOrEqual(0);
  expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth);
  expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewportHeight);
  expect(geometry.documentOverflow).toBe(false);
});
