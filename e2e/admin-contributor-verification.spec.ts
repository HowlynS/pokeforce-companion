import { expect, test } from "@playwright/test";
import {
  E2E_CURRENT_GAME_VERSION_NAME,
  deleteE2eTestItemRecords,
  readE2eItemVerification,
  setE2eTestAdminRole,
} from "./helpers/database-cleanup";

const CONTRIBUTOR_ITEM = {
  name: "Test E2E Item Contributor Verification",
  slug: "test-e2e-item-contributor-verification",
} as const;

test.describe.serial("Contributor gameplay verification", () => {
  test.beforeAll(async () => {
    await deleteE2eTestItemRecords();
  });

  test.afterEach(async () => {
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

  test("Contributor can explicitly verify and ordinary edits preserve the stamp", async ({
    page,
  }) => {
    await setE2eTestAdminRole("CONTRIBUTOR");

    await page.goto("/admin/items/new");
    await expect(page).toHaveURL("/admin/items/new");

    const adminNav = page.getByRole("navigation", { name: "Admin navigation" });
    await expect(adminNav.getByText("Site administration")).toHaveCount(0);
    for (const restrictedLabel of [
      "Game Versions",
      "Appearance",
      "Design review",
      "Users & access",
      "Audit log",
    ]) {
      await expect(
        adminNav.getByText(restrictedLabel, { exact: true })
      ).toHaveCount(0);
    }

    const createVerificationCheckbox = page.locator(
      'input[type="checkbox"][name="markVerified"]'
    );
    await expect(createVerificationCheckbox).toBeVisible();
    await expect(createVerificationCheckbox).not.toBeChecked();
    await expect(
      createVerificationCheckbox.locator("xpath=ancestor::label")
    ).toContainText(`Mark as verified for ${E2E_CURRENT_GAME_VERSION_NAME}`);

    await page.getByLabel("Name", { exact: true }).fill(CONTRIBUTOR_ITEM.name);
    await page.getByLabel(/^Page address/).fill(CONTRIBUTOR_ITEM.slug);
    await page.getByRole("button", { name: "Create item", exact: true }).click();
    await expect(page).toHaveURL(
      `/admin/items/${CONTRIBUTOR_ITEM.slug}/edit`
    );

    expect(await readE2eItemVerification(CONTRIBUTOR_ITEM.slug)).toEqual({
      verifiedAt: null,
      verifiedGameVersionId: null,
      verifiedGameVersionName: null,
    });

    const editVerificationCheckbox = page.locator(
      'input[type="checkbox"][name="markVerified"]'
    );
    await expect(editVerificationCheckbox).toBeVisible();
    await expect(editVerificationCheckbox).not.toBeChecked();
    await editVerificationCheckbox.check();
    await page.getByRole("button", { name: "Save Changes", exact: true }).click();
    await expect(page).toHaveURL(
      `/admin/items/${CONTRIBUTOR_ITEM.slug}/edit`
    );
    await page.waitForTimeout(500);

    const verified = await readE2eItemVerification(CONTRIBUTOR_ITEM.slug);
    expect(verified.verifiedAt).not.toBeNull();
    expect(verified.verifiedGameVersionId).not.toBeNull();
    expect(verified.verifiedGameVersionName).toBe(E2E_CURRENT_GAME_VERSION_NAME);

    await expect(editVerificationCheckbox).not.toBeChecked();
    await page
      .getByRole("textbox", { name: "Description (optional)", exact: true })
      .fill("Ordinary Contributor edit preserves verification metadata.");
    await page.getByRole("button", { name: "Save Changes", exact: true }).click();
    await expect(page).toHaveURL(
      `/admin/items/${CONTRIBUTOR_ITEM.slug}/edit`
    );
    await page.waitForTimeout(500);
    expect(await readE2eItemVerification(CONTRIBUTOR_ITEM.slug)).toEqual(verified);

    await page.goto(`/admin/items/${CONTRIBUTOR_ITEM.slug}/delete`);
    await expect(page).toHaveURL("/access-denied");
    await expect(
      page.getByRole("heading", { level: 1, name: "Permission required" })
    ).toBeVisible();

    await page.goto("/admin/users");
    await expect(page).toHaveURL("/access-denied");
  });
});
