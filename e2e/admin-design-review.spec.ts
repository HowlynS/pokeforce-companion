import { expect, test } from "@playwright/test";

// The focused public-design command prepares fixtures before Playwright starts
// the Next server. Keeping database setup outside this worker avoids opening a
// second Prisma pool while the isolated dev server already owns one.

test("Design review is discoverable, allowlisted, and renders one real public route", async ({
  page,
}) => {
  await page.goto(
    "/admin/design-review?contract=item-detail&fixture=item-no-image&viewport=mobile-390"
  );

  await expect(
    page.getByRole("heading", { level: 1, name: "Design review" })
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Admin navigation" })
      .getByRole("link", { name: "Design review", exact: true })
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("Contract expectations")).toBeVisible();
  await expect(
    page.locator(".design-review-preview-toolbar").getByText(/390×844 · \d+% scale/)
  ).toBeVisible();

  const preview = page.getByTitle(
    "Design review preview: Item detail — No-image Item detail"
  );
  await expect(preview).toHaveAttribute(
    "src",
    "/items/design-review-item-no-image-long-name"
  );
  await expect(
    preview.contentFrame().getByRole("heading", {
      level: 1,
      name: /Extremely Long Unillustrated Component Name/,
    })
  ).toBeVisible();
});

test("invalid query selections fall back to registered defaults", async ({ page }) => {
  await page.goto(
    "/admin/design-review?contract=item-detail&fixture=shop-dense&viewport=unknown"
  );

  await expect(page).toHaveURL(
    /contract=item-detail&fixture=item-dense&viewport=desktop-1920/
  );
  const preview = page.getByTitle(
    "Design review preview: Item detail — Dense Item detail"
  );
  await expect(preview).toHaveAttribute("src", "/items/design-review-item-dense");
  await expect(page.locator('iframe[src^="http"]')).toHaveCount(0);
});

test("workspace and preview remain overflow-free at an intermediate width", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1000, height: 1100 });
  await page.goto(
    "/admin/design-review?contract=recipe-detail&fixture=recipe-many-ingredients&viewport=intermediate-1000"
  );
  await expect(
    page.locator(".design-review-preview-toolbar").getByText(/1000×1100 · \d+% scale/)
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth)
  ).toBeLessThanOrEqual(await page.evaluate(() => document.documentElement.clientWidth));
  const preview = page.getByTitle(
    "Design review preview: Recipe detail — Recipe with many ingredients"
  );
  expect(
    await preview.contentFrame().locator("html").evaluate((element) => element.scrollWidth)
  ).toBeLessThanOrEqual(
    await preview.contentFrame().locator("html").evaluate((element) => element.clientWidth)
  );
});
