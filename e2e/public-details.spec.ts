// Non-destructive browser coverage for public detail pages, relational
// navigation between them, and the no-image fallback. Read-only against the
// deterministic seed from prisma/seed.ts:
//   Recipe "Iron Sword" -> results in Item "Iron Sword" (category Gear),
//   ingredients Iron Ingot x2 and Leather Strap x1, profession Smithing.
//   Category "Materials" holds Iron Ore; no seeded record has an image.

import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  createE2ePublicItemDetailFixture,
  deleteE2ePublicItemDetailFixture,
} from "./helpers/database-cleanup";
import { requireSiteVisibility } from "./helpers/site-visibility";

// Anonymous public browsing is only reachable under PUBLIC visibility, so
// this spec establishes it rather than inheriting whatever mode the
// previously-run spec happened to leave behind.
requireSiteVisibility("PUBLIC");

// Each resource detail page's hero carries a `resource-atmosphere` wash in
// its own hue (see globals.css); this confirms the modifier class is
// present and actually resolves to a real gradient, not the `none` default.
async function expectResourceAtmosphere(page: Page, variant: string) {
  const atmosphere = page.locator(`.resource-atmosphere--${variant}`);
  await expect(atmosphere).toHaveCount(1);
  const atmosphereImage = await atmosphere.evaluate((element) =>
    getComputedStyle(element)
      .getPropertyValue("--resource-atmosphere-image")
      .trim()
  );
  expect(atmosphereImage).not.toBe("none");
  expect(atmosphereImage).not.toBe("");
}

const PNG_FIXTURE = path.join(__dirname, "fixtures", "tiny-valid.png");
const SCREENSHOT_DIRECTORY = path.join(
  process.cwd(),
  "test-results",
  "item-detail-visuals"
);

let itemFixture: Awaited<
  ReturnType<typeof createE2ePublicItemDetailFixture>
>;

// Browser error hygiene (Group 9): any uncaught page error fails the test.
// Serial single-worker execution makes this module-level state safe.
let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.beforeAll(async () => {
  fs.mkdirSync(SCREENSHOT_DIRECTORY, { recursive: true });
  itemFixture = await createE2ePublicItemDetailFixture(
    fs.readFileSync(PNG_FIXTURE)
  );
});

