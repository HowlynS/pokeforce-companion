// Non-destructive browser coverage for the public Classes index and detail
// pages, against the REAL isolated Supabase test project. Entirely
// read-only: every check reads the deterministic seed from prisma/seed.ts
// (exact counts confirmed directly against the test database before
// writing this spec), matching the established convention other public
// specs already use (e.g. public-details.spec.ts, admin-professions.spec.ts)
// rather than building a bespoke fixture — no record, Auth user, or
// Storage object is ever created or touched here.

import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { requireSiteVisibility } from "./helpers/site-visibility";

// Anonymous public browsing is only reachable under PUBLIC visibility, so
// this spec establishes it rather than inheriting whatever mode the
// previously-run spec happened to leave behind.
requireSiteVisibility("PUBLIC");

const SCREENSHOT_DIRECTORY = path.join(
  process.cwd(),
  "test-results",
  "recipe-class-domain-correction"
);

let pageErrors: string[] = [];

test.beforeAll(() => {
  fs.mkdirSync(SCREENSHOT_DIRECTORY, { recursive: true });
});

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(() => {
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

function cardLink(page: Page, name: string) {
  return page
    .getByRole("link")
    .filter({ has: page.getByRole("heading", { name, exact: true }) });
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth
      )
    )
    .toBe(true);
}

test.describe("public Classes index", () => {
  test("lists every seeded class as an independent full-card link", async ({
    page,
  }) => {
    await page.goto("/classes");

    await expect(
      page.getByRole("heading", { level: 1, name: "Classes", exact: true })
    ).toBeVisible();

    // The five foundational classes, matching the deterministic seed.
    for (const name of ["Trainer", "Artisan", "Rancher", "Ranger", "Farmhand"]) {
      await expect(cardLink(page, name)).toBeVisible();
    }

    const artisanCard = cardLink(page, "Artisan");
    await expect(artisanCard).toHaveAttribute("href", "/classes/artisan");
    await expect(page.getByText(/\d+ recipes?/)).toHaveCount(0);
  });

  test("is responsive with no horizontal overflow at desktop and mobile widths", async ({
    page,
  }) => {
    for (const viewport of [
      { width: 1920, height: 1080 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/classes");
      await expectNoHorizontalOverflow(page);
    }
  });
});

test.describe("public Class detail", () => {
  test("a populated class shows identity and verification without Recipe content", async ({
    page,
  }) => {
    await page.goto("/classes/artisan");

    await expect(
      page.getByRole("heading", { level: 1, name: "Artisan", exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Breadcrumb" })
    ).toContainText("Classes");

    await expect(page.locator(".profession-recipe-preview-row")).toHaveCount(0);
    await expect(page.locator(".recipe-output-card")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: /Browse all .* recipes/ })
    ).toHaveCount(0);
    await expect(page.locator(".profession-hero-counts")).toHaveCount(0);

    // Verification renders inline, factually (unverified seed data has no
    // stamp).
    await expect(
      page.getByRole("heading", { level: 2, name: "Verification", exact: true })
    ).toBeVisible();

    // Class detail carries its own crimson resource-atmosphere wash,
    // distinct from Profession's amethyst even though both pages share
    // the same underlying hero markup/CSS classes.
    const atmosphere = page.locator(".resource-atmosphere--class");
    await expect(atmosphere).toHaveCount(1);
    const atmosphereImage = await atmosphere.evaluate((element) =>
      getComputedStyle(element)
        .getPropertyValue("--resource-atmosphere-image")
        .trim()
    );
    expect(atmosphereImage).not.toBe("none");
    expect(atmosphereImage).not.toBe("");

    for (const viewport of [
      { name: "desktop-1920x1080", width: 1920, height: 1080 },
      { name: "mobile-390x844", width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await page.reload();
      await expectNoHorizontalOverflow(page);
      await page.screenshot({
        path: path.join(
          SCREENSHOT_DIRECTORY,
          `class-detail-${viewport.name}.png`
        ),
        fullPage: true,
      });
    }
  });

  test("a sparse class remains coherent without Recipe-derived sections", async ({
    page,
  }) => {
    await page.goto("/classes/rancher");

    await expect(
      page.getByRole("heading", { level: 1, name: "Rancher", exact: true })
    ).toBeVisible();
    await expect(page.locator(".profession-hero-counts")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { level: 2, name: "Recipes", exact: true })
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: /Browse all .* recipes/ })
    ).toHaveCount(0);
  });

  test("an unknown class slug 404s with the public not-found shell", async ({
    page,
  }) => {
    const response = await page.goto("/classes/not-a-real-class");

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
  });

  test("is responsive with no horizontal overflow at desktop, intermediate, and mobile widths", async ({
    page,
  }) => {
    for (const viewport of [
      { width: 1920, height: 1080 },
      { width: 3440, height: 1440 },
      { width: 1000, height: 1000 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/classes/artisan");
      await expectNoHorizontalOverflow(page);
    }
  });
});
