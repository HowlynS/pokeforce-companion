// Focused E2E coverage for the shortened "+ New" record-list create button
// (Admin Polish Pass 1, Part 7), checked at a deliberately narrow desktop
// width — the exact scenario the shortening was meant to help — across
// all five converted resources, plus a structural check that no full
// editor submit label (e.g. "Create Item") was accidentally shortened too.

import { expect, test } from "@playwright/test";

const NARROW_WIDTH = { width: 1280, height: 800 };

const RESOURCES = [
  { path: "/admin/items", nav: "Items records" },
  { path: "/admin/recipes", nav: "Recipes records" },
  { path: "/admin/professions", nav: "Professions records" },
  { path: "/admin/categories", nav: "Categories records" },
  { path: "/admin/locations", nav: "Locations records" },
] as const;

for (const resource of RESOURCES) {
  test(`${resource.path}: the create button reads exactly "+ New" and fits at a narrow desktop width`, async ({
    page,
  }) => {
    await page.setViewportSize(NARROW_WIDTH);
    await page.goto(resource.path);

    const createLink = page.getByRole("link", { name: "+ New", exact: true });
    await expect(createLink).toBeVisible();

    const box = await createLink.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(NARROW_WIDTH.width);
  });
}

test("full editor submit labels are unaffected by the shortening", async ({ page }) => {
  await page.goto("/admin/items/new");
  await expect(
    page.getByRole("button", { name: "Create item", exact: true })
  ).toBeVisible();

  await page.goto("/admin/recipes/new");
  await expect(
    page.getByRole("button", { name: "Create Recipe", exact: true })
  ).toBeVisible();
});
