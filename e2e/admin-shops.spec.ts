import { expect, test } from "@playwright/test";
import { selectAdminOption } from "./helpers/admin-select";
import {
  countE2eTestShopRecords,
  createE2eShopLocation,
  deleteE2eTestShopRecords,
} from "./helpers/database-cleanup";

const INITIAL = {
  name: "Test E2E Shop",
  slug: "test-e2e-shop",
  description: "Created by the Shop admin browser test.",
} as const;

const EDITED = {
  name: "Test E2E Shop Updated",
  slug: "test-e2e-shop-updated",
  description: "Updated in place by the Shop admin browser test.",
} as const;

test.beforeAll(async () => {
  await deleteE2eTestShopRecords();
  await createE2eShopLocation();
  expect(await countE2eTestShopRecords()).toBe(0);
});

test.afterEach(async () => {
  await deleteE2eTestShopRecords();
});

test.afterAll(async () => {
  expect(await deleteE2eTestShopRecords()).toBe(0);
});

test("Shop admin lifecycle requires a Location and uses the shared workspace", async ({
  page,
}) => {
  const location = await createE2eShopLocation();
  await page.goto("/admin/shops");
  await expect(page).toHaveURL("/admin/shops");
  await expect(
    page.getByRole("heading", { level: 1, name: "Shop Management" })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Shops", exact: true })
  ).toHaveAttribute("aria-current", "page");

  await page.getByRole("link", { name: "+ New", exact: true }).click();
  await expect(page).toHaveURL("/admin/shops/new");
  await page.getByLabel("Name", { exact: true }).fill(INITIAL.name);
  await page.getByLabel(/^Page address/).fill(INITIAL.slug);
  await selectAdminOption(
    page.getByRole("combobox", { name: "Location", exact: true }),
    location.name
  );
  await page.getByLabel(/^Description/).fill(INITIAL.description);
  await page.getByRole("button", { name: /Create Shop/ }).click();

  await expect(page).toHaveURL(`/admin/shops/${INITIAL.slug}/edit`);
  await expect(page.getByRole("status")).toHaveText("Shop created");
  const tabs = page.getByRole("navigation", { name: "Shop editor sections" });
  await expect(
    tabs.getByRole("link", { name: "General", exact: true })
  ).toHaveAttribute("aria-current", "page");
  await expect(tabs.getByText("Inventory")).toHaveAttribute(
    "aria-disabled",
    "true"
  );

  await page.getByLabel("Name", { exact: true }).fill(EDITED.name);
  await page.getByLabel(/^Page address/).fill(EDITED.slug);
  await page.getByLabel(/^Description/).fill(EDITED.description);
  await page.getByRole("button", { name: /Save Changes/ }).click();

  await expect(page).toHaveURL(`/admin/shops/${EDITED.slug}/edit`);
  await expect(page.getByRole("status")).toHaveText("Shop saved");
  await expect(
    page.getByRole("combobox", { name: "Location", exact: true })
  ).toContainText(location.name);

  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 3440, height: 1440 },
  ]) {
    await page.setViewportSize(viewport);
    await page.reload();
    const widths = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(widths.content).toBeLessThanOrEqual(widths.viewport);
  }

  await page.getByRole("button", { name: "Delete Shop", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Delete Shop" });
  await dialog
    .getByRole("button", { name: "Delete Permanently", exact: true })
    .click();
  await expect(page).toHaveURL("/admin/shops");
  await expect(page.getByRole("status")).toHaveText("Shop deleted");
  expect(await countE2eTestShopRecords()).toBe(0);
});