test.afterEach(() => {
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

test.afterAll(async () => {
  await deleteE2ePublicItemDetailFixture();
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// General resource cards expose an h3; RecipeOutputCard uses a contextual
// link name because its visual title is a strong inside a multi-control card.
function cardLink(page: Page, name: string) {
  const headingCard = page
    .getByRole("link")
    .filter({ has: page.getByRole("heading", { level: 3, name, exact: true }) });
  const recipeOutputCard = page.getByRole("link", {
    name: new RegExp(`^${escapeRegExp(name)}, produces `),
  });

  return headingCard.or(recipeOutputCard);
}

test.describe("public detail pages", () => {
  test("item detail matches the approved information hierarchy", async ({
    page,
  }) => {
    await page.goto(`/items/${itemFixture.item.slug}`);

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: itemFixture.item.name,
        exact: true,
      })
    ).toBeVisible();
    await expect(
      page.getByText(
        "A dense mineral sample used to verify the public Item detail presentation.",
        { exact: true }
      )
    ).toBeVisible();

    const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(
      breadcrumb.getByRole("link", { name: "Home", exact: true })
    ).toHaveAttribute("href", "/");
    await expect(
      breadcrumb.getByRole("link", { name: "Items", exact: true })
    ).toHaveAttribute("href", "/items");
    await expect(
      breadcrumb.getByText(itemFixture.item.name, { exact: true })
    ).toHaveAttribute("aria-current", "page");

    const heroImage = page.getByRole("img", {
      name: `Image of ${itemFixture.item.name}`,
      exact: true,
    });
    await expect(heroImage).toHaveCount(1);
    await expect(heroImage).toBeVisible();
    await expect(heroImage).toHaveCSS("image-rendering", "pixelated");
    const heroStage = page.locator(".public-sprite-stage--hero");
    await expect(heroStage).toHaveCount(1);
    const heroBounds = await heroStage.boundingBox();
    const imageBounds = await heroImage.boundingBox();
    expect(heroBounds).not.toBeNull();
    expect(imageBounds).not.toBeNull();
    expect(imageBounds!.width).toBeLessThan(heroBounds!.width);
    expect(imageBounds!.height).toBeLessThan(heroBounds!.height);

    await expect(page.getByText("Materials", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Held item").first()).toBeVisible();
    await expect(page.getByText("No", { exact: true }).first()).toBeVisible();

    // The Source chip sits toward the bottom of the hero copy column but
    // must not touch the frame's bottom edge -- it needs the same
    // comfortable breathing room Recipe detail's hero chips get.
    const sourceChip = page.locator(".item-info-chip", { hasText: "Source:" });
    const heroCopy = page.locator(".item-identity-copy");
    const sourceChipBounds = await sourceChip.boundingBox();
    const heroCopyBounds = await heroCopy.boundingBox();
    expect(sourceChipBounds).not.toBeNull();
    expect(heroCopyBounds).not.toBeNull();
    expect(
      heroCopyBounds!.y + heroCopyBounds!.height - (sourceChipBounds!.y + sourceChipBounds!.height)
    ).toBeGreaterThanOrEqual(16);
    await expect(
      page.getByRole("heading", { level: 2, name: "Item details", exact: true })
    ).toBeVisible();
    // Verification moved from a sidebar panel into a discreet hero badge.
    await expect(
      page.locator(".item-main-column .verification-status")
    ).toHaveCount(1);

    await expect(
      page.getByRole("heading", { level: 2, name: "How to obtain" })
    ).toBeVisible();
    await expect(page.getByText("Azure mineral deposit")).toBeVisible();

    // "Used in recipes" is a Recipe collection, so it uses the canonical
    // relationship card rather than a shortened Item-specific lookalike.
    await expect(
      page.getByRole("heading", { level: 2, name: "Used in recipes" })
    ).toBeVisible();
    const usedIn = page.locator(".recipe-collection-section").filter({
      has: page.getByRole("heading", { level: 2, name: "Used in recipes" }),
    });
    const recipeCard = usedIn.locator(".recipe-output-card--grid").filter({
      hasText: itemFixture.recipeName,
    });
    await expect(
      recipeCard.locator(`a[href="/recipes/${itemFixture.item.slug}-recipe"]`)
    ).toHaveCount(1);
    await expect(recipeCard).toContainText("Smithing");
    // The card's own ingredient preview links back to this Item.
    await expect(
      recipeCard.locator(`a[href="/items/${itemFixture.item.slug}"]`).first()
    ).toHaveAttribute(
      "aria-label",
      `${itemFixture.item.name}, required quantity ×2`
    );

    const atmosphere = page.locator(".resource-atmosphere--item");
    expect(
      await atmosphere.evaluate(
        (element) => getComputedStyle(element, "::before").backgroundImage
      )
    ).toContain("radial-gradient");
    await expect(page.locator(".item-sidebar .resource-atmosphere")).toHaveCount(
      0
    );

    await atmosphere.evaluate((element) => {
      (element as HTMLElement).style.setProperty(
        "--resource-atmosphere-image",
        "none"
      );
    });
    expect(
      await atmosphere.evaluate(
        (element) => getComputedStyle(element, "::before").backgroundImage
      )
    ).toBe("none");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: itemFixture.item.name,
        exact: true,
      })
    ).toBeVisible();
    await atmosphere.evaluate((element) => {
      (element as HTMLElement).style.removeProperty(
        "--resource-atmosphere-image"
      );
    });

    await expect(page.getByText("Quick Links", { exact: true })).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Additional information", exact: true })
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Notes", exact: true })
    ).toHaveCount(0);
    await expect(page.getByText("Tradeable:", { exact: false })).toHaveCount(0);
    await expect(page.getByText("Base value:", { exact: false })).toHaveCount(0);

    const scenicBackground = page.locator(
      ".public-scenic-background--detail"
    );
    await expect(scenicBackground).toHaveCount(1);
    await expect(scenicBackground).toHaveCSS(
      "background-image",
      /merchants-codex-coastal-overlook\.png/
    );
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
      washTop: "#111514ad",
      washMiddle: "#111514cc",
      vignetteLeft: "#111514c7",
      vignetteCenter: "#11151475",
      vignetteRight: "#111514a8",
    });

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
      await page.screenshot({
        path: path.join(
          SCREENSHOT_DIRECTORY,
          `item-populated-${viewport.width}x${viewport.height}.png`
        ),
        fullPage: true,
      });
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    const mobileWidths = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(mobileWidths.content).toBeLessThanOrEqual(mobileWidths.viewport);
    expect(
      await scenicBackground.evaluate(
        (element) => getComputedStyle(element).backgroundPosition
      )
    ).toContain("82%");
    await page.screenshot({
      path: path.join(
        SCREENSHOT_DIRECTORY,
        "item-populated-390x844.png"
      ),
      fullPage: true,
    });

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/items/wood");
    await expect(page.locator(".public-sprite-stage--hero")).toContainText(
      "No image available"
    );
    await page.screenshot({
      path: path.join(
        SCREENSHOT_DIRECTORY,
        "item-no-image-1920x1080.png"
      ),
      fullPage: true,
    });
  });

  test("the hero verification badge is reachable by click, hover, focus, and Escape", async ({
    page,
  }) => {
    await page.goto(`/items/${itemFixture.item.slug}`);

    const status = page.locator(".item-main-column .verification-status");
    const trigger = status.locator(".verification-status-trigger");
    const panel = status.locator(".verification-status-panel");

    // Always visible, never hover-only.
    await expect(trigger).toBeVisible();
    await expect(panel).not.toBeVisible();

    // Click toggles it open...
    await trigger.click();
    await expect(panel).toBeVisible();
    await expect(panel).toContainText("Verified");

    // ...and an outside click closes it.
    await page.getByRole("heading", { level: 1 }).click();
    await expect(panel).not.toBeVisible();

    // Keyboard: focus reveals it via :focus-within, Escape closes it.
    await trigger.focus();
    await expect(panel).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(panel).not.toBeVisible();

    // Hover alone reveals it for pointer users, with no click needed.
    await trigger.hover();
    await expect(panel).toBeVisible();
    await page.mouse.move(0, 0);
  });

  test("recipe detail links the resulting item and its ingredients", async ({
    page,
  }) => {
    await page.goto("/recipes/iron-sword");

    await expect(
      page.getByRole("heading", { level: 1, name: "Iron Sword", exact: true })
    ).toBeVisible();

    const resultRow = page.locator(".recipe-result-row");
    await expect(resultRow).toBeVisible();
    await expect(resultRow).toHaveAttribute("href", "/items/iron-sword");

    await expect(
      page.getByRole("heading", { level: 2, name: "Ingredients" })
    ).toBeVisible();
    const ironIngot = page.locator(".recipe-ingredient-row").filter({
      hasText: "Iron Ingot",
    });
    await expect(ironIngot).toHaveAttribute("href", "/items/iron-ingot");
    const leatherStrap = page.locator(".recipe-ingredient-row").filter({
      hasText: "Leather Strap",
    });
    await expect(leatherStrap).toHaveAttribute("href", "/items/leather-strap");
  });

  test("recipe detail hero carries the amber resource atmosphere and a clean rounded frame", async ({
    page,
  }) => {
    await page.goto("/recipes/iron-sword");

    await expectResourceAtmosphere(page, "recipe");

    // The hero image stage's frame must stay a clean, uniform, fully
    // rounded square: the same radius on all four corners, a real border,
    // and overflow clipping so nothing (e.g. the yield badge) can cross
    // the curve.
    const stage = page.locator(".recipe-identity-stage");
    const geometry = await stage.evaluate((element) => {
      const cs = getComputedStyle(element);
      return {
        overflow: cs.overflow,
        boxSizing: cs.boxSizing,
        topLeft: cs.borderTopLeftRadius,
        topRight: cs.borderTopRightRadius,
        bottomLeft: cs.borderBottomLeftRadius,
        bottomRight: cs.borderBottomRightRadius,
        borderWidth: cs.borderTopWidth,
      };
    });
    expect(geometry.overflow).toBe("hidden");
    expect(geometry.boxSizing).toBe("border-box");
    expect(geometry.topLeft).toBe(geometry.topRight);
    expect(geometry.topLeft).toBe(geometry.bottomLeft);
    expect(geometry.topLeft).toBe(geometry.bottomRight);
    expect(geometry.borderWidth).toBe("1px");

    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth
        )
      )
      .toBe(true);
  });

  // The whole point of the canonical card: these three surfaces present the
  // same information shape, so they must present the same component rather
  // than three lookalikes that drift apart.
  const CANONICAL_SURFACES = [
    { name: "Item detail Used in recipes", path: "/items/iron-ingot", heading: "Used in recipes" },
    { name: "Recipe detail Related Recipes", path: "/recipes/iron-sword", heading: "Related Recipes" },
    { name: "Profession detail Recipes", path: "/professions/smithing", heading: "Recipes" },
  ] as const;

  for (const surface of CANONICAL_SURFACES) {
    test(`${surface.name} uses the canonical Recipe card`, async ({ page }) => {
      await page.goto(surface.path);

      const section = page.locator(".recipe-collection-section").filter({
        has: page.getByRole("heading", { level: 2, name: surface.heading, exact: true }),
      });
      await expect(section).toHaveCount(1);

      // Grid is the default view and uses the canonical grid card.
      const gridCards = section.locator(".recipe-output-card--grid");
      expect(await gridCards.count()).toBeGreaterThan(0);
      await expect(section.locator(".recipe-output-card--list")).toHaveCount(0);

      // Every grid card links to its own Recipe, and any chevron present is
      // an ingredient control that never navigates.
      const firstCard = gridCards.first();
      await expect(
        firstCard.locator('a[href^="/recipes/"]')
      ).not.toHaveCount(0);

      // Switching to List swaps the card family and drops every disclosure.
      const listButton = section.getByRole("button", { name: "List", exact: true });
      await listButton.click();
      await expect(listButton).toHaveAttribute("aria-pressed", "true");
      const listCards = section.locator(".recipe-output-card--list");
      expect(await listCards.count()).toBeGreaterThan(0);
      await expect(section.locator(".recipe-output-card--grid")).toHaveCount(0);

      // The List variant NEVER hides ingredient data behind a disclosure.
      await expect(
        section.locator(".recipe-output-ingredient-toggle")
      ).toHaveCount(0);
      await expect(
        section.locator(".recipe-output-ingredient-panel")
      ).toHaveCount(0);
      await expect(
        section.locator(".recipe-output-ingredient-disclosure")
      ).toHaveCount(0);

      // …and it shows EXP, which the compact grid card has no room for.
      await expect(listCards.first().locator(".recipe-output-experience")).toHaveCount(1);

      await expect
        .poll(() =>
          page.evaluate(
            () =>
              document.documentElement.scrollWidth <=
              document.documentElement.clientWidth
          )
        )
        .toBe(true);
    });

    // The Grid card's ingredient disclosure panel and tooltips are
    // absolutely-positioned descendants that must escape this shared shell
    // to paint above whatever section follows it on the page (e.g. a
    // Verification strip). They can only do that if the shell itself is
    // promoted into the browser's "positioned" paint bucket instead of
    // sitting with the page's other non-positioned in-flow content, which
    // is what actually causes the panel to paint underneath later sections.
    test(`${surface.name} collection panel is promoted to paint above later sections`, async ({
      page,
    }) => {
      await page.goto(surface.path);

      const panel = page
        .locator(".recipe-collection-section")
        .filter({
          has: page.getByRole("heading", { level: 2, name: surface.heading, exact: true }),
        })
        .locator(".recipe-collection-panel");
      await expect(panel).toHaveCount(1);

      const style = await panel.evaluate((element) => {
        const computed = getComputedStyle(element);
        return { position: computed.position, zIndex: computed.zIndex };
      });
      expect(style.position).toBe("relative");
      expect(Number(style.zIndex)).toBeGreaterThan(0);
    });
  }

  test("profession detail links its recipes", async ({ page }) => {
    await page.goto("/professions/smithing");

    await expect(
      page.getByRole("heading", { level: 1, name: "Smithing", exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        level: 2,
        name: "Recipes",
        exact: true,
      })
    ).toBeVisible();

    const recipeLink = page.locator(".recipe-output-recipe-link").filter({
      hasText: "Iron Ingot",
    });
    await expect(recipeLink).toBeVisible();
    await expect(recipeLink).toHaveAttribute("href", "/recipes/iron-ingot");
  });

  test("profession detail hero carries the amethyst resource atmosphere", async ({
    page,
  }) => {
    await page.goto("/professions/smithing");
    await expectResourceAtmosphere(page, "profession");
  });

  test("category detail links its items", async ({ page }) => {
    await page.goto("/categories/materials");

    await expect(
      page.getByRole("heading", { level: 1, name: "Materials", exact: true })
    ).toBeVisible();
    await expect(page.getByText(/^Items: \d+$/)).toBeVisible();
    await expect(
      page.getByRole("link", {
        name: "Browse Materials items",
        exact: true,
      })
    ).toHaveAttribute("href", "/items?category=materials");
    await expect(cardLink(page, "Iron Ore")).toHaveCount(0);
  });
});

