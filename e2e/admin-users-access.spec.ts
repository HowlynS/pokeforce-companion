import { expect, test } from "@playwright/test";
import {
  cleanupPermissionMemberFixture,
  ensurePermissionMemberFixture,
  getE2eTestAdminUserId,
  readPermissionMemberAuditActions,
  readRolePermissionFixtureAuditActions,
  resetRolePermissionFixture,
  setE2eTestAdminRole,
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
    await expect(personal.getByRole("button", { name: "Use role setting" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(permission).toContainText("Allowed through Member");

    await personal.getByRole("button", { name: "Allow" }).click();
    await expect(personal.getByRole("button", { name: "Allow" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(personal.getByRole("button", { name: "Allow" })).toBeFocused();
    await expect(permission).toContainText("Allowed for this member");
    await expect(permission).toContainText("Allowed");

    await personal.getByRole("button", { name: "Deny" }).click();
    await expect(personal.getByRole("button", { name: "Deny" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(personal.getByRole("button", { name: "Deny" })).toBeFocused();
    await expect(permission).toContainText("Denied for this member");
    await expect(permission).toContainText("Denied");

    await personal.getByRole("button", { name: "Use role setting" }).click();
    await expect(personal.getByRole("button", { name: "Use role setting" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(personal.getByRole("button", { name: "Use role setting" })).toBeFocused();
    await expect(permission).toContainText("Allowed through Member");
    await expect(permission).toContainText("Allowed");
    expect(await readPermissionMemberAuditActions()).toEqual([
      "security.personal_permission_allow",
      "security.personal_permission_deny",
      "security.personal_permission_inherit",
    ]);
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
      name: "Protected Owner Permissions",
    })
  ).toBeVisible();
  await expect(
    page.getByText("Manage Member Roles", { exact: true })
  ).toHaveCount(1);
  await expect(page.getByText("content.items.create", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Sensitive", { exact: true }).first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Manage Member Roles/ })
  ).toHaveCount(0);
  await expect(page.getByRole("link", { name: /^Owner/ })).toHaveCount(0);
});

test("Owner can change role policy without losing selection or focus", async ({
  page,
}) => {
  await resetRolePermissionFixture();

  try {
    await page.goto("/admin/users/roles?role=MEMBER");
    const allow = page.getByRole("button", {
      name: "Allow Access the Admin Workspace for Member",
    });
    await expect(allow).toHaveAttribute("aria-pressed", "false");
    await allow.click();

    const remove = page.getByRole("button", {
      name: "Remove Access the Admin Workspace for Member",
    });
    await expect(remove).toHaveAttribute("aria-pressed", "true");
    await expect(remove).toBeFocused();
    await expect(page).toHaveURL(/\/admin\/users\/roles\?role=MEMBER$/);
    await page.reload();
    await expect(remove).toHaveAttribute("aria-pressed", "true");

    await remove.click();
    await expect(allow).toHaveAttribute("aria-pressed", "false");
    await expect(allow).toBeFocused();
    await page.reload();
    await expect(allow).toHaveAttribute("aria-pressed", "false");
    expect(await readRolePermissionFixtureAuditActions()).toEqual([
      "security.role_permission_grant",
      "security.role_permission_revoke",
    ]);
  } finally {
    await resetRolePermissionFixture();
  }
});

test("Owner can assign every ordinary role but never Owner", async ({ page }) => {
  await cleanupPermissionMemberFixture();
  await ensurePermissionMemberFixture();

  try {
    await page.goto("/admin/users?q=Permission+Fixture");
    await page.getByRole("link", { name: "Open Permission Fixture" }).click();

    const role = page.getByRole("combobox", { name: "Ordinary role" });
    await role.click();
    await expect(page.getByRole("option", { name: "Owner", exact: true })).toHaveCount(0);
    await page.getByRole("option", { name: "Contributor", exact: true }).click();
    await page.getByRole("checkbox", { name: "Confirm role change" }).check();
    await page.getByRole("button", { name: "Update role" }).click();
    await expect(
      page.locator(".admin-status-badge", { hasText: /^Contributor$/ })
    ).toBeVisible();
    await expect(role).toContainText("Contributor");

    await role.click();
    await page.getByRole("option", { name: "Administrator", exact: true }).click();
    await page.getByRole("checkbox", { name: "Confirm role change" }).check();
    await page.getByRole("button", { name: "Update role" }).click();
    await expect(
      page.locator(".admin-status-badge", { hasText: /^Administrator$/ })
    ).toBeVisible();
    await expect(role).toContainText("Administrator");

    await role.click();
    await page.getByRole("option", { name: "Member", exact: true }).click();
    await page.getByRole("checkbox", { name: "Confirm role change" }).check();
    await page.getByRole("button", { name: "Update role" }).click();
    await expect(
      page.locator(".admin-status-badge", { hasText: /^Member$/ })
    ).toBeVisible();
    await expect(role).toContainText("Member");

    expect(await readPermissionMemberAuditActions()).toEqual([
      "access.role_change",
      "access.role_change",
      "access.role_change",
    ]);
  } finally {
    await cleanupPermissionMemberFixture();
  }
});

test("Owner detail presents system-protected access without mutation controls", async ({
  page,
}) => {
  const ownerId = await getE2eTestAdminUserId();
  await page.goto(`/admin/users/${ownerId}`);

  await expect(page.getByText(/Owner access is fixed by the Codex/)).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Ordinary role" })).toHaveCount(0);
  await expect(
    page.getByRole("group", {
      name: "Personal setting for Access the Private Codex",
    })
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Protected Owner Permissions" })
  ).toBeVisible();
  await expect(page.getByText("Allowed to Owner", { exact: true }).first()).toBeVisible();
});

test("Administrator can inspect access but cannot manage security", async ({ page }) => {
  await cleanupPermissionMemberFixture();
  await ensurePermissionMemberFixture();
  await setE2eTestAdminRole("ADMINISTRATOR");

  try {
    await page.goto("/admin/users?q=Permission+Fixture");
    await expect(page.getByRole("heading", { name: "Member directory" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Create account" })).toHaveCount(0);
    await page.getByRole("link", { name: "Open Permission Fixture" }).click();
    await expect(page.getByRole("combobox", { name: "Ordinary role" })).toHaveCount(0);
    await expect(
      page.getByRole("group", {
        name: "Personal setting for Access the Private Codex",
      })
    ).toHaveCount(0);
    await expect(page.getByText("Use role setting", { exact: true }).first()).toBeVisible();

    await page.goto("/admin/users/roles?role=ADMINISTRATOR");
    await expect(page.getByText(/Only the Owner can change role permissions/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Access the Admin Workspace for Administrator/ })
    ).toHaveCount(0);
  } finally {
    await setE2eTestAdminRole("OWNER");
    await cleanupPermissionMemberFixture();
  }
});
