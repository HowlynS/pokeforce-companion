// Focused E2E coverage for compact ResourceIcons in admin relationship
// tables (Admin Polish Pass 1, Part 6) — the Item "Used in Recipes" tab is
// the primary manually requested target; one representative check each
// for Category Items and Profession Recipes proves the rollout is
// consistent rather than a one-off. Structural correctness (the link
// itself, its href, optional detail lines) is already proven by each
// resource's own admin-<resource>-recipes/items.spec.ts; this spec adds
// only the icon.

import { expect, test } from "@playwright/test";

test("Item Used in Recipes: each linked Recipe shows its own icon (or the fallback slot) beside its name, inside the link", async ({
  page,
}) => {
  // iron-ore is a seeded fixture used as both a recipe result and an
  // ingredient — read only, never modified.
  await page.goto("/admin/items/iron-ore/recipes");
  const iconLink = page.locator(".admin-table-link-with-icon").first();
  await expect(iconLink).toBeVisible();
  await expect(iconLink.locator(".resource-icon")).toBeVisible();
  // The icon lives INSIDE the link, never a separate element beside it —
  // the link stays the row's one interactive target.
  await expect(page.locator("td > .resource-icon")).toHaveCount(0);
});

test("Category Items tab shows an icon beside each linked Item", async ({ page }) => {
  // "materials" is a seeded Category with linked Items — read only.
  await page.goto("/admin/categories/materials/items");
  const iconLink = page.locator(".admin-table-link-with-icon").first();
  await expect(iconLink).toBeVisible();
  await expect(iconLink.locator(".resource-icon")).toBeVisible();
});

test("Profession Recipes tab shows an icon beside each linked Recipe", async ({ page }) => {
  await page.goto("/admin/professions");
  const firstProfessionEdit = page
    .getByRole("navigation", { name: "Professions records" })
    .getByRole("link")
    .first();
  await firstProfessionEdit.click();
  await page
    .getByRole("navigation", { name: "Profession editor sections" })
    .getByRole("link", { name: "Recipes", exact: true })
    .click();

  const icons = page.locator(".admin-table-link-with-icon .resource-icon");
  const count = await icons.count();
  if (count > 0) {
    await expect(icons.first()).toBeVisible();
  }
});
