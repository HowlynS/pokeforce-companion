import { expect, test } from "@playwright/test";
import {
  countE2eTestCurrencyRecords,
  deleteE2eTestCurrencyRecords,
} from "./helpers/database-cleanup";

const INITIAL = {
  name: "Test E2E Currency",
  slug: "test-e2e-currency",
  symbol: "TC",
  description: "Created by the Currency admin browser test.",
} as const;

const EDITED = {
  name: "Test E2E Currency Updated",
  slug: "test-e2e-currency-updated",
  symbol: "T₽",
  description: "Updated in place by the Currency admin browser test.",
} as const;

test.beforeAll(async () => {
  await deleteE2eTestCurrencyRecords();
  expect(await countE2eTestCurrencyRecords()).toBe(0);
});

test.afterEach(async () => {
  await deleteE2eTestCurrencyRecords();
});

test.afterAll(async () => {
  expect(await deleteE2eTestCurrencyRecords()).toBe(0);
});

test("Currency admin lifecycle uses the shared protected workspace", async ({
  page,
}) => {
  await page.goto("/admin/settings/currencies");
  await expect(page).toHaveURL("/admin/settings/currencies");
  await expect(
    page.getByRole("heading", { level: 1, name: "Currency Management" })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Currencies", exact: true })
  ).toHaveAttribute("aria-current", "page");

  await page.getByRole("link", { name: "+ New", exact: true }).click();
  await expect(page).toHaveURL("/admin/settings/currencies/new");

  await page.getByLabel("Name", { exact: true }).fill(INITIAL.name);
  await page.getByLabel(/^Page address/).fill(INITIAL.slug);
  await page.getByLabel(/^Symbol/).fill(INITIAL.symbol);
  await page.getByLabel(/^Description/).fill(INITIAL.description);
  await page.locator('input[type="file"]').setInputFiles(
    "e2e/fixtures/tiny-valid.png"
  );
  await page
    .getByRole("button", { name: /Create Currency/ })
    .click();

  await expect(page).toHaveURL(
    `/admin/settings/currencies/${INITIAL.slug}/edit`
  );
  await expect(page.getByRole("status")).toHaveText("Currency created");
  await expect(
    page.getByRole("heading", { level: 2, name: "Image", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Verification", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Timestamps", exact: true })
  ).toBeVisible();
  const persistedImage = page.getByAltText(`Current image for ${INITIAL.name}`);
  await expect(persistedImage).toBeVisible();

  await page.getByLabel("Name", { exact: true }).fill(EDITED.name);
  await page.getByLabel(/^Page address/).fill(EDITED.slug);
  await page.getByLabel(/^Symbol/).fill(EDITED.symbol);
  await page.getByLabel(/^Description/).fill(EDITED.description);
  await page.getByLabel("Remove image").click();
  await expect(persistedImage).toBeVisible();
  await expect(persistedImage).toHaveClass(/pending-removal/);
  await page.getByRole("button", { name: /Save Changes/ }).click();

  await expect(page).toHaveURL(
    `/admin/settings/currencies/${EDITED.slug}/edit`
  );
  await expect(page.getByRole("status")).toHaveText("Currency saved");
  await expect(page.getByLabel(/^Symbol/)).toHaveValue(EDITED.symbol);
  await expect(page.getByText("No image uploaded.")).toBeVisible();

  for (const viewport of [
    { width: 1920, height: 1080, label: "1920x1080" },
    { width: 3440, height: 1440, label: "3440x1440" },
  ]) {
    await page.setViewportSize(viewport);
    await page.reload();
    const widths = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(widths.content).toBeLessThanOrEqual(widths.viewport);
  }

  await page
    .getByRole("button", { name: "Delete Currency", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Delete Currency" });
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", { name: "Delete Permanently", exact: true })
    .click();

  await expect(page).toHaveURL("/admin/settings/currencies");
  await expect(page.getByRole("status")).toHaveText("Currency deleted");
  expect(await countE2eTestCurrencyRecords()).toBe(0);
});
