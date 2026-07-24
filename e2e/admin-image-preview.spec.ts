// Focused E2E coverage for ImagePanel's immediate client-side preview
// (Admin Polish Pass 1, Part 4). Upload/replace/removal/validation
// behavior itself is already proven end-to-end by each resource's own
// admin-<resource>-images.spec.ts (server round trip, Supabase Storage
// object lifecycle); this spec adds what those don't: that the preview
// updates BEFORE any save, using only a local object URL, on both create
// and edit forms, across a select/replace/remove/reverse cycle.

import path from "node:path";
import { expect, test } from "@playwright/test";
import { deleteE2eTestItemRecords } from "./helpers/database-cleanup";

const PNG_FIXTURE = path.join(__dirname, "fixtures", "tiny-valid.png");
const WEBP_FIXTURE = path.join(__dirname, "fixtures", "tiny-valid.webp");

let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.beforeAll(async () => {
  await deleteE2eTestItemRecords();
});

test.afterEach(async () => {
  await deleteE2eTestItemRecords();
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

test.afterAll(async () => {
  expect(await deleteE2eTestItemRecords()).toBe(0);
});

test("selecting a file on the create form previews it immediately via a local object URL, and marks the form dirty", async ({
  page,
}) => {
  await page.goto("/admin/items/new");
  await expect(page.getByText("No image uploaded.")).toBeVisible();

  await page.locator('input[type="file"][name="image"]').setInputFiles(PNG_FIXTURE);

  const preview = page.locator("img.admin-image-preview-lg");
  await expect(preview).toBeVisible();
  await expect(preview).toHaveAttribute("src", /^blob:/);
  await expect(page.getByText("tiny-valid.png")).toBeVisible();
  await expect(page.getByText("Unsaved changes", { exact: true })).toBeVisible();
});

test("choosing a replacement file swaps the preview and revokes the previous object URL", async ({
  page,
}) => {
  await page.goto("/admin/items/new");
  const fileInput = page.locator('input[type="file"][name="image"]');
  await fileInput.setInputFiles(PNG_FIXTURE);
  const preview = page.locator("img.admin-image-preview-lg");
  const firstSrc = await preview.getAttribute("src");

  // A genuinely different file (a different fixture, not the identical
  // path re-selected) — revocation check: the first object URL must stop
  // resolving once replaced (a revoked blob: URL fails to load).
  await fileInput.setInputFiles(WEBP_FIXTURE);
  const secondSrc = await preview.getAttribute("src");
  expect(secondSrc).toMatch(/^blob:/);
  expect(secondSrc).not.toBe(firstSrc);

  const firstUrlStillValid = await page.evaluate(async (url) => {
    try {
      const response = await fetch(url as string);
      return response.ok;
    } catch {
      return false;
    }
  }, firstSrc);
  expect(firstUrlStillValid).toBe(false);
});

test("remove clears the preview immediately on an existing image, and reversing it restores the saved preview", async ({
  page,
}) => {
  await page.goto("/admin/items/new");
  await page.getByLabel("Name", { exact: true }).fill("Test E2E Item Preview Cycle");
  await page.getByLabel(/^Page address/).fill("test-e2e-item-preview-cycle");
  await page.locator('input[type="file"][name="image"]').setInputFiles(PNG_FIXTURE);
  await page.getByRole("button", { name: "Create item", exact: true }).click();
  // Creation redirects straight to the new item's own editor (Admin
  // Polish Pass 2, Part 2) — already here, so no redundant re-navigation.
  await expect(page).toHaveURL("/admin/items/test-e2e-item-preview-cycle/edit");
  const preview = page.locator("img.admin-image-preview-lg");
  await expect(preview).toBeVisible();
  const savedSrc = await preview.getAttribute("src");
  expect(savedSrc).not.toMatch(/^blob:/);

  await page.getByTitle("Remove image").click();
  await expect(page.locator("img.admin-image-preview-lg")).toHaveCount(0);
  await expect(page.getByText("No image uploaded.")).toBeVisible();
  await expect(page.getByText("Image will be removed when saved.")).toBeVisible();

  // Reversing removal restores the exact saved preview. The note stays in
  // the DOM either way (CSS display:none via the checkbox's own :checked
  // sibling selector) — visibility, not raw count, is the correct check.
  await page.getByTitle("Remove image").click();
  await expect(page.locator("img.admin-image-preview-lg")).toHaveAttribute(
    "src",
    savedSrc as string
  );
  await expect(
    page.getByText("Image will be removed when saved.")
  ).not.toBeVisible();
});

test("Cancel/navigation away leaves the persisted image unchanged", async ({ page }) => {
  await page.goto("/admin/items/new");
  await page.getByLabel("Name", { exact: true }).fill("Test E2E Item Preview Cancel");
  await page.getByLabel(/^Page address/).fill("test-e2e-item-preview-cancel");
  await page.getByRole("button", { name: "Create item", exact: true }).click();
  // Creation redirects straight to the new item's own editor (Admin
  // Polish Pass 2, Part 2) — already here, so no redundant re-navigation.
  await expect(page).toHaveURL("/admin/items/test-e2e-item-preview-cancel/edit");
  await expect(page.getByText("No image uploaded.")).toBeVisible();
  await page.locator('input[type="file"][name="image"]').setInputFiles(PNG_FIXTURE);
  await expect(page.locator("img.admin-image-preview-lg")).toBeVisible();

  // Discard the unsaved selection via Cancel.
  await page.getByRole("link", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Discard changes", exact: true }).click();
  await expect(page).toHaveURL("/admin/items");

  await page.goto("/admin/items/test-e2e-item-preview-cancel/edit");
  await expect(page.getByText("No image uploaded.")).toBeVisible();
});

test("selecting a file on the edit form of a record with no existing image previews it immediately too", async ({
  page,
}) => {
  // iron-ore is a seeded, image-free fixture — read only, never modified
  // (no save happens in this test).
  await page.goto("/admin/items/iron-ore/edit");
  await expect(page.getByText("No image uploaded.")).toBeVisible();
  await page.locator('input[type="file"][name="image"]').setInputFiles(PNG_FIXTURE);
  await expect(page.locator("img.admin-image-preview-lg")).toBeVisible();
  await expect(page.locator("img.admin-image-preview-lg")).toHaveAttribute(
    "src",
    /^blob:/
  );
});
