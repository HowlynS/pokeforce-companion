import { expect, test, type Page } from "@playwright/test";
import {
  createE2ePublicLocationDirectoryFixtures,
  deleteE2ePublicLocationDirectoryFixtures,
} from "./helpers/database-cleanup";
import { requireSiteVisibility } from "./helpers/site-visibility";

// Anonymous public browsing is only reachable under PUBLIC visibility, so
// this spec establishes it rather than inheriting whatever mode the
// previously-run spec happened to leave behind.
requireSiteVisibility("PUBLIC");

let pageErrors: string[] = [];

test.beforeAll(async () => {
  await createE2ePublicLocationDirectoryFixtures();
});

test.afterAll(async () => {
  await deleteE2ePublicLocationDirectoryFixtures();
});

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(() => {
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
}

test("Locations catalogue renders the real root/type hierarchy without NPC data", async ({
  page,
}) => {
  await page.goto("/locations");

  await expect(page.getByRole("heading", { level: 1, name: "Locations" })).toBeVisible();
  // The region heading is the disclosure trigger; its page is reached through
  // the separate icon link beside it.
  await expect(
    page.getByRole("link", { name: "Open the Test E2E Northwind Region page" }),
  ).toHaveAttribute(
    "href",
    "/locations/test-e2e-location-public-directory-region",
  );
  await expect(
    page.getByRole("heading", { level: 3, name: "Route", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: /Test E2E Long Caravan Route Through the Amber Highlands/,
    }),
  ).toBeVisible();
  await expect(page.getByText(/NPC/i)).toHaveCount(0);

  // Location cards carry identity only — no shop-count filler.
  await expect(page.getByText("No shops")).toHaveCount(0);
  await expect(page.locator(".location-directory-card-meta")).toHaveCount(0);

  // Scoped to this fixture's own region band: the type label is the trigger.
  const region = page.locator(".location-directory-fold--region", {
    hasText: "Test E2E Northwind Region",
  });
  const routeToggle = region.getByRole("button", { name: "Route", exact: true });
  await routeToggle.click();
  await expect(routeToggle).toHaveAttribute("aria-expanded", "false");
  await expect(
    page.getByRole("link", {
      name: /Test E2E Long Caravan Route Through the Amber Highlands/,
    }),
  ).toBeHidden();
  await routeToggle.click();
  await expect(routeToggle).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByRole("link", {
      name: /Test E2E Long Caravan Route Through the Amber Highlands/,
    }),
  ).toBeVisible();
});

test("the region label toggles disclosure while its icon link navigates", async ({
  page,
}) => {
  await page.goto("/locations");

  const regionToggle = page.getByRole("button", {
    name: "Test E2E Northwind Region",
    exact: true,
  });
  const regionLink = page.getByRole("link", {
    name: "Open the Test E2E Northwind Region page",
  });

  // The label itself is the trigger — clicking it never navigates.
  await expect(regionToggle).toHaveAttribute("aria-expanded", "true");
  await regionToggle.click();
  await expect(regionToggle).toHaveAttribute("aria-expanded", "false");
  await expect(page).toHaveURL(/\/locations(\?|$)/);

  // Keyboard reaches both affordances independently.
  await regionToggle.focus();
  await page.keyboard.press("Enter");
  await expect(regionToggle).toHaveAttribute("aria-expanded", "true");

  await regionLink.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(
    "/locations/test-e2e-location-public-directory-region",
  );
});

test("the region page-link uses the canonical navigation arrow, and the disclosure chevron does not", async ({
  page,
}) => {
  await page.goto("/locations");

  const regionLink = page.getByRole("link", {
    name: "Open the Test E2E Northwind Region page",
  });

  // It is the shared page-link arrow control.
  await expect(regionLink).toHaveClass(/page-link-arrow/);

  // Resolve the gold tokens the way the browser does, so the comparison is
  // against the real design system rather than a hard-coded literal.
  const gold = await page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.display = "none";
    document.body.append(probe);
    const read = (token: string) => {
      probe.style.color = `var(${token})`;
      return getComputedStyle(probe).color;
    };
    const values = {
      accent: read("--color-accent"),
      accentSoft: read("--color-accent-soft"),
    };
    probe.remove();
    return values;
  });

  const rest = await regionLink.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      color: style.color,
      borderColor: style.borderTopColor,
      borderWidth: style.borderTopWidth,
    };
  });

  // Gold arrow, gold outline — at rest, not only on hover. The Region
  // heading uses the `quiet` weight (it sits beside the loudest thing on its
  // row), so both are drawn from the SAME gold tokens at reduced alpha
  // rather than swapped for another colour. Parsing the channels keeps this
  // a check on the design system rather than on a literal.
  const channels = (value: string) =>
    (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
  // color() reports 0-1 components, rgb() reports 0-255; compare as ratios.
  const normalise = (value: string) => {
    const parts = channels(value);
    const scale = value.startsWith("color(") ? 1 : 255;
    return parts.map((part) => Math.round((part / scale) * 100) / 100);
  };

  expect(normalise(rest.color), "the glyph is still the accent gold").toEqual(
    normalise(gold.accent)
  );
  expect(
    normalise(rest.borderColor),
    "the outline is still the soft accent gold"
  ).toEqual(normalise(gold.accentSoft));
  expect(rest.borderWidth).toBe("1px");
  // ...but both are held back, so the arrow yields to the region name.
  expect(rest.color, "the glyph is quieter than full strength").not.toBe(
    gold.accent
  );
  expect(
    rest.borderColor,
    "the outline is quieter than full strength"
  ).not.toBe(gold.accentSoft);

  await regionLink.focus();
  await expect(regionLink).not.toHaveCSS("outline-style", "none");

  // The disclosure chevron beside it is a DIFFERENT pattern: it opens local
  // content rather than navigating, so it must not have adopted the
  // navigation treatment.
  const chevron = page.locator(".location-directory-fold-chevron").first();
  await expect(chevron).toHaveCount(1);
  await expect(chevron).not.toHaveClass(/page-link-arrow/);
  await expect(chevron).toHaveCSS("border-top-width", "0px");
});

