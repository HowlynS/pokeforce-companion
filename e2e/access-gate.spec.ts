import { expect, test } from "@playwright/test";
import { Pool } from "pg";
import { loadTestEnvironment } from "../src/lib/testing/load-test-environment";

loadTestEnvironment();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function setVisibility(visibility: "PRIVATE_BETA" | "PUBLIC") {
  await pool.query(
    `INSERT INTO "SiteAccessSettings" ("id", "visibility", "createdAt", "updatedAt")
     VALUES ('site', $1::"SiteVisibility", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT ("id") DO UPDATE
     SET "visibility" = EXCLUDED."visibility", "updatedAt" = CURRENT_TIMESTAMP`,
    [visibility]
  );
}

test.describe.serial("private/public site gate", () => {
  test.beforeEach(async () => {
    await setVisibility("PRIVATE_BETA");
  });

  test.afterAll(async () => {
    // The remaining chromium project is the unauthenticated public
    // regression suite. Restore its shared baseline after exercising the
    // private gate so file order cannot strand every later route at login.
    await setVisibility("PUBLIC");
    await pool.end();
  });

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
    await setVisibility("PUBLIC");

    await page.goto("/items");
    await expect(page).toHaveURL("/items");
    await expect(page.getByRole("heading", { level: 1, name: "Items" })).toBeVisible();

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });

  test("switching back to private blocks the next anonymous request", async ({ page }) => {
    await setVisibility("PUBLIC");
    await page.goto("/recipes");
    await expect(page).toHaveURL("/recipes");

    await setVisibility("PRIVATE_BETA");
    await page.goto("/recipes");
    await expect(page).toHaveURL(/\/login\?next=/);
  });
});
