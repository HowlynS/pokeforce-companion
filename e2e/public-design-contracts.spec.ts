import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { PUBLIC_DESIGN_ACCEPTANCE_MATRIX } from "../src/lib/public-design/acceptance";
import {
  getPublicDesignContract,
  resolvePublicDesignRoute,
} from "../src/lib/public-design/contracts";
import { getPublicDesignFixture } from "../src/lib/public-design/fixtures";
import { getPublicDesignViewport } from "../src/lib/public-design/viewports";

const SCREENSHOT_DIRECTORY = path.join(
  process.cwd(),
  "test-results",
  "public-design-smoke"
);

async function expectNoHorizontalOverflow(page: Page, label: string) {
  const metrics = await page.evaluate(() => {
    const clientWidth = document.documentElement.clientWidth;
    const scrollWidth = document.documentElement.scrollWidth;
    const widest = Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          element: element.tagName.toLowerCase(),
          className:
            typeof element.className === "string" ? element.className : "",
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        };
      })
      .filter(({ left, right }) => left < -1 || right > clientWidth + 1)
      .sort((first, second) => second.width - first.width)
      .slice(0, 5);
    return { clientWidth, scrollWidth, widest };
  });

  expect(
    metrics.scrollWidth,
    `${label} overflowed ${metrics.clientWidth}px: ${JSON.stringify(metrics.widest)}`
  ).toBeLessThanOrEqual(metrics.clientWidth);
}

test("shared shell and Appearance variants preserve public semantics", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/");

  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  // Locations and Shops moved under the World dropdown (Slice 2 of the
  // Claude Design redesign) — see world-menu.tsx — so they're real links
  // only once the dropdown is open, not flat top-level links.
  await expect(navigation.getByRole("link")).toHaveText([
    "Items",
    "Recipes",
    "Professions",
    "Classes",
  ]);
  const worldTrigger = navigation.getByRole("button", { name: "World" });
  await expect(worldTrigger).toHaveAttribute("aria-expanded", "false");
  await worldTrigger.click();
  // World menu items carry a label plus a description span (e.g.
  // "LocationsCities, routes & landmarks" as concatenated text content),
  // so this checks count + individual accessible names rather than an
  // exact full-text array like the flat links above.
  await expect(navigation.getByRole("link")).toHaveCount(6);
  await expect(
    navigation.getByRole("link", { name: "Locations", exact: false })
  ).toHaveAttribute("href", "/locations");
  await expect(
    navigation.getByRole("link", { name: "Shops", exact: false })
  ).toHaveAttribute("href", "/shops");
  await worldTrigger.click();
  await expect(worldTrigger).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("search", { name: "Site search" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Merchants Codex home" })
  ).toBeVisible();
  expect(
    await page
      .getByRole("img", { name: "Merchants Codex" })
      .evaluate((image: HTMLImageElement) => image.naturalWidth)
  ).toBeGreaterThan(0);
  await expect(page.getByRole("contentinfo")).toContainText(
    "crafting wiki companion"
  );

  // The World dropdown clicks above are real mouse interactions, which
  // sets the browser's input modality to mouse — a bare script .focus()
  // after that correctly shows no visible ring under that modality, per
  // browser :focus-visible heuristics. A real key press re-establishes
  // keyboard modality first, matching the working pattern in
  // public-navigation.spec.ts's own keyboard-focus coverage.
  const firstNavLink = navigation.getByRole("link", { name: "Items" });
  await firstNavLink.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(firstNavLink).toBeFocused();
  await expect(firstNavLink).not.toHaveCSS("outline-style", "none");

  const appearanceCases = [
    { route: "/", selector: ".public-scenic-background--home" },
    { route: "/items", selector: ".public-scenic-background--catalogue" },
    {
      route: "/items/design-review-item-dense",
      selector: ".public-scenic-background--detail",
    },
  ] as const;
  for (const entry of appearanceCases) {
    await page.goto(entry.route);
    const scenic = page.locator(entry.selector);
    await expect(scenic).toHaveCount(1);
    await expect(scenic).toHaveAttribute("aria-hidden", "true");
    await expect(scenic).not.toHaveCSS("background-image", "none");
    expect(
      await scenic.evaluate((element) =>
        getComputedStyle(element)
          .getPropertyValue("--public-scenic-position-desktop")
          .trim()
      )
    ).toMatch(/^\d+(?:\.\d+)?% \d+(?:\.\d+)?%$/);
  }

  await page.goto("/recipes");
  await expect(page.locator(".public-scenic-background")).toHaveCount(0);
});

