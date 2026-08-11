// Non-destructive browser coverage for the public global search: the
// header entry point, the /search page states, and result links. Read-only:
// nothing signs in and only GET forms are submitted, so no record, Auth
// user, or Storage object is touched. Runs unauthenticated in the public
// chromium project (the filename carries no admin- prefix). Seeded
// names/slugs come from prisma/seed.ts.

import { expect, test, type Page } from "@playwright/test";

// Browser error hygiene: any uncaught page error fails the test. Serial
// single-worker execution makes this module-level state safe.
let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(() => {
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

// The card component renders its title as an h3 inside the card link.
function cardLink(page: Page, name: string) {
  return page
    .getByRole("link")
    .filter({ has: page.getByRole("heading", { level: 3, name, exact: true }) });
}

// Both the header and the /search page contain a search form; scope every
// locator to its landmark so the two never collide.
function headerSearchInput(page: Page) {
  return page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("searchbox", { name: "Search query" });
}

function pageSearchInput(page: Page) {
  return page.getByRole("main").getByRole("searchbox", { name: "Search query" });
}

const PUBLIC_SEARCH_SURFACES = [
  "/items",
  "/recipes",
  "/professions",
  "/classes",
  "/locations",
  "/shops",
  "/search",
] as const;

type SearchInteractionState = {
  animationDuration: string;
  animationName: string;
  animationTimingFunction: string;
  backgroundColor: string;
  borderColor: string;
  boxShadow: string;
  placeholderColor: string;
  transitionDuration: string;
  transitionTimingFunction: string;
};

async function searchInteractionState(
  input: ReturnType<typeof pageSearchInput>,
): Promise<SearchInteractionState> {
  return input.evaluate((element) => {
    const frame = element.parentElement;
    if (!frame?.classList.contains("public-search-field")) {
      throw new Error("Search input is missing the shared public field frame.");
    }

    const frameStyle = getComputedStyle(frame);
    const placeholderStyle = getComputedStyle(element, "::placeholder");
    return {
      animationDuration: frameStyle.animationDuration,
      animationName: frameStyle.animationName,
      animationTimingFunction: frameStyle.animationTimingFunction,
      backgroundColor: frameStyle.backgroundColor,
      borderColor: frameStyle.borderColor,
      boxShadow: frameStyle.boxShadow,
      placeholderColor: placeholderStyle.color,
      transitionDuration: frameStyle.transitionDuration,
      transitionTimingFunction: frameStyle.transitionTimingFunction,
    };
  });
}

async function searchIconState(input: ReturnType<typeof pageSearchInput>) {
  const iconPart = input.locator("..").locator("svg *").first();
  return iconPart.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      stroke: style.stroke,
      transitionDuration: style.transitionDuration,
      transitionTimingFunction: style.transitionTimingFunction,
    };
  });
}

test("the header search form reaches /search with the submitted query", async ({
  page,
}) => {
  await page.goto("/");

  await headerSearchInput(page).fill("iron");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Search", exact: true })
    .click();

  await expect(page).toHaveURL("/search?q=iron");
  await expect(
    page.getByRole("heading", { level: 1, name: "Search", exact: true })
  ).toBeVisible();
  await expect(cardLink(page, "Iron Ore")).toBeVisible();
});

test("every public search surface reuses the header interaction at 1920x1080", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1920, height: 1080 });

  for (const path of PUBLIC_SEARCH_SURFACES) {
    await page.goto(path);

    const headerInput = headerSearchInput(page);
    const publicInput = page.getByRole("main").getByRole("searchbox");
    const headerFrame = headerInput.locator("..");
    const publicFrame = publicInput.locator("..");

    await expect(headerFrame).toHaveClass(/\bpublic-search-field\b/);
    await expect(publicFrame).toHaveClass(/\bpublic-search-field\b/);

    const headerDefault = await searchInteractionState(headerInput);
    const publicDefault = await searchInteractionState(publicInput);
    expect(publicDefault.transitionDuration).toBe(
      headerDefault.transitionDuration,
    );
    expect(publicDefault.transitionTimingFunction).toBe(
      headerDefault.transitionTimingFunction,
    );
    expect(publicDefault.placeholderColor).toBe(headerDefault.placeholderColor);
    if (path !== "/search") {
      const headerIconDefault = await searchIconState(headerInput);
      const publicIconDefault = await searchIconState(publicInput);
      expect(publicIconDefault.transitionDuration).toBe(
        headerIconDefault.transitionDuration,
      );
      expect(publicIconDefault.transitionTimingFunction).toBe(
        headerIconDefault.transitionTimingFunction,
      );
    }

    await headerFrame.hover();
    await page.waitForTimeout(260);
    const headerHover = await searchInteractionState(headerInput);
    await publicFrame.hover();
    await page.waitForTimeout(260);
    const publicHover = await searchInteractionState(publicInput);
    expect(publicHover.borderColor).toBe(headerHover.borderColor);
    expect(publicHover.animationName).toBe(headerHover.animationName);
    expect(publicHover.animationDuration).toBe(headerHover.animationDuration);
    expect(publicHover.animationTimingFunction).toBe(
      headerHover.animationTimingFunction,
    );

    await headerInput.focus();
    await page.waitForTimeout(260);
    const headerFocus = await searchInteractionState(headerInput);
    const headerIconFocus =
      path === "/search" ? null : await searchIconState(headerInput);
    await publicInput.focus();
    await page.waitForTimeout(260);
    const publicFocus = await searchInteractionState(publicInput);
    expect(publicFocus.borderColor).toBe(headerFocus.borderColor);
    expect(publicFocus.backgroundColor).toBe(headerFocus.backgroundColor);
    expect(publicFocus.boxShadow).toBe(headerFocus.boxShadow);
    expect(publicFocus.animationName).toBe(headerFocus.animationName);
    if (headerIconFocus) {
      const publicIconFocus = await searchIconState(publicInput);
      expect(publicIconFocus.stroke).toBe(headerIconFocus.stroke);
    }
  }
});

