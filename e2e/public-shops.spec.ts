import { expect, test, type Page } from "@playwright/test";
import {
  countE2eTestShopRecords,
  createE2ePublicShopFixtures,
  deleteE2eTestShopRecords,
} from "./helpers/database-cleanup";
import { requireSiteVisibility } from "./helpers/site-visibility";

// Anonymous public browsing is only reachable under PUBLIC visibility, so
// this spec establishes it rather than inheriting whatever mode the
// previously-run spec happened to leave behind.
requireSiteVisibility("PUBLIC");

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
  expect(await countE2eTestShopRecords()).toBe(3);
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
  // The 52px catalogue stage uses the compact row fallback (shared with the
  // Locations directory); "No image available" remains its accessible name.
  await expect(
    shopCard.getByLabel("No image available")
  ).toBeVisible();

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

  // Shop detail carries its own wine/rose resource-atmosphere wash,
  // deliberately separated from Recipe's amber and Class's crimson.
  const atmosphere = page.locator(".resource-atmosphere--shop");
  await expect(atmosphere).toHaveCount(1);
  const atmosphereImage = await atmosphere.evaluate((element) =>
    getComputedStyle(element)
      .getPropertyValue("--resource-atmosphere-image")
      .trim()
  );
  expect(atmosphereImage).not.toBe("none");
  expect(atmosphereImage).not.toBe("");

  await expect(
    page.getByRole("heading", { level: 2, name: "Inventory", exact: true })
  ).toBeVisible();
  const rows = page.locator(".public-shop-listing");
  await expect(rows).toHaveCount(2);
  const secondPreview = rows
    .nth(1)
    .getByRole("button", { name: `Preview ${fixtures.item.name}` });
  await expect(secondPreview).toHaveAttribute("aria-pressed", "false");
  await secondPreview.click();
  await expect(secondPreview).toHaveAttribute("aria-pressed", "true");
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
  // The item name itself is no longer a link: a row click only ever selects.
  // Navigation is the explicit page-link arrow beside the name.
  await expect(
    rows.nth(0).getByRole("link", { name: fixtures.item.name, exact: true })
  ).toHaveCount(0);
  await expect(
    rows
      .nth(0)
      .getByRole("link", { name: `Open ${fixtures.item.name} item page` })
  ).toHaveAttribute("href", `/items/${fixtures.item.slug}`);

  const inventoryToggle = page.getByRole("button", {
    name: "Inventory",
    exact: true,
  });
  await inventoryToggle.click();
  await expect(rows).toHaveCount(0);
  await inventoryToggle.click();
  await expect(rows).toHaveCount(2);

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

test("Item acquisition presents every structured purchase and preserves the legacy Shop source", async ({
  page,
}) => {
  await page.goto(`/items/${fixtures.item.slug}`);

  const obtainHeading = page.getByRole("heading", {
    level: 2,
    name: "How to obtain",
    exact: true,
  });
  await expect(obtainHeading).toBeVisible();
  const obtainSection = obtainHeading.locator("..");
  const purchases = obtainSection.locator(".item-shop-row");

  await expect(purchases).toHaveCount(3);
  await expect(
    purchases.nth(0).getByRole("link", { name: fixtures.shop.name, exact: true })
  ).toHaveAttribute("href", `/shops/${fixtures.shop.slug}`);
  await expect(
    purchases
      .nth(0)
      .getByRole("link", { name: fixtures.location.name, exact: true })
  ).toHaveAttribute("href", `/locations/${fixtures.location.slug}`);
  await expect(purchases.nth(0).locator(".currency-price")).toContainText("1,250");
  await expect(purchases.nth(0).locator(".currency-price")).toHaveAttribute(
    "aria-label",
    new RegExp(`1,250 ${fixtures.primaryCurrency.name}`)
  );
  await expect(purchases.nth(0)).toContainText("Available after the tutorial.");

  await expect(
    purchases.nth(1).getByRole("link", { name: fixtures.shop.name, exact: true })
  ).toBeVisible();
  await expect(purchases.nth(1).locator(".currency-price")).toContainText(
    "2,147,483,647"
  );
  await expect(purchases.nth(1)).not.toContainText("Verified for");
  await expect(
    purchases
      .nth(2)
      .getByRole("link", { name: fixtures.secondShop.name, exact: true })
  ).toHaveAttribute("href", `/shops/${fixtures.secondShop.slug}`);
  await expect(purchases.nth(2).locator(".currency-price")).toContainText("750");

  // A Currency icon in a public price is artwork beside an amount, not a
  // record thumbnail: it must carry none of the shared ResourceIcon's admin
  // frame, which read as a placeholder box drawn around the rune.
  const currencyIcons = obtainSection.locator(".currency-price .resource-icon");
  for (let index = 0; index < (await currencyIcons.count()); index += 1) {
    const framing = await currencyIcons.nth(index).evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        borderWidth: style.borderTopWidth,
        backgroundColor: style.backgroundColor,
        backgroundImage: style.backgroundImage,
      };
    });
    expect(framing.borderWidth).toBe("0px");
    expect(framing.backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(framing.backgroundImage).toBe("none");
  }

  // No explicit relationship marks the free-text row as equivalent to a
  // ShopListing, so the legacy source remains visible instead of being
  // silently guessed away.
  await expect(obtainSection.getByText("NPC or shop", { exact: true })).toBeVisible();
  await expect(obtainSection).toContainText("Legacy Traveling Merchant");
  await expect(obtainSection).toContainText(
    "Legacy source retained alongside structured sales."
  );

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

test("Location detail summarizes only directly assigned Shops and hides an empty section", async ({
  page,
}) => {
  await page.goto(`/locations/${fixtures.location.slug}`);

  const shopHeading = page.getByRole("heading", {
    level: 2,
    name: "Shops",
    exact: true,
  });
  await expect(shopHeading).toBeVisible();
  const shopSection = shopHeading.locator("..");
  await expect(cardLink(page, fixtures.shop.name)).toHaveAttribute(
    "href",
    `/shops/${fixtures.shop.slug}`
  );
  await expect(cardLink(page, fixtures.shop.name)).toContainText(
    "2 inventory listings"
  );
  await expect(cardLink(page, fixtures.shop.name)).toContainText(
    "A documented public Shop used only by browser tests."
  );
  await expect(cardLink(page, fixtures.emptyShop.name)).toContainText(
    "0 inventory listings"
  );
  await expect(shopSection).not.toContainText(fixtures.secondShop.name);

  // The Region owns Beta directly. It must not also aggregate Alpha/Empty
  // merely because their Location is a descendant.
  await page.goto(`/locations/${fixtures.region.slug}`);
  const regionShopSection = page
    .getByRole("heading", { level: 2, name: "Shops", exact: true })
    .locator("..");
  await expect(regionShopSection).toContainText(fixtures.secondShop.name);
  await expect(regionShopSection).not.toContainText(fixtures.shop.name);
  await expect(regionShopSection).not.toContainText(fixtures.emptyShop.name);

  await page.goto(`/locations/${fixtures.emptyLocation.slug}`);
  await expect(
    page.getByRole("heading", { level: 2, name: "Shops", exact: true })
  ).toHaveCount(0);
  await expect(page.getByText("No shops")).toHaveCount(0);

  await page.goto(`/locations/${fixtures.location.slug}`);
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