test("Location search and type filter are real GET controls", async ({ page }) => {
  await page.goto("/locations");

  const search = page.getByRole("searchbox", { name: "Find a location by name..." });
  await search.fill("Special Auction");
  await search.press("Enter");
  await expect(page).toHaveURL(/q=Special(?:\+|%20)Auction/);
  await expect(page.getByText("Test E2E Brassmarket Township")).toHaveCount(0);
  await expect(page.getByText(/Special Auction Annex/).first()).toBeVisible();

  await page.goto("/locations");
  await page.getByRole("button", { name: "Filter" }).click();
  await page.getByLabel("Route", { exact: true }).check();
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/type=ROUTE/);
  await expect(page.getByText(/Long Caravan Route/).first()).toBeVisible();
  await expect(page.getByText("Test E2E Brassmarket Township")).toHaveCount(0);
});

test("Locations catalogue has no horizontal overflow at all calibration widths", async ({
  page,
}) => {
  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 2560, height: 1440 },
    { width: 3440, height: 1440 },
    { width: 1000, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/locations");
    await expectNoHorizontalOverflow(page);
  }
});

test("Location detail renders direct children in the handoff grid/list directory", async ({
  page,
}) => {
  await page.goto("/locations/test-e2e-location-public-directory-region");

  await expect(
    page.getByRole("heading", { level: 1, name: "Test E2E Northwind Region" }),
  ).toBeVisible();
  const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
  await expect(breadcrumb.getByRole("link", { name: "Home" })).toHaveAttribute(
    "href",
    "/",
  );
  await expect(breadcrumb.getByRole("link", { name: "Locations" })).toHaveAttribute(
    "href",
    "/locations",
  );
  await expect(
    page.getByRole("heading", { level: 2, name: "Location Details" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Sub-locations" }),
  ).toBeVisible();
  await expect(page.getByText("3", { exact: true }).first()).toBeVisible();

  // Location detail carries its own verdant resource-atmosphere wash.
  const atmosphere = page.locator(".resource-atmosphere--location");
  await expect(atmosphere).toHaveCount(1);
  const atmosphereImage = await atmosphere.evaluate((element) =>
    getComputedStyle(element)
      .getPropertyValue("--resource-atmosphere-image")
      .trim(),
  );
  expect(atmosphereImage).not.toBe("none");
  expect(atmosphereImage).not.toBe("");

  await page.getByRole("button", { name: "List", exact: true }).click();
  await expect(page.locator(".location-detail-child-list-row")).toHaveCount(3);
  await page.getByRole("button", { name: "Sub-locations", exact: true }).click();
  await expect(page.locator(".location-detail-child-list-row")).toHaveCount(0);

  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.reload();
    await expectNoHorizontalOverflow(page);
  }
});

test("Location detail carries the shared verification card in its sidebar", async ({
  page,
}) => {
  await page.goto("/locations/test-e2e-location-public-directory-region");

  // Locations participate in the same structured verification system as
  // every other resource detail page: one card, in the page's own
  // information column, never a badge in the hero.
  const card = page.locator(".public-verification-card");
  await expect(card).toHaveCount(1);
  await expect(card).toBeVisible();
  await expect(
    page.locator(".location-detail-sidebar .public-verification-card"),
  ).toHaveCount(1);
  await expect(
    page.locator(".location-detail-hero .public-verification-card"),
  ).toHaveCount(0);
  await expect(card).toContainText(/Verified|Unverified/);

  // The sidebar collapses on narrow layouts; the card follows it to the end
  // of the page rather than breaking out of the layout.
  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 3440, height: 1440 },
    { width: 1100, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.reload();
    await expect(card).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
});