test("reduced motion disables the shared public search transitions and pulse", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1920, height: 1080 });

  for (const path of PUBLIC_SEARCH_SURFACES) {
    await page.goto(path);
    const input = page.getByRole("main").getByRole("searchbox");
    await input.locator("..").hover();
    const state = await searchInteractionState(input);

    expect(state.transitionDuration).toBe("0s");
    expect(state.animationName).toBe("none");
  }
});

test("visiting /search without a query shows the empty-query guidance", async ({
  page,
}) => {
  await page.goto("/search");

  await expect(
    page.getByRole("heading", { level: 3, name: "Start searching" })
  ).toBeVisible();
  // The guidance names every searchable resource type and the relational
  // paths (asserted on its unique tail — the page header paragraph shares
  // the resource-type phrasing).
  await expect(
    page.getByText(
      "Search Items, Recipes, Professions, Categories, Locations, Shops, and Classes by name or description — for example a material like iron."
    )
  ).toBeVisible();
  await expect(
    page.getByText(
      "Recipes are also found through their resulting item, profession, or ingredients."
    )
  ).toBeVisible();
  await expect(pageSearchInput(page)).toHaveValue("");

  // Submitting the still-empty page form stays in the guidance state.
  await page
    .getByRole("main")
    .getByRole("button", { name: "Search", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { level: 3, name: "Start searching" })
  ).toBeVisible();
});

test("a seeded query returns grouped items and recipes with counts", async ({
  page,
}) => {
  await page.goto("/search?q=iron");

  // Items group: Iron Ingot, Iron Ore, Iron Sword.
  await expect(
    page.getByRole("heading", { level: 2, name: "Items (3)", exact: true })
  ).toBeVisible();
  await expect(cardLink(page, "Iron Ore")).toBeVisible();
  await expect(cardLink(page, "Iron Ore")).toHaveAttribute(
    "href",
    "/items/iron-ore"
  );

  // Recipes group: Iron Ingot and Iron Sword by name, plus Reinforced
  // Shield relationally through its Iron Ingot ingredient (with a context
  // line saying so). Same-named cards (item + recipe) are told apart by
  // their hrefs.
  await expect(
    page.getByRole("heading", { level: 2, name: "Recipes (3)", exact: true })
  ).toBeVisible();
  await expect(cardLink(page, "Iron Sword")).toHaveCount(2);
  await expect(
    cardLink(page, "Reinforced Shield").getByText("Ingredient: Iron Ingot")
  ).toBeVisible();

  // No profession, category, or location matches "iron": those groups are
  // omitted.
  await expect(
    page.getByRole("heading", { level: 2, name: /^Professions/ })
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 2, name: /^Categories/ })
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 2, name: /^Locations/ })
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 2, name: /^Shops/ })
  ).toHaveCount(0);

  // The submitted query is retained in the page form.
  await expect(pageSearchInput(page)).toHaveValue("iron");
});

test("a result card links to the existing public detail page", async ({
  page,
}) => {
  await page.goto("/search?q=whetstone");

  await cardLink(page, "Whetstone").click();

  await expect(page).toHaveURL("/items/whetstone");
  await expect(
    page.getByRole("heading", { level: 1, name: "Whetstone", exact: true })
  ).toBeVisible();
});

test("matching is case-insensitive", async ({ page }) => {
  await page.goto("/search?q=IRON");

  await expect(
    page.getByRole("heading", { level: 2, name: "Items (3)", exact: true })
  ).toBeVisible();
  await expect(cardLink(page, "Iron Ore")).toBeVisible();
});

test("surrounding whitespace is trimmed from the query", async ({ page }) => {
  await page.goto("/search");

  await pageSearchInput(page).fill("  iron  ");
  await page
    .getByRole("main")
    .getByRole("button", { name: "Search", exact: true })
    .click();

  // The trimmed query still matches, and the input shows the trimmed value.
  await expect(cardLink(page, "Iron Ore")).toBeVisible();
  await expect(pageSearchInput(page)).toHaveValue("iron");
});

