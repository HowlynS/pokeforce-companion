// Non-destructive browser coverage for not-found behavior, unauthenticated
// admin protection, and the login page. Nothing signs in, no credentials
// are submitted, and no record, Auth user, or Storage object is touched.
// The missing slugs below are guaranteed absent from prisma/seed.ts.

import { expect, test } from "@playwright/test";

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

test.describe("not-found behavior", () => {
  const MISSING_ROUTES = [
    "/items/test-e2e-missing-item",
    "/recipes/test-e2e-missing-recipe",
  ] as const;

  for (const route of MISSING_ROUTES) {
    test(`${route} renders the not-found page with a 404 status`, async ({
      page,
    }) => {
      const response = await page.goto(route);

      expect(response?.status()).toBe(404);
      await expect(
        page.getByText("This page could not be found.")
      ).toBeVisible();
      // No raw exception or database error may leak into the page.
      await expect(page.getByText(/prisma/i)).toHaveCount(0);
      await expect(page.getByText(/unhandled|stack trace/i)).toHaveCount(0);
    });
  }
});

test.describe("unauthenticated admin protection", () => {
  // Each test uses Playwright's default fresh context: no cookies, no
  // stored session.
  const PROTECTED_ROUTES = ["/admin", "/admin/items"] as const;

  for (const route of PROTECTED_ROUTES) {
    test(`${route} redirects to the login page`, async ({ page }) => {
      await page.goto(route);

      await expect(page).toHaveURL("/login");
      await expect(
        page.getByRole("heading", { level: 2, name: "Admin sign-in" })
      ).toBeVisible();
    });
  }
});

test.describe("login page", () => {
  test("renders the sign-in form with no sign-up control and no session", async ({
    page,
    context,
  }) => {
    await page.goto("/login");

    await expect(
      page.getByRole("heading", { level: 2, name: "Admin sign-in" })
    ).toBeVisible();
    await expect(
      page.getByText("Sign in with the authorized administrator account.")
    ).toBeVisible();

    // Form controls, located by their accessible labels only.
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveAttribute("type", "email");
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByLabel("Password")).toHaveAttribute(
      "type",
      "password"
    );
    await expect(
      page.getByRole("button", { name: "Sign in", exact: true })
    ).toBeVisible();

    // Admin-only application: no public registration path may exist.
    await expect(page.getByRole("link", { name: /sign up/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /sign up/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /register/i })).toHaveCount(0);

    // The fresh browser context holds no authenticated Supabase session.
    // Cookie names embed the project ref, so only the count is asserted.
    const cookies = await context.cookies();
    const authCookieCount = cookies.filter((cookie) =>
      cookie.name.includes("auth-token")
    ).length;
    expect(authCookieCount).toBe(0);
  });
});
