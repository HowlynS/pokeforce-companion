import { mkdir } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

const resources = [
  { name: "Items", href: "/items" },
  { name: "Recipes", href: "/recipes" },
  { name: "Professions", href: "/professions" },
  { name: "Locations", href: "/locations" },
  { name: "Shops", href: "/shops" },
] as const;

const viewports = [
  { width: 1920, height: 1080, expectedWidth: 1440, expectedSprite: 40 },
  { width: 2560, height: 1440, expectedWidth: 1600, expectedSprite: 52 },
  { width: 3440, height: 1440, expectedWidth: 1720, expectedSprite: 52 },
] as const;

let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(() => {
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

function resourceCard(page: Page, name: string) {
  return page
    .getByRole("link")
    .filter({ has: page.getByRole("heading", { level: 3, name, exact: true }) });
}

test("hero CTAs and all five resource cards use their approved routes", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("link", { name: "Browse Items", exact: true })
  ).toHaveAttribute("href", "/items");
  await expect(
    page.getByRole("link", { name: "Explore Recipes", exact: true })
  ).toHaveAttribute("href", "/recipes");

  for (const resource of resources) {
    await expect(resourceCard(page, resource.name)).toHaveAttribute(
      "href",
      resource.href
    );
  }

  await expect(
    page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "Categories", exact: true })
  ).toHaveCount(0);
  await expect(page.getByRole("contentinfo")).toContainText(
    "A crafting wiki companion for items, recipes, professions, classes, categories, locations, and shops."
  );

  await page.getByRole("link", { name: "Browse Items", exact: true }).click();
  await expect(page).toHaveURL("/items");
  await page.goBack();
  await page.getByRole("link", { name: "Explore Recipes", exact: true }).click();
  await expect(page).toHaveURL("/recipes");
});

test("server-rendered statistics expose all four real count categories", async ({
  page,
}) => {
  await page.goto("/");

  const statistics = page.locator(".landing-statistics");
  await expect(statistics).toHaveAttribute("aria-label", "Codex statistics");
  for (const label of ["Items", "Recipes", "Locations", "Shops"]) {
    const statistic = statistics.locator(
      `[data-statistic="${label.toLowerCase()}"]`
    );
    await expect(statistic.getByText(label, { exact: true })).toBeVisible();
    await expect(statistic.locator("dd")).toHaveText(/^\d[\d,]*$/);
  }
});

test("landing composition stays centered and bounded at all target widths", async ({
  page,
}) => {
  await mkdir("test-results/landing-page-visual-pass", { recursive: true });

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/");

    const layout = await page.evaluate(() => {
      const header = document.querySelector<HTMLElement>(
        ".public-site-header-inner"
      );
      const main = document.querySelector<HTMLElement>(".public-site-main");
      const hero = document.querySelector<HTMLElement>(".landing-hero-copy");
      const cards = document.querySelector<HTMLElement>(
        ".landing-resource-grid"
      );
      const firstSpriteSlot = document.querySelector<HTMLElement>(
        ".landing-resource-sprite-slot"
      );
      const siteHeader =
        document.querySelector<HTMLElement>(".public-site-header");
      if (
        !header ||
        !main ||
        !hero ||
        !cards ||
        !firstSpriteSlot ||
        !siteHeader
      ) {
        throw new Error("The landing page composition did not render.");
      }

      const mainRect = main.getBoundingClientRect();
      return {
        viewportWidth: document.documentElement.clientWidth,
        documentWidth: document.documentElement.scrollWidth,
        mainLeft: mainRect.left,
        mainWidth: mainRect.width,
        headerWidth: header.getBoundingClientRect().width,
        heroTextAlign: getComputedStyle(hero).textAlign,
        cardsRight: cards.getBoundingClientRect().right,
        spriteSlotWidth: firstSpriteSlot.getBoundingClientRect().width,
        headerPosition: getComputedStyle(siteHeader).position,
        headerBackground: getComputedStyle(siteHeader).backgroundColor,
      };
    });

    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.mainWidth).toBeCloseTo(viewport.expectedWidth, 0);
    expect(layout.headerWidth).toBeCloseTo(layout.mainWidth, 0);
    expect(layout.mainLeft).toBeCloseTo(
      (layout.viewportWidth - layout.mainWidth) / 2,
      0
    );
    expect(layout.heroTextAlign).toBe("start");
    expect(layout.cardsRight).toBeLessThanOrEqual(
      layout.mainLeft + layout.mainWidth
    );
    expect(layout.spriteSlotWidth).toBe(viewport.expectedSprite);
    expect(layout.headerPosition).toBe("sticky");
    expect(layout.headerBackground).not.toBe("rgba(0, 0, 0, 0)");

    const scenicBackground = page.locator(".public-scenic-background--home");
    await expect(scenicBackground).toHaveCount(1);
    await expect(scenicBackground).toHaveAttribute("aria-hidden", "true");
    await expect(scenicBackground).toHaveCSS(
      "background-image",
      /merchants-codex-coastal-overlook\.png/
    );
    expect(
      await scenicBackground.evaluate(
        (element) => getComputedStyle(element).backgroundPosition
      )
    ).toContain("55%");

    await page.screenshot({
      path: `test-results/landing-page-visual-pass/landing-${viewport.width}x${viewport.height}.png`,
      fullPage: true,
    });

    if (viewport.width === 1920) {
      await page.locator(".public-site-header").screenshot({
        path: "test-results/landing-page-visual-pass/scenic-header-1920.png",
      });
      await page.screenshot({
        path: "test-results/landing-page-visual-pass/scenic-to-charcoal-transition-1920.png",
        clip: { x: 0, y: 430, width: 1920, height: 500 },
      });
    }
  }
});

