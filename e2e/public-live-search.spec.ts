import { expect, test, type Page } from "@playwright/test";
import { requireSiteVisibility } from "./helpers/site-visibility";

// Live catalogue filtering is anonymous public browsing.
requireSiteVisibility("PUBLIC");

let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(() => {
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

/**
 * Marks the live document. Any full navigation or reload replaces the
 * document and loses the marker, so asserting it afterwards proves the page
 * filtered in place rather than round-tripping to the server.
 */
async function markDocument(page: Page) {
  await page.evaluate(() => {
    (window as unknown as { __liveSearchMarker?: boolean }).__liveSearchMarker =
      true;
  });
}

async function documentSurvived(page: Page) {
  return page.evaluate(
    () =>
      (window as unknown as { __liveSearchMarker?: boolean })
        .__liveSearchMarker === true,
  );
}

test("Items filter live, on the keystroke, without navigating", async ({
  page,
}) => {
  await page.goto("/items");

  const cards = page.locator(".item-catalogue-card");
  const totalCards = await cards.count();
  expect(totalCards).toBeGreaterThan(2);

  const search = page.getByRole("searchbox", {
    name: "Find an item by name...",
  });
  await markDocument(page);
  await search.click();

  // Typing character by character: results narrow before any Enter press.
  for (const chunk of ["c", "o", "p", "p", "e", "r"]) {
    await page.keyboard.type(chunk);
  }

  await expect(cards).toHaveCount(3); // Copper Ore, Copper Ingot, Copper Dagger
  await expect(page.getByRole("heading", { name: "Copper Ore" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Iron Ore", exact: true }),
  ).toHaveCount(0);

  // No navigation happened, and focus never left the field.
  expect(await documentSurvived(page)).toBe(true);
  await expect(search).toBeFocused();

  // The URL settles shortly afterwards, without a reload.
  await expect(page).toHaveURL(/[?&]q=copper/);
  expect(await documentSurvived(page)).toBe(true);

  // The overview panel's "Matching Now" figure tracks the live result set.
  await expect(page.locator(".directory-overview")).toContainText("Matching Now");

  // Clearing restores the full catalogue immediately.
  await search.fill("");
  await expect(cards).toHaveCount(totalCards);
  expect(await documentSurvived(page)).toBe(true);
});

test("an existing ?q= URL hydrates the field and the filtered results", async ({
  page,
}) => {
  await page.goto("/items?q=copper");

  await expect(
    page.getByRole("searchbox", { name: "Find an item by name..." }),
  ).toHaveValue("copper");
  await expect(page.locator(".item-catalogue-card")).toHaveCount(3);

  // Reloading preserves it — the query is real URL state, not just memory.
  await page.reload();
  await expect(page.locator(".item-catalogue-card")).toHaveCount(3);
});

test("a live filter with no matches shows the page's own empty state and recovers", async ({
  page,
}) => {
  await page.goto("/items");

  const search = page.getByRole("searchbox", {
    name: "Find an item by name...",
  });
  await search.fill("zzz-no-such-item");

  await expect(page.getByText("No items found")).toBeVisible();
  await expect(page.locator(".item-catalogue-card")).toHaveCount(0);

  // The empty state's own reset control clears the live filter in place.
  await markDocument(page);
  await page.getByRole("link", { name: "Reset filters" }).click();
  await expect(page.locator(".item-catalogue-card").first()).toBeVisible();
  await expect(search).toHaveValue("");
  expect(await documentSurvived(page)).toBe(true);
});

test("live filtering preserves the Grid/List selection", async ({ page }) => {
  await page.goto("/items");

  await page.getByRole("button", { name: "List", exact: true }).click();
  await expect(page.locator(".item-catalogue-list")).toBeVisible();

  await page
    .getByRole("searchbox", { name: "Find an item by name..." })
    .fill("copper");

  // Still List, still filtered — the toolbar never remounted.
  await expect(page.locator(".item-catalogue-list")).toBeVisible();
  await expect(page.locator(".item-catalogue-grid")).toHaveCount(0);
  await expect(page.locator(".item-catalogue-list-row")).toHaveCount(3);
  await expect(
    page.getByRole("button", { name: "List", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("Professions filter live", async ({ page }) => {
  await page.goto("/professions");

  const cards = page.locator(".profession-catalogue-card");
  await expect(cards).toHaveCount(10);

  await markDocument(page);
  await page
    .getByRole("searchbox", { name: "Find a profession by name..." })
    .fill("smith");

  await expect(cards).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Smithing" })).toBeVisible();
  expect(await documentSurvived(page)).toBe(true);
  await expect(page).toHaveURL(/[?&]q=smith/);
});

test("Classes filter live", async ({ page }) => {
  await page.goto("/classes");

  const cards = page.locator(".class-catalogue-card");
  await expect(cards).toHaveCount(5);

  await markDocument(page);
  await page
    .getByRole("searchbox", { name: "Find a class by name..." })
    .fill("ran");

  // "Rancher" and "Ranger" both contain the term; "Trainer" does not.
  await expect(cards).toHaveCount(2);
  await expect(page.getByRole("heading", { name: "Trainer" })).toHaveCount(0);
  expect(await documentSurvived(page)).toBe(true);
});

test("Recipes filter live", async ({ page }) => {
  await page.goto("/recipes");

  const cards = page.locator(".recipe-output-card");
  const total = await cards.count();
  expect(total).toBeGreaterThan(1);

  await markDocument(page);
  await page
    .getByRole("searchbox", { name: "Find a recipe by name..." })
    .fill("copper");

  await expect(cards).toHaveCount(2); // Copper Ingot, Copper Dagger
  expect(await documentSurvived(page)).toBe(true);
  await expect(page).toHaveURL(/[?&]q=copper/);
});

test("live filtering replaces history rather than flooding it", async ({
  page,
}) => {
  await page.goto("/items");
  await page.goto("/professions");

  await page
    .getByRole("searchbox", { name: "Find a profession by name..." })
    .fill("smith");
  await expect(page).toHaveURL(/[?&]q=smith/);

  // One entry for the whole search: Back returns to the PREVIOUS page, not to
  // "smit", "smi", "sm"…
  await page.goBack();
  await expect(page).toHaveURL(/\/items/);
});
