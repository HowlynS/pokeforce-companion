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

test("Owner can inspect registry-derived role policy and protected safeguards", async ({
  page,
}) => {
  await page.goto("/admin/users/roles?role=CONTRIBUTOR");
  await expect(page).toHaveURL(/\/admin\/users\/roles\?role=CONTRIBUTOR$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Role policies" })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Contributor Propose changes/ })
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("heading", { level: 2, name: "Items" })
  ).toBeVisible();
  await expect(page.getByText("Create Items", { exact: true })).toHaveCount(1);
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: "Owner & system safeguards",
    })
  ).toBeVisible();
  await expect(
    page.getByText("Manage Member Roles", { exact: true })
  ).toHaveCount(1);
});
