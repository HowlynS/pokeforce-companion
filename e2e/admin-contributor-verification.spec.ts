// The Contributor role's access boundary against the REAL application and
// the isolated Supabase test project.
//
// This spec previously asserted that a Contributor could open the Item
// editor, create an Item, and stamp gameplay verification on it. That is no
// longer what a Contributor is. Under the validated permission model a
// Contributor holds exactly three permissions — site.access.private,
// contributions.submit and contributions.withdraw-own — and notably NOT
// admin.access, so every admin content route correctly answers
// /access-denied. The scenario the old tests described cannot happen, and
// the security contract is authoritative over the older expectation.
//
// Rather than delete the file, it now pins the boundary that IS real, which
// nothing else covered: a Contributor reaches no admin content route, sees
// no admin navigation, and cannot verify or delete Codex records. When the
// Contribution system lands, a Contributor's own proposal-and-verification
// journey belongs in a spec of its own, exercised through that system's
// routes rather than through the admin editor.

import { expect, test } from "@playwright/test";
import {
  deleteE2eTestItemRecords,
  setE2eTestAdminRole,
} from "./helpers/database-cleanup";

// Every admin surface a Contributor must not reach. Content routes,
// settings routes, and the security workspace alike.
const FORBIDDEN_ADMIN_ROUTES = [
  "/admin",
  "/admin/items",
  "/admin/items/new",
  "/admin/items/iron-ore/edit",
  "/admin/recipes",
  "/admin/locations",
  "/admin/settings/game-versions",
  "/admin/users",
  "/admin/audit-log",
] as const;

test.describe.serial("Contributor access boundary", () => {
  test.beforeAll(async () => {
    await deleteE2eTestItemRecords();
  });

  test.afterEach(async () => {
    // Restore the role FIRST: a later spec inheriting a Contributor admin
    // would fail in ways that look nothing like their own cause.
    try {
      await setE2eTestAdminRole("OWNER");
    } finally {
      await deleteE2eTestItemRecords();
    }
  });

  test.afterAll(async () => {
    await setE2eTestAdminRole("OWNER");
    await deleteE2eTestItemRecords();
  });

  test("a Contributor is refused every admin route, including the Item editor", async ({
    page,
  }) => {
    await setE2eTestAdminRole("CONTRIBUTOR");

    for (const route of FORBIDDEN_ADMIN_ROUTES) {
      await page.goto(route);
      await expect(page, `${route} must refuse a Contributor`).toHaveURL(
        "/access-denied"
      );
      await expect(
        page.getByRole("heading", { level: 1, name: "Permission required" })
      ).toBeVisible();
    }
  });

  test("a Contributor keeps ordinary reference access to the public Codex", async ({
    page,
  }) => {
    await setE2eTestAdminRole("CONTRIBUTOR");

    // site.access.private is the one thing a Contributor does hold, so the
    // public Codex stays open even while every admin route is closed.
    await page.goto("/items/iron-ore");
    await expect(page).toHaveURL("/items/iron-ore");
    await expect(
      page.getByRole("heading", { level: 1, name: "Iron Ore", exact: true })
    ).toBeVisible();

    // No admin affordance leaks into the public shell for this role.
    await expect(
      page.getByRole("navigation", { name: "Admin navigation" })
    ).toHaveCount(0);
  });

  test("the Owner is restored and reaches the admin workspace again", async ({
    page,
  }) => {
    // Proves the role switch above is genuinely reversible, so a failure in
    // this file can never quietly strand the shared test admin as a
    // Contributor for every spec that follows.
    await setE2eTestAdminRole("OWNER");

    await page.goto("/admin/items/new");
    await expect(page).toHaveURL("/admin/items/new");
    await expect(
      page.getByRole("heading", { level: 1, name: "Create item" })
    ).toBeVisible();
  });
});
