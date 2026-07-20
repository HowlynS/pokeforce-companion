// Authentication setup project: signs the dedicated test admin in through
// the REAL application login form and saves the browser storage state for
// the authenticated admin project. The fail-closed environment guard runs
// before the credentials are read, so a misconfigured environment can never
// leak a real password into a login attempt. Credentials, cookies, tokens,
// and the storage-state contents are never printed or asserted directly —
// secret-adjacent checks are boolean-only.

import { expect, test as setup } from "@playwright/test";
import { loadTestEnvironment } from "../src/lib/testing/load-test-environment";
import { ensureCurrentGameVersionFixture } from "./helpers/database-cleanup";

const ADMIN_STORAGE_STATE_PATH = "playwright/.auth/admin.json";

setup("authenticate as the test admin", async ({ page }) => {
  // Guard first: throws (secret-free message) unless .env.test.local points
  // at the isolated test project. Only then are the credentials read.
  loadTestEnvironment();
  const adminEmail = process.env.ADMIN_EMAIL as string;
  const adminPassword = process.env.TEST_ADMIN_PASSWORD as string;

  // Deterministic verification state for the whole run: the persistent
  // test-only Game Version fixture exists and is the ONLY current version
  // before any admin spec stamps gameplay data. (The helper runs the same
  // fail-closed environment guard before touching the database.)
  await ensureCurrentGameVersionFixture();

  await page.goto("/login");
  await expect(
    page.getByRole("heading", { level: 1, name: "Admin sign-in" })
  ).toBeVisible();

  await page.getByLabel("Email").fill(adminEmail);
  await page.getByLabel("Password").fill(adminPassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  // The sign-in server action redirects straight into the protected area.
  await expect(page).toHaveURL("/admin", { timeout: 15_000 });
  await expect(
    page.getByRole("heading", { level: 1, name: "Dashboard", exact: true })
  ).toBeVisible();
  await expect(
    page.locator('.admin-workspace-main a[href="/admin/categories"]')
  ).toBeVisible();

  // The filled password field must be gone before any state is saved (and
  // before a failure screenshot/trace could capture it).
  await expect(page.getByLabel("Password")).toHaveCount(0);

  await page.context().storageState({ path: ADMIN_STORAGE_STATE_PATH });
});
