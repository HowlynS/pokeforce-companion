import { expect, test, type Page } from "@playwright/test";
import { requireSiteVisibility } from "./helpers/site-visibility";

// The header quick search is anonymous public browsing.
requireSiteVisibility("PUBLIC");

let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(() => {
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

function field(page: Page) {
  return page.getByRole("combobox", { name: "Search query" });
}

function panel(page: Page) {
  return page.getByRole("listbox", { name: "Search suggestions" });
}

test("typing in the header opens a grouped suggestion panel", async ({ page }) => {
  await page.goto("/");

  await field(page).fill("copper");

  await expect(panel(page)).toBeVisible();
  await expect(field(page)).toHaveAttribute("aria-expanded", "true");

  // Groups are labelled by resource and only appear when they have matches.
  await expect(panel(page).getByRole("group", { name: "Items" })).toBeVisible();
  await expect(
    panel(page).getByRole("option", { name: /Copper Ore/ })
  ).toBeVisible();
  await expect(
    panel(page).getByRole("group", { name: "Professions" })
  ).toHaveCount(0);

  // Compact by design: a handful of suggestions plus the "View all" escape.
  const optionCount = await panel(page).getByRole("option").count();
  expect(optionCount).toBeGreaterThan(1);
  expect(optionCount).toBeLessThanOrEqual(8);

  // The catalogue page below is NOT filtered by the header field.
  await expect(page).toHaveURL("/");
});

test("a one-character query never opens the panel", async ({ page }) => {
  await page.goto("/");

  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/search/suggestions")) {
      requests.push(request.url());
    }
  });

  await field(page).fill("c");
  await expect(panel(page)).toHaveCount(0);
  await expect(field(page)).toHaveAttribute("aria-expanded", "false");

  // Nor is the endpoint hammered below the threshold.
  await page.waitForTimeout(400);
  expect(requests).toEqual([]);

  await field(page).fill("co");
  await expect(panel(page)).toBeVisible();
  expect(requests.length).toBeGreaterThan(0);
});

test("the panel is keyboard operable end to end", async ({ page }) => {
  await page.goto("/");

  const input = field(page);
  await input.fill("copper");
  await expect(panel(page)).toBeVisible();
  // Nothing is active until the visitor arrows into the list.
  await expect(input).not.toHaveAttribute("aria-activedescendant", /./);

  await input.press("ArrowDown");
  const firstOption = panel(page).getByRole("option").first();
  await expect(firstOption).toHaveAttribute("aria-selected", "true");
  const firstId = await firstOption.getAttribute("id");
  await expect(input).toHaveAttribute("aria-activedescendant", firstId!);

  await input.press("ArrowDown");
  await expect(firstOption).toHaveAttribute("aria-selected", "false");
  await expect(panel(page).getByRole("option").nth(1)).toHaveAttribute(
    "aria-selected",
    "true"
  );

  // Up returns to the first option, and Enter opens it.
  await input.press("ArrowUp");
  await expect(firstOption).toHaveAttribute("aria-selected", "true");
  const href = await firstOption.getAttribute("href");
  await input.press("Enter");
  await expect(page).toHaveURL(href!);
});

test("Escape closes the panel and outside clicks close it", async ({ page }) => {
  await page.goto("/");

  const input = field(page);
  await input.fill("copper");
  await expect(panel(page)).toBeVisible();

  await input.press("Escape");
  await expect(panel(page)).toHaveCount(0);
  // Escape closes the panel without discarding what was typed.
  await expect(input).toHaveValue("copper");

  // Refocusing a populated field can offer the same suggestions again.
  await input.click();
  await expect(panel(page)).toBeVisible();

  await page.getByRole("heading", { level: 1 }).first().click();
  await expect(panel(page)).toHaveCount(0);
});

test("clicking a suggestion goes straight to its canonical page", async ({
  page,
}) => {
  await page.goto("/");

  await field(page).fill("copper ore");
  const option = panel(page).getByRole("option", { name: /Copper Ore/ }).first();
  await expect(option).toBeVisible();
  await option.click();

  await expect(page).toHaveURL("/items/copper-ore");
  await expect(
    page.getByRole("heading", { level: 1, name: "Copper Ore" })
  ).toBeVisible();
});

test("View all and a plain Enter both fall back to /search", async ({ page }) => {
  await page.goto("/");

  await field(page).fill("copper");
  await panel(page)
    .getByRole("option", { name: /View all results/ })
    .click();
  await expect(page).toHaveURL("/search?q=copper");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // With no suggestion highlighted, Enter submits the form to the same place.
  await page.goto("/");
  await field(page).fill("copper");
  await expect(panel(page)).toBeVisible();
  await field(page).press("Enter");
  await expect(page).toHaveURL(/\/search\?q=copper/);
});

test("a query with no matches shows no panel", async ({ page }) => {
  await page.goto("/");

  await field(page).fill("zzzz-no-such-record");
  await page.waitForTimeout(400);

  await expect(panel(page)).toHaveCount(0);
  await expect(field(page)).toHaveAttribute("aria-expanded", "false");
});

test("a slow earlier response never overwrites the newest query", async ({
  page,
}) => {
  await page.goto("/");

  // Hold the response for the short query until after the longer one has been
  // typed, then release it: the panel must still describe the newest query.
  let releaseStale = () => {};
  const stalePending = new Promise<void>((resolve) => {
    releaseStale = resolve;
  });

  await page.route("**/api/search/suggestions**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("q") === "co") {
      await stalePending;
    }
    await route.continue();
  });

  const input = field(page);
  await input.fill("co");
  await input.fill("copper ore");
  await expect(panel(page)).toBeVisible();
  await expect(
    panel(page).getByRole("option", { name: "Copper Ore", exact: true })
  ).toBeVisible();
  const newestOptions = await panel(page).getByRole("option").allInnerTexts();

  releaseStale();
  await page.waitForTimeout(400);

  // The late response for "co" is discarded: the panel still describes the
  // query the visitor actually typed.
  expect(await panel(page).getByRole("option").allInnerTexts()).toEqual(
    newestOptions
  );
  await expect(input).toHaveValue("copper ore");
});

test("under reduced motion the panel appears with no animation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  await field(page).fill("copper");
  await expect(panel(page)).toBeVisible();

  expect(
    await panel(page).evaluate((node) => node.getAnimations().length)
  ).toBe(0);

  // Interaction is unchanged.
  await field(page).press("ArrowDown");
  await expect(panel(page).getByRole("option").first()).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await field(page).press("Escape");
  await expect(panel(page)).toHaveCount(0);
});