test("plain-charcoal override leaves interface geometry unchanged", async ({
  page,
}) => {
  await mkdir("test-results/landing-page-visual-pass", { recursive: true });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/");

  const measure = () =>
    page.evaluate(() => {
      const hero = document.querySelector<HTMLElement>(".landing-hero-copy");
      const statistics =
        document.querySelector<HTMLElement>(".landing-statistics");
      const resources =
        document.querySelector<HTMLElement>(".landing-resource-grid");
      if (!hero || !statistics || !resources) {
        throw new Error("Landing interface geometry is unavailable.");
      }
      return [hero, statistics, resources].map((element) => {
        const rect = element.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      });
    });

  const decoratedGeometry = await measure();
  await page.addStyleTag({
    content: `
      .public-scenic-background { display: none !important; }
      .public-site-shell--landing { background: #111514 !important; }
    `,
  });
  const charcoalGeometry = await measure();

  expect(charcoalGeometry).toEqual(decoratedGeometry);
  await page.screenshot({
    path: "test-results/landing-page-visual-pass/landing-plain-charcoal-1920x1080.png",
    fullPage: true,
  });
});

test("the landing page reflows safely below desktop widths", async ({
  page,
}) => {
  for (const viewport of [
    { width: 1024, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");

    const layout = await page.evaluate(() => ({
      viewportWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      statisticColumns: getComputedStyle(
        document.querySelector<HTMLElement>(".landing-statistics")!
      ).gridTemplateColumns,
      cardColumns: getComputedStyle(
        document.querySelector<HTMLElement>(".landing-resource-grid")!
      ).gridTemplateColumns,
    }));

    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.statisticColumns.split(" ")).toHaveLength(2);
    expect(layout.cardColumns.split(" ").length).toBeGreaterThanOrEqual(1);
    await expect(
      page.getByRole("search", { name: "Site search" })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Browse Items", exact: true })
    ).toBeVisible();

    const scenicBackground = page.locator(".public-scenic-background--home");
    if (viewport.width === 390) {
      expect(
        await scenicBackground.evaluate(
          (element) => getComputedStyle(element).backgroundPosition
        )
      ).toContain("82%");
      await page.screenshot({
        path: "test-results/landing-page-visual-pass/landing-390x844.png",
        fullPage: true,
      });
      await page.screenshot({
        path: "test-results/landing-page-visual-pass/scenic-mobile-crop-390x844.png",
      });
    }
  }
});
