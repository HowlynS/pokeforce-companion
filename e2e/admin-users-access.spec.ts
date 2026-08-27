import { expect, test } from "@playwright/test";
import {
  cleanupPermissionMemberFixture,
  ensurePermissionMemberFixture,
} from "./helpers/database-cleanup";

test("Owner can open Users & access without exposing credentials", async ({ page }) => {
  await page.goto("/admin/users");
  await expect(page).toHaveURL("/admin/users");
  await expect(
    page.getByRole("heading", { level: 1, name: "Users & access" })
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Member directory" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();
  await expect(page.getByLabel("Temporary password")).toHaveValue("");
  await expect(page.getByText(/service.role|anon.key|auth.users/i)).toHaveCount(0);
});

test("Owner can inspect a member and change a personal override", async ({
  page,
}) => {
  await cleanupPermissionMemberFixture();
  await ensurePermissionMemberFixture();

  try {
    await page.goto("/admin/users?q=Permission+Fixture");
    await page
      .getByRole("link", { name: "Open Permission Fixture" })
      .click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Permission Fixture" })
    ).toBeVisible();
    await expect(page.getByText(/test-e2e-permission-member(?!@)/i)).toHaveCount(
      0
    );

    const permission = page.getByRole("group", {
      name: "Access the Private Codex",
      exact: true,
    });
    const personal = permission.getByRole("group", {
      name: "Personal setting for Access the Private Codex",
    });
    await expect(personal.getByRole("button", { name: "Inherit" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(permission).toContainText("Role allows");

    await personal.getByRole("button", { name: "Deny" }).click();
    await expect(personal.getByRole("button", { name: "Deny" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(permission).toContainText("Personal deny");
    await expect(permission).toContainText("Denied");

    await personal.getByRole("button", { name: "Inherit" }).click();
    await expect(personal.getByRole("button", { name: "Inherit" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(permission).toContainText("Role allows");
    await expect(permission).toContainText("Allowed");
  } finally {
    await cleanupPermissionMemberFixture();
  }
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
