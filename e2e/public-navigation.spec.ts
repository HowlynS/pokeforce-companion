// Non-destructive browser coverage for the homepage, main navigation, and
// every public list page. Read-only: nothing signs in, no form is
// submitted, and no record, Auth user, or Storage object is touched.
// Selectors are accessible roles, headings, and link names — never CSS
// classes. Seeded names/slugs come from prisma/seed.ts.

import { expect, test, type Page } from "@playwright/test";

// Browser error hygiene (Group 9): any uncaught page error fails the test.
// Serial single-worker execution makes this module-level state safe.
let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(() => {
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

// General resource cards expose an h3; RecipeOutputCard uses a contextual
// link name because its visual title is a strong inside a multi-control card.
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cardLink(page: Page, name: string) {
  const headingCard = page
    .getByRole("link")
    .filter({ has: page.getByRole("heading", { level: 3, name, exact: true }) });
  const recipeOutputCard = page.getByRole("link", {
    name: new RegExp(`^${escapeRegExp(name)}, produces `),
  });

  return headingCard.or(recipeOutputCard);
}

test.describe("homepage", () => {
  test("renders the shell, heading, and main landmark", async ({ page }) => {
    await page.goto("/");

    // The page title is the one h1; the shell's brand lockup is a home
    // link (containing the product name and tagline), not a heading. The
    // Claude Design redesign (Slice 3) made the hero title the product's
    // own established brand name ("Merchants Codex" — already used
    // elsewhere in this shell, e.g. the footer's landing-mode brand text)
    // rather than a separate tagline.
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Merchants Codex",
      })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Merchants Codex home", exact: true })
    ).toHaveAttribute("href", "/");
    await expect(page.getByRole("main")).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Main navigation" })
    ).toBeVisible();
    await expect(page.getByRole("contentinfo")).toContainText(
      "Merchants Codex"
    );
    await expect(page.getByRole("contentinfo")).toContainText(
      "A crafting wiki companion for items, recipes, professions, classes, categories, locations, and shops."
    );
    await expect(page.locator(".public-scenic-background--home")).toHaveCount(
      1
    );
  });

  // Locations remains one of the five focused landing-page resource cards.
  test("the Locations card is visible and links to /locations", async ({
    page,
  }) => {
    await page.goto("/");

    const card = cardLink(page, "Locations");
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute("href", "/locations");
  });

  test("the Shops card is visible and links to /shops", async ({ page }) => {
    await page.goto("/");

    const card = cardLink(page, "Shops");
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute("href", "/shops");
  });

  test("the Classes card is visible and links to /classes", async ({
    page,
  }) => {
    await page.goto("/");

    const card = cardLink(page, "Classes");
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute("href", "/classes");
  });
});

// Items/Recipes/Professions/Classes stay flat top-level links. Locations
// and Shops moved under the header's World dropdown in the Claude Design
// redesign (Slice 2) — see world-menu.tsx — so they're covered by the
// separate "World dropdown" describe block below instead of this list.
const NAV_TARGETS = [
  { label: "Items", path: "/items", heading: "Items" },
  { label: "Recipes", path: "/recipes", heading: "Recipes" },
  { label: "Professions", path: "/professions", heading: "Professions" },
  { label: "Classes", path: "/classes", heading: "Classes" },
] as const;