test("descriptions are searched where the field exists", async ({ page }) => {
  // "potions" appears only in the Consumables category description and the
  // Alchemy profession description.
  await page.goto("/search?q=potions");

  await expect(
    page.getByRole("heading", { level: 2, name: "Professions (1)", exact: true })
  ).toBeVisible();
  await expect(cardLink(page, "Alchemy")).toHaveAttribute(
    "href",
    "/professions/alchemy"
  );
  await expect(
    page.getByRole("heading", { level: 2, name: "Categories (1)", exact: true })
  ).toBeVisible();
  await expect(cardLink(page, "Consumables")).toHaveAttribute(
    "href",
    "/categories/consumables"
  );
});

test("searching a category name returns its items with match context", async ({
  page,
}) => {
  // No seeded item text contains "gear"; the three Gear items match
  // through their category relation.
  await page.goto("/search?q=gear");

  await expect(
    page.getByRole("heading", { level: 2, name: "Items (3)", exact: true })
  ).toBeVisible();
  await expect(
    cardLink(page, "Copper Dagger").getByText("Category: Gear")
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Categories (1)", exact: true })
  ).toBeVisible();
  await expect(cardLink(page, "Gear")).toHaveAttribute(
    "href",
    "/categories/gear"
  );
});

test("searching an ingredient item name returns the recipes that use it", async ({
  page,
}) => {
  // Three seeded recipes consume Leather Strap; none carries "leather" in
  // its own name.
  await page.goto("/search?q=leather");

  await expect(
    page.getByRole("heading", { level: 2, name: "Recipes (3)", exact: true })
  ).toBeVisible();
  await expect(
    cardLink(page, "Iron Sword").getByText("Ingredient: Leather Strap")
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Items (1)", exact: true })
  ).toBeVisible();
  await expect(cardLink(page, "Leather Strap")).toBeVisible();
});

test("searching a profession name returns its recipes, linked to their detail pages", async ({
  page,
}) => {
  // Both Alchemy recipes match relationally; neither name contains
  // "alchemy".
  await page.goto("/search?q=alchemy");

  await expect(
    page.getByRole("heading", { level: 2, name: "Recipes (2)", exact: true })
  ).toBeVisible();
  await expect(
    cardLink(page, "Stamina Brew").getByText("Profession: Alchemy")
  ).toBeVisible();

  // The relational result links to the existing recipe detail page.
  await cardLink(page, "Stamina Brew").click();
  await expect(page).toHaveURL("/recipes/stamina-brew");
  await expect(
    page.getByRole("heading", { level: 1, name: "Stamina Brew", exact: true })
  ).toBeVisible();
});

test("a query with no matches shows actionable no-results guidance with the query", async ({
  page,
}) => {
  await page.goto("/search?q=test-e2e-no-such-thing");

  await expect(
    page.getByRole("heading", { level: 3, name: "No results" })
  ).toBeVisible();
  // The message names the query safely and suggests a concrete next step.
  await expect(
    page.getByText(
      'No items, recipes, professions, categories, locations, shops, or classes matched "test-e2e-no-such-thing".'
    )
  ).toBeVisible();
  await expect(
    page.getByText("Check the spelling or try a shorter, broader term.")
  ).toBeVisible();
  // The form stays populated so the query can be edited directly.
  await expect(pageSearchInput(page)).toHaveValue("test-e2e-no-such-thing");
});

test("a non-empty query gets a results heading and a displayed-results summary", async ({
  page,
}) => {
  await page.goto("/search?q=iron");

  // The results heading names the submitted query...
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: 'Search results for "iron"',
      exact: true,
    })
  ).toBeVisible();
  // ...and the summary counts what is displayed: 3 items + 3 recipes in
  // 2 non-empty groups ("Showing", because groups are capped at ten).
  await expect(
    page.getByText("Showing 6 results across 2 resource types.")
  ).toBeVisible();
});

test("the two search forms expose distinguishable accessible names", async ({
  page,
}) => {
  await page.goto("/search");

  // Two search landmarks on one page: the compact header form and the
  // page's own form, each with its own accessible name.
  await expect(
    page.getByRole("search", { name: "Site search" })
  ).toBeVisible();
  await expect(
    page.getByRole("search", { name: "Search the wiki" })
  ).toBeVisible();
});

test("search stays usable at a narrow mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await page.goto("/search?q=iron");

  // Results and both forms remain visible and operable.
  await expect(cardLink(page, "Iron Ore")).toBeVisible();
  await expect(headerSearchInput(page)).toBeVisible();

  // A follow-up search through the page form works at this width.
  await pageSearchInput(page).fill("gear");
  await page
    .getByRole("main")
    .getByRole("button", { name: "Search", exact: true })
    .click();
  await expect(page).toHaveURL("/search?q=gear");
  await expect(cardLink(page, "Reinforced Shield")).toBeVisible();
});