test.describe("relational navigation journeys", () => {
  test("recipe list -> recipe detail -> resulting item detail", async ({
    page,
  }) => {
    await page.goto("/recipes");
    await cardLink(page, "Iron Sword").click();
    await expect(page).toHaveURL("/recipes/iron-sword");

    await page.locator(".recipe-result-row").click();
    await expect(page).toHaveURL("/items/iron-sword");
    await expect(
      page.getByRole("heading", { level: 1, name: "Iron Sword", exact: true })
    ).toBeVisible();
  });

  test("category list -> category detail -> item detail", async ({ page }) => {
    await page.goto("/categories");
    await cardLink(page, "Materials").click();
    await expect(page).toHaveURL("/categories/materials");

    await page
      .getByRole("link", { name: "Browse Materials items", exact: true })
      .click();
    await expect(page).toHaveURL("/items?category=materials");
    await cardLink(page, "Iron Ore").click();
    await expect(page).toHaveURL("/items/iron-ore");
    await expect(
      page.getByRole("heading", { level: 1, name: "Iron Ore", exact: true })
    ).toBeVisible();
  });

  test("profession detail -> recipe detail", async ({ page }) => {
    await page.goto("/professions/smithing");
    await page
      .locator(".recipe-output-recipe-link")
      .filter({ hasText: "Iron Ingot" })
      .click();
    await expect(page).toHaveURL("/recipes/iron-ingot");
    await expect(
      page.getByRole("heading", { level: 1, name: "Iron Ingot", exact: true })
    ).toBeVisible();
  });
});

test.describe("image fallback", () => {
  test("list cards show the no-image fallback for seeded records", async ({
    page,
  }) => {
    await page.goto("/items");
    // Every seeded record is imageless, so the fallback must be present.
    await expect(page.getByText("No image available").first()).toBeVisible();
  });

  test("detail pages show the no-image fallback for seeded records", async ({
    page,
  }) => {
    await page.goto("/items/iron-ore");
    await expect(
      page.getByRole("heading", { level: 1, name: "Iron Ore", exact: true })
    ).toBeVisible();
    await expect(page.getByText("No image available").first()).toBeVisible();
  });
});