test.describe("main navigation", () => {
  for (const target of NAV_TARGETS) {
    test(`the ${target.label} link opens ${target.path}`, async ({ page }) => {
      await page.goto("/");

      const navLink = page
        .getByRole("navigation", { name: "Main navigation" })
        .getByRole("link", { name: target.label, exact: true });
      const inactiveWidth = (await navLink.boundingBox())?.width;
      await navLink.click();

      await expect(page).toHaveURL(target.path);
      await expect(
        page.getByRole("heading", { level: 1, name: target.heading, exact: true })
      ).toBeVisible();
      await expect(navLink).toHaveAttribute("aria-current", "page");
      const activeWidth = (await navLink.boundingBox())?.width;
      expect(activeWidth).toBe(inactiveWidth);
    });
  }

  const WORLD_TARGETS = [
    { label: "Locations", path: "/locations", heading: "Locations" },
    { label: "Shops", path: "/shops", heading: "Shops" },
  ] as const;

  test.describe("World dropdown", () => {
    for (const target of WORLD_TARGETS) {
      test(`the ${target.label} entry opens ${target.path}`, async ({
        page,
      }) => {
        await page.goto("/");

        const navigation = page.getByRole("navigation", {
          name: "Main navigation",
        });
        const trigger = navigation.getByRole("button", { name: "World" });
        await expect(
          navigation.getByRole("link", { name: target.label })
        ).toHaveCount(0);

        await trigger.click();
        await expect(trigger).toHaveAttribute("aria-expanded", "true");
        const entry = navigation.getByRole("link", { name: target.label });
        await expect(entry).toBeVisible();
        await entry.click();

        await expect(page).toHaveURL(target.path);
        await expect(
          page.getByRole("heading", {
            level: 1,
            name: target.heading,
            exact: true,
          })
        ).toBeVisible();
      });
    }

    test("opens on click, closes on outside click, and closes on Escape returning focus to the trigger", async ({
      page,
    }) => {
      await page.goto("/");

      const navigation = page.getByRole("navigation", {
        name: "Main navigation",
      });
      const trigger = navigation.getByRole("button", { name: "World" });

      await trigger.click();
      await expect(trigger).toHaveAttribute("aria-expanded", "true");
      await expect(
        navigation.getByRole("link", { name: "Locations" })
      ).toBeVisible();

      await page.mouse.click(10, 10);
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
      await expect(
        navigation.getByRole("link", { name: "Locations" })
      ).toHaveCount(0);

      await trigger.click();
      await expect(trigger).toHaveAttribute("aria-expanded", "true");
      await page.keyboard.press("Escape");
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
      await expect(trigger).toBeFocused();
    });

    test("does not expose World Navigation or NPCs, which have no production route", async ({
      page,
    }) => {
      await page.goto("/");

      const navigation = page.getByRole("navigation", {
        name: "Main navigation",
      });
      await navigation.getByRole("button", { name: "World" }).click();

      for (const unsupportedLabel of ["World Navigation", "NPCs"]) {
        await expect(
          navigation.getByRole("link", { name: unsupportedLabel })
        ).toHaveCount(0);
      }
    });
  });

  test("detail pages retain their resource-level active state", async ({
    page,
  }) => {
    await page.goto("/items/iron-ore");

    const navigation = page.getByRole("navigation", {
      name: "Main navigation",
    });
    await expect(
      navigation.getByRole("link", { name: "Items", exact: true })
    ).toHaveAttribute("aria-current", "page");
    await expect(navigation.locator('[aria-current="page"]')).toHaveCount(1);
  });

  test("the scenic atmosphere is limited to the approved public routes", async ({
    page,
  }) => {
    for (const [path, variant] of [
      ["/", "home"],
      ["/items", "catalogue"],
      ["/items/iron-ore", "detail"],
    ] as const) {
      await page.goto(path);
      await expect(
        page.locator(`.public-scenic-background--${variant}`)
      ).toHaveCount(1);
    }

    await page.goto("/recipes");
    await expect(page.locator(".public-scenic-background")).toHaveCount(0);
  });

  test("primary links expose keyboard focus without extra admin resources", async ({
    page,
  }) => {
    await page.goto("/items");

    const navigation = page.getByRole("navigation", {
      name: "Main navigation",
    });
    const itemsLink = navigation.getByRole("link", {
      name: "Items",
      exact: true,
    });
    await itemsLink.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(itemsLink).toBeFocused();
    expect(
      await itemsLink.evaluate((link) => {
        const style = getComputedStyle(link);
        return {
          outlineStyle: style.outlineStyle,
          outlineWidth: style.outlineWidth,
        };
      })
    ).toEqual({ outlineStyle: "solid", outlineWidth: "2px" });

    for (const excludedLabel of [
      "Acquisition Sources",
      "Currencies",
      "Game Versions",
    ]) {
      await expect(
        navigation.getByRole("link", {
          name: excludedLabel,
          exact: true,
        })
      ).toHaveCount(0);
    }
  });
});

test.describe("public shell layout", () => {
  test("list and detail content share a centered bounded container", async ({
    page,
  }) => {
    for (const path of ["/items", "/items/iron-ore"]) {
      await page.goto(path);
      await expect(
        page.locator(".public-site-main").getByRole("heading", { level: 1 })
      ).toBeVisible();

      for (const viewport of [
        { width: 1920, height: 1080 },
        { width: 3440, height: 1440 },
      ]) {
        await page.setViewportSize(viewport);
        await page.reload();

        const layout = await page.evaluate(() => {
          const header = document.querySelector<HTMLElement>(
            ".public-site-header-inner"
          );
          const main = document.querySelector<HTMLElement>(".public-site-main");
          const footer = document.querySelector<HTMLElement>(
            ".public-site-footer-inner"
          );
          if (!header || !main) {
            throw new Error("Shared public shell elements were not rendered.");
          }

          const headerRect = header.getBoundingClientRect();
          const mainRect = main.getBoundingClientRect();
          const footerRect = footer?.getBoundingClientRect();
          return {
            viewportWidth: document.documentElement.clientWidth,
            contentWidth: document.documentElement.scrollWidth,
            header: {
              left: headerRect.left,
              right: headerRect.right,
              width: headerRect.width,
            },
            main: {
              left: mainRect.left,
              right: mainRect.right,
              width: mainRect.width,
            },
            footer: footerRect
              ? {
                  left: footerRect.left,
                  right: footerRect.right,
                  width: footerRect.width,
                }
              : null,
          };
        });

        expect(layout.contentWidth).toBeLessThanOrEqual(layout.viewportWidth);
        // The Items directory adopted the wide (1720px) container in the
        // Claude Design redesign (Slice 4), matching its Overview sidebar
        // composition — the same width Item detail already used.
        const expectedWidth = Math.min(layout.viewportWidth, 1760);
        expect(Math.abs(layout.main.width - expectedWidth)).toBeLessThan(1);
        expect(Math.abs(layout.main.left - layout.header.left)).toBeLessThan(1);
        expect(Math.abs(layout.main.right - layout.header.right)).toBeLessThan(
          1
        );
        if (path === "/items") {
          expect(layout.footer?.width).toBe(0);
        } else {
          expect(layout.footer).not.toBeNull();
          expect(Math.abs(layout.main.left - layout.footer!.left)).toBeLessThan(1);
          expect(Math.abs(layout.main.right - layout.footer!.right)).toBeLessThan(1);
        }
        expect(
          Math.abs(
            layout.main.left -
              (layout.viewportWidth - layout.main.width) / 2
          )
        ).toBeLessThan(1);
      }
    }
  });

  test("public resource not-found states retain the public shell", async ({
    page,
  }) => {
    const response = await page.goto("/items/test-missing-public-item");

    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "This page could not be found.",
      })
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Main navigation" })
    ).toBeVisible();
    await expect(
      page
        .getByRole("navigation", { name: "Main navigation" })
        .getByRole("link", { name: "Items", exact: true })
    ).toHaveAttribute("aria-current", "page");
  });
});

