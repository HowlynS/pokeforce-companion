import { expect, test } from "@playwright/test";
import {
  requireSiteVisibility,
  setSiteVisibility,
} from "./helpers/site-visibility";

// This spec is the one place that deliberately drives BOTH visibility modes,
// so it owns its state explicitly: `perTest` re-establishes PRIVATE_BETA
// before each test (several tests below switch to PUBLIC mid-test), and the
// helper's afterAll returns the database to the PUBLIC baseline instead of
// stranding it in PRIVATE_BETA — the leak that used to redirect every
// later public spec to /login. Kept `.serial` because these tests mutate a
// shared singleton and must not interleave with each other.
test.describe.serial("private/public site gate", () => {
  requireSiteVisibility("PRIVATE_BETA", { perTest: true });

  for (const route of ["/", "/items", "/items/iron-ore", "/search?q=iron"]) {
    test(`private mode redirects anonymous ${route}`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login\?next=/);
      await expect(
        page.getByRole("heading", { level: 1, name: "Private beta sign-in" })
      ).toBeVisible();
      await expect(page.getByText(/Iron Ore/)).toHaveCount(0);
    });
  }

  test("private indexing endpoints reveal no gameplay routes", async ({ request }) => {
    const robots = await request.get("/robots.txt");
    expect(await robots.text()).toContain("Disallow: /");

    const sitemap = await request.get("/sitemap.xml");
    expect(await sitemap.text()).not.toContain("/items");
  });

  test("the login route exposes no signup or request-access flow", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByText(/sign up|register|request access/i)).toHaveCount(0);
  });

  test("public mode allows ordinary anonymous routes but keeps admin protected", async ({
    page,
  }) => {
    await setSiteVisibility("PUBLIC");

    await page.goto("/items");
    await expect(page).toHaveURL("/items");
    await expect(page.getByRole("heading", { level: 1, name: "Items" })).toBeVisible();

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });

  test("switching back to private blocks the next anonymous request", async ({ page }) => {
    await setSiteVisibility("PUBLIC");
    await page.goto("/recipes");
    await expect(page).toHaveURL("/recipes");

    await setSiteVisibility("PRIVATE_BETA");
    await page.goto("/recipes");
    await expect(page).toHaveURL(/\/login\?next=/);
  });
});
