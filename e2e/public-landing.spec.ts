import { createHash } from "node:crypto";
import { mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
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

test("the lossless scenic source remains byte-identical", async () => {
  const assetPath = path.join(
    process.cwd(),
    "public",
    "images",
    "backgrounds",
    "merchants-codex-coastal-overlook.png"
  );
  const bytes = await readFile(assetPath);
  const metadata = await stat(assetPath);

  expect(bytes.subarray(0, 8)).toEqual(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  );
  expect(bytes.readUInt32BE(16)).toBe(3876);
  expect(bytes.readUInt32BE(20)).toBe(1622);
  expect(metadata.size).toBe(6_806_415);
  expect(createHash("sha256").update(bytes).digest("hex").toUpperCase()).toBe(
    "E07B93BE5F96562FD503E91C416BA3B11DC42FB6CFB5D0737D4D39DB0E532142"
  );
});

test("hero CTAs and all five resource cards use their approved routes", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("link", { name: "Browse the Codex", exact: true })
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

  await page.getByRole("link", { name: "Browse the Codex", exact: true }).click();
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
        // The Claude Design redesign (Slice 2) turned the header into a
        // floating card (.public-site-header-inner carries the opaque
        // backdrop/border/shadow) rather than a full-bleed strip — the
        // outer sticky wrapper (.public-site-header) is intentionally
        // transparent so the scenic background shows around the bar.
        headerBarBackground: getComputedStyle(header).backgroundColor,
      };
    });

    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.mainWidth).toBeCloseTo(viewport.expectedWidth, 0);
    expect(layout.headerWidth).toBeCloseTo(layout.mainWidth, 0);
    expect(layout.mainLeft).toBeCloseTo(
      (layout.viewportWidth - layout.mainWidth) / 2,
      0
    );
    // The Claude Design redesign (Slice 3) made the hero centered — eyebrow,
    // serif title, lead, and CTAs all stacked and center-aligned — instead
    // of the prior left-aligned two-column layout.
    expect(layout.heroTextAlign).toBe("center");
    expect(layout.cardsRight).toBeLessThanOrEqual(
      layout.mainLeft + layout.mainWidth
    );
    expect(layout.spriteSlotWidth).toBe(viewport.expectedSprite);
    expect(layout.headerPosition).toBe("sticky");
    expect(layout.headerBarBackground).not.toBe("rgba(0, 0, 0, 0)");

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
    expect(
      await scenicBackground.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          washTop: style.getPropertyValue("--public-scenic-wash-top").trim(),
          washMiddle: style
            .getPropertyValue("--public-scenic-wash-middle")
            .trim(),
          vignetteLeft: style
            .getPropertyValue("--public-scenic-vignette-left")
            .trim(),
          vignetteCenter: style
            .getPropertyValue("--public-scenic-vignette-center")
            .trim(),
          vignetteRight: style
            .getPropertyValue("--public-scenic-vignette-right")
            .trim(),
        };
      })
    ).toEqual({
      washTop: "#11151438",
      washMiddle: "#1115144d",
      vignetteLeft: "#11151461",
      vignetteCenter: "#11151414",
      vignetteRight: "#1115142e",
    });

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
  // The hero title uses a webfont (Cormorant Garamond, display: "swap"):
  // waiting for it here avoids straddling the fallback-to-webfont swap
  // between the two measurements below.
  await page.evaluate(() => document.fonts.ready);

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

  // A tolerance, not exact equality: Chromium's text layout for the
  // serif hero title isn't perfectly bit-stable between two layout
  // passes of the same content — a sub-pixel snap (observed up to ~1px)
  // that isn't a real geometry shift and isn't what this assertion is
  // checking for (whether the charcoal override moves the interface).
  const GEOMETRY_TOLERANCE_PX = 2;
  for (let index = 0; index < decoratedGeometry.length; index += 1) {
    for (const key of ["x", "y", "width", "height"] as const) {
      expect(
        Math.abs(charcoalGeometry[index][key] - decoratedGeometry[index][key]),
        `element ${index} "${key}": decorated=${decoratedGeometry[index][key]} charcoal=${charcoalGeometry[index][key]}`
      ).toBeLessThanOrEqual(GEOMETRY_TOLERANCE_PX);
    }
  }
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
      page.getByRole("link", { name: "Browse the Codex", exact: true })
    ).toBeVisible();

    const scenicBackground = page.locator(".public-scenic-background--home");
    if (viewport.width === 390) {
      expect(
        await scenicBackground.evaluate(
          (element) => getComputedStyle(element).backgroundPosition
        )
      ).toContain("82%");
      expect(
        await scenicBackground.evaluate((element) => {
          const style = getComputedStyle(element);
          return {
            washTop: style
              .getPropertyValue("--public-scenic-wash-top")
              .trim(),
            washMiddle: style
              .getPropertyValue("--public-scenic-wash-middle")
              .trim(),
            vignetteLeft: style
              .getPropertyValue("--public-scenic-vignette-left")
              .trim(),
            vignetteCenter: style
              .getPropertyValue("--public-scenic-vignette-center")
              .trim(),
            vignetteRight: style
              .getPropertyValue("--public-scenic-vignette-right")
              .trim(),
          };
        })
      ).toEqual({
        washTop: "#1115145c",
        washMiddle: "#1115146b",
        vignetteLeft: "#11151466",
        vignetteCenter: "#11151433",
        vignetteRight: "#11151442",
      });
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
