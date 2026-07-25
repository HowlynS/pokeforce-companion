import { expect, test, type Page } from "@playwright/test";
import {
  countE2eTestShopRecords,
  createE2ePublicShopFixtures,
  deleteE2eTestShopRecords,
} from "./helpers/database-cleanup";

let fixtures: Awaited<ReturnType<typeof createE2ePublicShopFixtures>>;
let pageErrors: string[] = [];

function cardLink(page: Page, name: string) {
  return page
    .getByRole("link")
    .filter({ has: page.getByRole("heading", { level: 3, name, exact: true }) });
}

test.beforeAll(async () => {
  await deleteE2eTestShopRecords();
  fixtures = await createE2ePublicShopFixtures();
  expect(await countE2eTestShopRecords()).toBe(2);
});

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(() => {
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

test.afterAll(async () => {
  await deleteE2eTestShopRecords();
  expect(await countE2eTestShopRecords()).toBe(0);
});

test("the public Shop list presents location, Inventory count, verification, and search", async ({
  page,
}) => {
  await page.goto("/shops");

  await expect(page).toHaveTitle("Shops | PokeForce Companion");
  await expect(
    page.getByRole("heading", { level: 1, name: "Shops", exact: true })
  ).toBeVisible();
  const shopCard = cardLink(page, fixtures.shop.name);
  await expect(shopCard).toHaveAttribute("href", `/shops/${fixtures.shop.slug}`);
  await expect(shopCard).toContainText(fixtures.location.name);
  await expect(shopCard).toContainText("2 inventory listings");
  await expect(shopCard).toContainText(
    "Verified for test-gv-current on 25 Jul 2026"
  );
  await expect(shopCard.getByText("No image available")).toBeVisible();

  const shopSearch = page
    .getByRole("search", { name: "Search shops" })
    .getByRole("searchbox", { name: "Search shops" });
  await shopSearch.fill("public shop empty");
  await page
    .getByRole("search", { name: "Search shops" })
    .getByRole("button", { name: "Search Shops", exact: true })
    .click();
  await expect(page).toHaveURL("/shops?q=public+shop+empty");
  await expect(cardLink(page, fixtures.emptyShop.name)).toBeVisible();
  await expect(cardLink(page, fixtures.shop.name)).toHaveCount(0);
  await expect(
    page.getByText('Showing 1 shop matching "public shop empty".')
  ).toBeVisible();

  await page.getByRole("link", { name: "Clear", exact: true }).click();
  await expect(page).toHaveURL("/shops");
  await expect(cardLink(page, fixtures.shop.name)).toBeVisible();

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
});

test("the Shop detail renders hierarchy, independent verification, ordered prices, and hide-empty notes", async ({
  page,
}) => {
  await page.goto(`/shops/${fixtures.shop.slug}`);

  await expect(page).toHaveTitle(
    `${fixtures.shop.name} | Shops | PokeForce Companion`
  );
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: fixtures.shop.name,
      exact: true,
    })
  ).toBeVisible();

  const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
  await expect(
    breadcrumb.getByRole("link", { name: "Shops", exact: true })
  ).toHaveAttribute("href", "/shops");
  await expect(
    breadcrumb.getByRole("link", { name: fixtures.region.name, exact: true })
  ).toHaveAttribute("href", `/locations/${fixtures.region.slug}`);
  await expect(
    breadcrumb.getByRole("link", { name: fixtures.location.name, exact: true })
  ).toHaveAttribute("href", `/locations/${fixtures.location.slug}`);
  await expect(breadcrumb.getByText(fixtures.shop.name, { exact: true })).toHaveAttribute(
    "aria-current",
    "page"
  );

  const locationCard = cardLink(page, "Location");
  await expect(locationCard).toHaveAttribute(
    "href",
    `/locations/${fixtures.location.slug}`
  );
  await expect(locationCard).toContainText(fixtures.location.name);
  await expect(page.locator(".detail-hero")).toContainText(
    "Verified for test-gv-current on 25 Jul 2026"
  );

  await expect(
    page.getByRole("heading", { level: 2, name: "Inventory", exact: true })
  ).toBeVisible();
  const rows = page.locator(".public-shop-listing");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText(fixtures.item.name);
  await expect(rows.nth(0).getByLabel(`₽ 1,250 ${fixtures.primaryCurrency.name}`))
    .toHaveText("₽ 1,250");
  await expect(rows.nth(0)).toContainText("Available after the tutorial.");
  await expect(rows.nth(0)).toContainText(
    "Verified for test-gv-current on 25 Jul 2026"
  );

  await expect(
    rows
      .nth(1)
      .getByLabel(`2,147,483,647 ${fixtures.alternateCurrency.name}`)
  ).toHaveText(`2,147,483,647 ${fixtures.alternateCurrency.name}`);
  await expect(rows.nth(1)).not.toContainText("Available after the tutorial.");
  await expect(rows.nth(1)).not.toContainText("Verified for");
  await expect(
    rows.nth(0).getByRole("link", { name: fixtures.item.name, exact: true })
  ).toHaveAttribute("href", `/items/${fixtures.item.slug}`);

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
});

test("a Shop with no optional content omits Inventory and verification sections", async ({
  page,
}) => {
  await page.goto(`/shops/${fixtures.emptyShop.slug}`);

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: fixtures.emptyShop.name,
      exact: true,
    })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Inventory", exact: true })
  ).toHaveCount(0);
  await expect(page.getByText("No inventory")).toHaveCount(0);
  await expect(page.getByText("Verification", { exact: true })).toHaveCount(0);
  await expect(page.getByText("No description")).toHaveCount(0);
});

test("Shop detail handles an unknown slug as a real 404", async ({ page }) => {
  const response = await page.goto("/shops/test-e2e-missing-shop");

  expect(response?.status()).toBe(404);
  await expect(page.getByText("This page could not be found.")).toBeVisible();
});

test("global search includes Shops and links to their public detail pages", async ({
  page,
}) => {
  await page.goto("/search?q=public+shop+alpha");

  await expect(
    page.getByRole("heading", { level: 2, name: "Shops (1)", exact: true })
  ).toBeVisible();
  await expect(cardLink(page, fixtures.shop.name)).toHaveAttribute(
    "href",
    `/shops/${fixtures.shop.slug}`
  );
});