test("fixture content preserves rich text, image, relationship, and hide-empty contracts", async ({
  page,
}) => {
  await page.goto("/items/design-review-item-dense");
  const richText = page.locator(".rich-text-content");
  await expect(
    richText.getByRole("heading", { level: 2, name: "Design review section" })
  ).toBeVisible();
  await expect(
    richText.getByRole("heading", { level: 3, name: "Links and list" })
  ).toBeVisible();
  await expect(richText.locator("strong")).toContainText("Bold");
  await expect(richText.locator("em")).toContainText("italic");
  await expect(richText.locator("u")).toContainText("underlined");
  await expect(richText.locator("ul > li")).toHaveCount(3);
  await expect(
    richText.getByRole("link", { name: "Canonical Item link" })
  ).toHaveAttribute("href", "/items/design-review-item-dense");
  await expect(
    richText.getByRole("link", { name: "Safe external link" })
  ).toHaveAttribute("rel", "noopener noreferrer");
  const deletedTarget = richText.getByRole("link", {
    name: "Deleted target fallback",
  });
  await expect(deletedTarget).toHaveAttribute(
    "href",
    "/items/design-review-deleted-target"
  );
  const missingResponse = await page.goto(
    "/items/design-review-deleted-target"
  );
  expect(missingResponse?.status()).toBe(404);
  await expect(page.locator("h1")).toHaveCount(1);

  await page.goto("/items/design-review-item-no-image-long-name");
  await expect(page.locator(".item-description")).toHaveCount(0);
  await expect(
    page.locator(".public-sprite-stage--hero").getByText("No image available")
  ).toBeVisible();
  await expect(page.getByText("Unverified", { exact: true })).toBeVisible();

  await page.goto("/recipes/design-review-recipe-many-ingredients");
  await expect(page.locator(".recipe-ingredient-row")).toHaveCount(6);
  await expect(page.getByText("999", { exact: true })).toBeVisible();
  await expect(page.getByText("50000 EXP", { exact: true })).toBeVisible();
  await expect(page.locator(".recipe-identity-stage img")).toHaveCount(1);
  await expect(page.locator(".recipe-result-image-stage img")).toHaveCount(1);

  await page.goto("/shops/design-review-shop-sparse");
  await expect(page.getByRole("heading", { name: "Inventory" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Verification" })).toHaveCount(
    0
  );
});

test("catalogue filters and explicit no-result states remain canonical", async ({
  page,
}) => {
  await page.goto("/items?category=design-review-invalid-filter");
  await expect(page).toHaveURL(/\/items$/);
  await expect(
    page.getByRole("navigation", { name: "Filter Items by Category" })
  ).toBeVisible();

  await page.goto("/shops?q=Design%20Review%20No%20Matches");
  await expect(
    page.getByRole("heading", { name: "No matching shops" })
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Show all Shops" })).toHaveAttribute(
    "href",
    "/shops"
  );

  await page.goto("/search?q=Design%20Review%20No%20Matches");
  await expect(page.getByRole("heading", { name: "No results" })).toBeVisible();
  await expect(page.getByText(/No items, recipes.+matched/)).toBeVisible();
  await expect(page.locator("h1")).toHaveCount(1);
});

test("every representative contract is semantic and overflow-free at primary viewports", async ({
  page,
}) => {
  test.setTimeout(0);
  fs.mkdirSync(SCREENSHOT_DIRECTORY, { recursive: true });

  for (const acceptance of PUBLIC_DESIGN_ACCEPTANCE_MATRIX) {
    const contract = getPublicDesignContract(acceptance.contractId);
    const fixture = getPublicDesignFixture(acceptance.fixtureKey);
    const viewport = getPublicDesignViewport(acceptance.viewportId);
    if (!contract || !fixture || !viewport) {
      throw new Error(`Incomplete acceptance entry: ${acceptance.id}`);
    }

    const pageErrors: string[] = [];
    const onPageError = (error: Error) => pageErrors.push(error.message);
    page.on("pageerror", onPageError);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const route = resolvePublicDesignRoute(contract, fixture);
    const response = await page.goto(route, { waitUntil: "domcontentloaded" });
    const expectedStatus = contract.id === "not-found" ? 404 : 200;
    expect(response?.status(), acceptance.id).toBe(expectedStatus);
    await expect(page.locator("h1"), acceptance.id).toHaveCount(1);
    await expect(page.locator("h1"), acceptance.id).toBeVisible();
    await expect(page.locator("main"), acceptance.id).toBeVisible();
    await expect(page.locator("footer"), acceptance.id).toBeVisible();
    await expect(
      page.locator("a a, a button, button a, button button"),
      `${acceptance.id} must not nest interactive controls`
    ).toHaveCount(0);
    await expectNoHorizontalOverflow(page, acceptance.id);
    expect(pageErrors, `${acceptance.id} page errors`).toEqual([]);
    page.off("pageerror", onPageError);

    if (
      acceptance.id === "item-detail--item-dense--desktop-1920" ||
      acceptance.id === "search--search-results--mobile-390"
    ) {
      await page.screenshot({
        path: path.join(SCREENSHOT_DIRECTORY, `${acceptance.id}.png`),
        fullPage: true,
        animations: "disabled",
        style: "nextjs-portal { display: none !important; }",
      });
    }
  }
});

test("Design review remains protected from unauthenticated public sessions", async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: "http://localhost:3100",
    storageState: { cookies: [], origins: [] },
  });
  const page = await context.newPage();
  await page.goto("/admin/design-review");
  // Under PUBLIC site visibility (the baseline the rest of this public
  // E2E suite requires), the proxy's private-beta gate is inactive, so
  // the redirect comes from the deeper admin.access permission check
  // instead (requireAdminUser -> requirePermission, which does not carry
  // a returnTo) — plain /login, not /login?next=. The property under
  // test — an anonymous session cannot reach /admin/design-review —
  // still holds either way.
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Private beta sign-in" })
  ).toBeVisible();
  await context.close();
});
