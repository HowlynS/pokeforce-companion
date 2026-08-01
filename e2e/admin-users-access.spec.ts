import { expect, test } from "@playwright/test";

test("Owner can open Users & access without exposing credentials", async ({ page }) => {
  await page.goto("/admin/users");
  await expect(page).toHaveURL("/admin/users");
  await expect(
    page.getByRole("heading", { level: 1, name: "Users & access" })
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Approved accounts" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();
  await expect(page.getByLabel("Temporary password")).toHaveValue("");
  await expect(page.getByText(/service.role|anon.key|auth.users/i)).toHaveCount(0);
});