// One deterministic seeded record per list page, with its expected detail
// route (exact names and slugs from prisma/seed.ts).
const LIST_PAGES = [
  {
    path: "/items",
    heading: "Items",
    seededName: "Iron Ore",
    detailHref: "/items/iron-ore",
  },
  {
    path: "/recipes",
    heading: "Recipes",
    seededName: "Iron Sword",
    detailHref: "/recipes/iron-sword",
  },
  {
    path: "/professions",
    heading: "Professions",
    seededName: "Smithing",
    detailHref: "/professions/smithing",
  },
  {
    path: "/categories",
    heading: "Categories",
    seededName: "Materials",
    detailHref: "/categories/materials",
  },
  {
    path: "/classes",
    heading: "Classes",
    seededName: "Trainer",
    detailHref: "/classes/trainer",
  },
] as const;

test.describe("public list pages", () => {
  for (const listPage of LIST_PAGES) {
    test(`${listPage.path} lists the seeded "${listPage.seededName}" record`, async ({
      page,
    }) => {
      await page.goto(listPage.path);

      await expect(
        page.getByRole("heading", { level: 1, name: listPage.heading, exact: true })
      ).toBeVisible();

      const card = cardLink(page, listPage.seededName);
      await expect(card).toBeVisible();
      await expect(card).toHaveAttribute("href", listPage.detailHref);
    });
  }
});

// Slice 8B: the deterministic profession set. "Blacksmithing" was renamed
// to "Smithing" in place (same persisted row and recipe relations, see
// migration 20260716152420) rather than existing alongside it.
const EXPECTED_PROFESSIONS = [
  { name: "Alchemy", slug: "alchemy" },
  { name: "Archaeology", slug: "archaeology" },
  { name: "Construction", slug: "construction" },
  { name: "Cooking", slug: "cooking" },
  { name: "Crafting", slug: "crafting" },
  { name: "Farming", slug: "farming" },
  { name: "Fishing", slug: "fishing" },
  { name: "Foraging", slug: "foraging" },
  { name: "Mining", slug: "mining" },
  { name: "Smithing", slug: "smithing" },
] as const;

test.describe("profession coverage (Slice 8B)", () => {
  test("all ten deterministic professions are seeded with correct public links", async ({
    page,
  }) => {
    await page.goto("/professions");

    for (const profession of EXPECTED_PROFESSIONS) {
      const card = cardLink(page, profession.name);
      await expect(card).toBeVisible();
      await expect(card).toHaveAttribute(
        "href",
        `/professions/${profession.slug}`
      );
    }

    // The renamed profession no longer exists under its old name.
    await expect(cardLink(page, "Blacksmithing")).toHaveCount(0);
  });

  test("a sparse profession (no description, no recipes, no image) renders without empty optional content", async ({
    page,
  }) => {
    await page.goto("/professions/foraging");

    await expect(
      page.getByRole("heading", { level: 1, name: "Foraging", exact: true })
    ).toBeVisible();
    // No description was seeded: the shared PageHeader omits the paragraph
    // entirely rather than showing a placeholder.
    await expect(page.getByText("No description available")).toHaveCount(0);
    await expect(page.getByText("No image available")).toBeVisible();
    // No recipes either: the entire optional relationship section (heading
    // and empty state alike) is omitted; the factual hero count remains.
    const recipeCount = page
      .locator(".profession-hero-counts > div")
      .filter({ hasText: "Recipes" });
    await expect(recipeCount).toContainText("0");
    await expect(
      page.getByRole("heading", {
        level: 2,
        name: "Recipes",
        exact: true,
      })
    ).toHaveCount(0);
    await expect(page.getByText("No recipes yet")).toHaveCount(0);
  });
});
