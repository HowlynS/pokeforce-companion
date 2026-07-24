// Authenticated Category IMAGE workflow against the REAL application, the
// isolated Supabase test project, and its real game-images bucket. Mirrors
// the Item/Profession/Recipe/Location image suites exactly: every temporary
// Category slug carries the test-e2e-category-image prefix; Storage objects
// live under the production categories/ folder with server-generated names,
// identified ONLY through the exact object path stored on the temporary
// row — never by guessing names and never by bulk folder deletion.
// Guard-first cleanup in beforeAll/afterEach/afterAll removes those exact
// objects first and the rows second, and fails loudly on leftovers. Object
// paths and URLs are asserted boolean-only so they never reach test output.
//
// This suite also covers what is genuinely NEW for Category Images beyond
// the other four resources' own image suites: the record-list thumbnail at
// a fixed 64×64 (Categories were the one resource RecordList's showImages
// mode had not yet reached), and public rendering on both /categories and
// /categories/[slug] (Categories previously rendered no image at all on
// either page). Search, quick switching, selected-row state, tabs, and the
// item-count secondary label are proven to remain intact ALONGSIDE the new
// thumbnail — not re-proven from scratch, since admin-categories.spec.ts
// already covers that machinery exhaustively without images involved.
//
// The committed fixtures are reused from the Item image suite; the
// oversized payload is generated at runtime in the OS temporary directory
// and removed afterwards.

import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  countCategoryFolderObjects,
  countE2eTestCategoryImageRecords,
  createTemporaryItemForCategory,
  categoryImageObjectExists,
  deleteE2eTestCategoryImageRecords,
  fetchCategoryImageContentType,
  readCategoryImagePath,
  removeTemporaryItemForCategory,
} from "./helpers/database-cleanup";

const PNG_FIXTURE = path.join(__dirname, "fixtures", "tiny-valid.png");
const WEBP_FIXTURE = path.join(__dirname, "fixtures", "tiny-valid.webp");
const TEXT_FIXTURE = path.join(__dirname, "fixtures", "not-an-image.txt");

// Snapshot of how many objects the categories/ folder held before this
// suite ran; the preservation test proves the suite added none (read-only
// count — deletion is always by exact recorded path).
let categoryFolderBaseline = 0;

// Browser error hygiene: any uncaught page error fails the test. Serial
// single-worker execution makes this module-level state safe.
let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(async () => {
  // Defensive cleanup even when a test failed mid-flow: exact recorded
  // Storage objects and prefixed Category rows first, then any temporary
  // relation Item.
  await deleteE2eTestCategoryImageRecords();
  await removeTemporaryItemForCategory();
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

test.beforeAll(async () => {
  // Remove stale rows/objects from interrupted earlier runs; the guard
  // inside the helper throws here if the environment is not the verified
  // test project. Only then is the folder baseline recorded.
  await deleteE2eTestCategoryImageRecords();
  await removeTemporaryItemForCategory();
  expect(await countE2eTestCategoryImageRecords()).toBe(0);
  categoryFolderBaseline = await countCategoryFolderObjects();
});

test.afterAll(async () => {
  const remaining =
    (await deleteE2eTestCategoryImageRecords()) +
    (await removeTemporaryItemForCategory());
  // afterEach should already have removed everything — fail loudly if not.
  expect(remaining).toBe(0);
});

// One row of the shared Category record list, located by its exact primary
// text inside the list's navigation landmark.
function recordRow(page: Page, name: string) {
  return page
    .getByRole("navigation", { name: "Categories records" })
    .getByRole("link")
    .filter({ has: page.getByText(name, { exact: true }) });
}

// Asserts a real rendered image: visible AND actually decoded (non-zero
// natural width), which fails on a broken or unreadable source. Scrolling
// first satisfies lazy loading on longer pages.
async function expectRenderedImage(page: Page, alt: string) {
  const image = page.getByRole("img", { name: alt, exact: true });
  await image.scrollIntoViewIfNeeded();
  await expect(image).toBeVisible();
  await expect
    .poll(
      () => image.evaluate((el) => (el as HTMLImageElement).naturalWidth),
      { message: "the image must decode to a non-zero natural width" }
    )
    .toBeGreaterThan(0);
}

// Creates a Category through the real create form with the given image
// file attached, and waits for the success state.
async function createCategoryWithImage(
  page: Page,
  data: { name: string; slug: string },
  imageFile: string
) {
  await page.goto("/admin/categories/new");
  await page.getByLabel("Name", { exact: true }).fill(data.name);
  await page.getByLabel(/^Page address/).fill(data.slug);
  await page.locator('input[name="image"]').setInputFiles(imageFile);
  await page
    .getByRole("button", { name: "Create Category", exact: true })
    .click();

  await expect(page).toHaveURL("/admin/categories?success=created");
  await expect(page.getByRole("status")).toHaveText("Category created.");
  await expect(recordRow(page, data.name)).toBeVisible();
}

test("creating a category with a valid PNG stores, serves, and renders it on the record list, /categories, and /categories/[slug]", async ({
  page,
}) => {
  const CATEGORY = {
    name: "Test E2E Category Image",
    slug: "test-e2e-category-image",
  };
  await createCategoryWithImage(page, CATEGORY, PNG_FIXTURE);

  // The database stores a generated categories/ object path (boolean-only
  // assertions keep the path out of test output).
  const objectPath = await readCategoryImagePath(CATEGORY.slug);
  expect(objectPath !== null).toBe(true);
  expect(/^categories\/[a-z0-9-]+\.png$/.test(objectPath as string)).toBe(
    true
  );

  // That exact object exists and is publicly readable as a PNG.
  expect(await categoryImageObjectExists(objectPath as string)).toBe(true);
  const contentType = await fetchCategoryImageContentType(
    objectPath as string
  );
  expect(contentType !== null && contentType.includes("image/png")).toBe(
    true
  );

  // Admin rendering: the edit form's current-image preview displays it.
  await page.goto(`/admin/categories/${CATEGORY.slug}/edit`);
  await expectRenderedImage(page, `Current image for ${CATEGORY.name}`);

  // Admin record list: the same fixed 64×64 media slot every other
  // image-capable resource uses, populated (not the empty fallback).
  const row = recordRow(page, CATEGORY.name);
  const thumb = row.locator(".admin-record-thumb-wrap");
  await expect(thumb).not.toHaveClass(/admin-record-thumb-empty/);
  await expect(thumb).toHaveCSS("width", "64px");
  await expect(thumb).toHaveCSS("height", "64px");
  await expect(thumb.locator("img.admin-record-thumb-img")).toHaveCount(1);

  // Public list card renders the image instead of the fallback.
  await page.goto("/categories");
  await expectRenderedImage(page, `Image of ${CATEGORY.name}`);

  // Public detail page renders the image instead of the fallback.
  await page.goto(`/categories/${CATEGORY.slug}`);
  await expectRenderedImage(page, `Image of ${CATEGORY.name}`);
  await expect(page.getByText("No image available")).toHaveCount(0);
});

test("replacing the category image stores a new object and removes the old one", async ({
  page,
}) => {
  const CATEGORY = {
    name: "Test E2E Category Image Replace",
    slug: "test-e2e-category-image-replace",
  };
  await createCategoryWithImage(page, CATEGORY, PNG_FIXTURE);

  const originalPath = await readCategoryImagePath(CATEGORY.slug);
  expect(originalPath !== null).toBe(true);
  expect(await categoryImageObjectExists(originalPath as string)).toBe(true);

  // Real edit form: attach the WebP replacement, leave the remove control
  // untouched, keep every other field as prefilled.
  await page.goto(`/admin/categories/${CATEGORY.slug}/edit`);
  await page
    .locator('input[name="image"]')
    .setInputFiles(WEBP_FIXTURE);
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();

  await expect(page).toHaveURL("/admin/categories?success=updated");
  await expect(page.getByRole("status")).toHaveText("Category updated.");

  // A different generated path is stored; the new exact object exists and
  // serves WebP; the old exact object is gone (deleted only after the
  // database update succeeded — the row already references the new path).
  const newPath = await readCategoryImagePath(CATEGORY.slug);
  expect(newPath !== null).toBe(true);
  expect(newPath !== originalPath).toBe(true);
  expect(/^categories\/[a-z0-9-]+\.webp$/.test(newPath as string)).toBe(
    true
  );
  expect(await categoryImageObjectExists(newPath as string)).toBe(true);
  const newContentType = await fetchCategoryImageContentType(
    newPath as string
  );
  expect(
    newContentType !== null && newContentType.includes("image/webp")
  ).toBe(true);
  expect(await categoryImageObjectExists(originalPath as string)).toBe(
    false
  );

  // Admin and public rendering now use the replacement image.
  await page.goto(`/admin/categories/${CATEGORY.slug}/edit`);
  await expectRenderedImage(page, `Current image for ${CATEGORY.name}`);
  await page.goto(`/categories/${CATEGORY.slug}`);
  await expectRenderedImage(page, `Image of ${CATEGORY.name}`);
});

test("removing the category image clears the row, deletes the object, and restores the fallback everywhere", async ({
  page,
}) => {
  const CATEGORY = {
    name: "Test E2E Category Image Remove",
    slug: "test-e2e-category-image-remove",
  };
  await createCategoryWithImage(page, CATEGORY, PNG_FIXTURE);

  const objectPath = await readCategoryImagePath(CATEGORY.slug);
  expect(objectPath !== null).toBe(true);

  // The removal checkbox itself is visually hidden (screen-reader pattern);
  // its accessible label is the visible toggle, and checking it reveals the
  // confirmation note. No replacement file is attached.
  await page.goto(`/admin/categories/${CATEGORY.slug}/edit`);
  await page.getByTitle("Remove image").click();
  await expect(
    page.getByRole("checkbox", { name: "Remove image" })
  ).toBeChecked();
  await expect(
    page.getByText("Image will be removed when saved.")
  ).toBeVisible();
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();

  await expect(page).toHaveURL("/admin/categories?success=updated");
  await expect(page.getByRole("status")).toHaveText("Category updated.");

  // The database image field is null and the exact previous object is gone.
  expect(await readCategoryImagePath(CATEGORY.slug)).toBeNull();
  expect(await categoryImageObjectExists(objectPath as string)).toBe(false);

  // The admin record list falls back to the empty media slot.
  const thumb = recordRow(page, CATEGORY.name).locator(
    ".admin-record-thumb-wrap"
  );
  await expect(thumb).toHaveClass(/admin-record-thumb-empty/);
  await expect(thumb.locator("img")).toHaveCount(0);

  // The public list and detail pages show the no-image fallback again.
  await page.goto("/categories");
  await expect(
    page.getByRole("img", { name: `Image of ${CATEGORY.name}`, exact: true })
  ).toHaveCount(0);

  await page.goto(`/categories/${CATEGORY.slug}`);
  await expect(page.getByText("No image available")).toBeVisible();
  await expect(
    page.getByRole("img", { name: `Image of ${CATEGORY.name}`, exact: true })
  ).toHaveCount(0);
});

test("saving without touching the image controls preserves the current image", async ({
  page,
}) => {
  const CATEGORY = {
    name: "Test E2E Category Image Preserve",
    slug: "test-e2e-category-image-preserve",
  };
  await createCategoryWithImage(page, CATEGORY, PNG_FIXTURE);
  const originalPath = await readCategoryImagePath(CATEGORY.slug);
  expect(originalPath !== null).toBe(true);

  // A normal edit that touches only the description — neither the file
  // input nor the remove checkbox is interacted with at all.
  await page.goto(`/admin/categories/${CATEGORY.slug}/edit`);
  await page
    .getByLabel(/^Description/)
    .fill("Edited without touching the image.");
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();

  await expect(page).toHaveURL("/admin/categories?success=updated");
  await expect(page.getByRole("status")).toHaveText("Category updated.");

  expect(await readCategoryImagePath(CATEGORY.slug)).toBe(originalPath);
  expect(await categoryImageObjectExists(originalPath as string)).toBe(true);

  await page.goto(`/admin/categories/${CATEGORY.slug}/edit`);
  await expectRenderedImage(page, `Current image for ${CATEGORY.name}`);
  await page.goto(`/categories/${CATEGORY.slug}`);
  await expect(
    page.getByText("Edited without touching the image.")
  ).toBeVisible();
  await expectRenderedImage(page, `Image of ${CATEGORY.name}`);
});

test("an unsupported file type is rejected and nothing is written", async ({
  page,
}) => {
  await page.goto("/admin/categories/new");
  await page
    .getByLabel("Name", { exact: true })
    .fill("Test E2E Category Image Invalid");
  await page.getByLabel(/^Page address/).fill("test-e2e-category-image-invalid");
  // setInputFiles bypasses the accept picker hint (which is not
  // validation), so the submission reaches the server-side type check.
  await page.locator('input[name="image"]').setInputFiles(TEXT_FIXTURE);
  await page
    .getByRole("button", { name: "Create Category", exact: true })
    .click();

  await expect(page).toHaveURL(
    "/admin/categories/new?error=invalid_image_type"
  );
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Only PNG, JPEG, and WebP images are allowed." })
  ).toBeVisible();

  // No Category row was created; the action validates before uploading, so
  // no object was written either (also proven by the suite-level folder
  // baseline in the preservation test).
  expect(await countE2eTestCategoryImageRecords()).toBe(0);
});

test("an oversized image is rejected and nothing is written", async ({
  page,
}) => {
  // One byte over the 5 MB limit, generated in the OS temporary directory
  // (never committed) with an allowed extension/MIME so only the size check
  // can reject it.
  const oversizedPath = path.join(
    os.tmpdir(),
    `test-e2e-category-image-oversized-${Date.now()}.png`
  );
  fs.writeFileSync(oversizedPath, Buffer.alloc(5 * 1024 * 1024 + 1));

  try {
    await page.goto("/admin/categories/new");
    await page
      .getByLabel("Name", { exact: true })
      .fill("Test E2E Category Image Oversized");
    await page
      .getByLabel(/^Page address/)
      .fill("test-e2e-category-image-oversized");
    await page.locator('input[name="image"]').setInputFiles(oversizedPath);
    await page
      .getByRole("button", { name: "Create Category", exact: true })
      .click();

    await expect(page).toHaveURL(
      "/admin/categories/new?error=image_too_large"
    );
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "The image must be 5 MB or smaller." })
    ).toBeVisible();

    expect(await countE2eTestCategoryImageRecords()).toBe(0);
  } finally {
    fs.unlinkSync(oversizedPath);
  }
});

test("deleting an unlinked category also deletes its stored image object", async ({
  page,
}) => {
  const CATEGORY = {
    name: "Test E2E Category Image Delete",
    slug: "test-e2e-category-image-delete",
  };
  await createCategoryWithImage(page, CATEGORY, PNG_FIXTURE);

  const objectPath = await readCategoryImagePath(CATEGORY.slug);
  expect(objectPath !== null).toBe(true);
  expect(await categoryImageObjectExists(objectPath as string)).toBe(true);

  // Real confirmation flow: quick switching opens the edit route; Delete is
  // reached from its toolbar. The plain "Category deleted." message also
  // proves the image cleanup succeeded (a failed cleanup uses a distinct
  // message).
  await recordRow(page, CATEGORY.name).click();
  await expect(page).toHaveURL(`/admin/categories/${CATEGORY.slug}/edit`);
  await page
    .getByRole("link", { name: "Delete Category", exact: true })
    .click();
  await expect(page).toHaveURL(`/admin/categories/${CATEGORY.slug}/delete`);
  await page
    .getByRole("button", { name: "Delete Permanently", exact: true })
    .click();

  await expect(page).toHaveURL("/admin/categories?success=deleted");
  await expect(page.getByRole("status")).toHaveText("Category deleted.");
  await expect(recordRow(page, CATEGORY.name)).toHaveCount(0);

  // The row is gone and so is its exact Storage object.
  expect(await countE2eTestCategoryImageRecords()).toBe(0);
  expect(await categoryImageObjectExists(objectPath as string)).toBe(false);
});

test("category deletion stays blocked while a linked item exists, even with an image stored", async ({
  page,
}) => {
  const CATEGORY = {
    name: "Test E2E Category Image Blocked",
    slug: "test-e2e-category-image-blocked",
  };
  await createCategoryWithImage(page, CATEGORY, PNG_FIXTURE);
  // A category slug carrying the image sub-prefix still starts with the
  // general Category browser-test prefix, so the existing relation helper
  // accepts it unchanged.
  await createTemporaryItemForCategory(CATEGORY.slug);

  await page.goto(`/admin/categories/${CATEGORY.slug}/delete`);
  await expect(
    page.getByRole("button", { name: "Delete Permanently", exact: true })
  ).toBeDisabled();
  await expect(page.getByText("Linked items: 1")).toBeVisible();
  await expect(
    page.getByText(/cannot be deleted because it is assigned to/i)
  ).toBeVisible();

  // The category (and its image) are both still present and unaffected.
  const objectPath = await readCategoryImagePath(CATEGORY.slug);
  expect(objectPath !== null).toBe(true);
  expect(await categoryImageObjectExists(objectPath as string)).toBe(true);
});

test("the record list keeps search, quick switching, selected state, tabs, and the item-count label intact alongside the new thumbnail", async ({
  page,
}) => {
  const CATEGORY_A = {
    name: "Test E2E Category Image Switch A",
    slug: "test-e2e-category-image-switch-a",
  };
  const CATEGORY_B = {
    name: "Test E2E Category Image Switch B",
    slug: "test-e2e-category-image-switch-b",
  };
  await createCategoryWithImage(page, CATEGORY_A, PNG_FIXTURE);
  await page.goto("/admin/categories/new");
  await page.getByLabel("Name", { exact: true }).fill(CATEGORY_B.name);
  await page.getByLabel(/^Page address/).fill(CATEGORY_B.slug);
  await page
    .getByRole("button", { name: "Create Category", exact: true })
    .click();
  await expect(page).toHaveURL("/admin/categories?success=created");

  // Item-count secondary label still renders beside the thumbnail — both
  // temporary categories have zero linked items.
  await expect(recordRow(page, CATEGORY_A.name).getByText("0 items")).toBeVisible();
  await expect(recordRow(page, CATEGORY_B.name).getByText("0 items")).toBeVisible();

  // The filter still matches by name, preserving both temporary categories.
  await page
    .getByRole("searchbox", { name: "Search categories" })
    .fill("test e2e category image switch");
  await expect(recordRow(page, CATEGORY_A.name)).toBeVisible();
  await expect(recordRow(page, CATEGORY_B.name)).toBeVisible();

  // Quick switching: opening A selects its row and shows its own tabs.
  await recordRow(page, CATEGORY_A.name).click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/categories/${CATEGORY_A.slug}/edit\\?q=`)
  );
  await expect(recordRow(page, CATEGORY_A.name)).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(
    page.getByRole("navigation", { name: "Category editor sections" })
      .getByRole("link", { name: "General", exact: true })
  ).toHaveAttribute("aria-current", "page");

  // Switching to B moves the selection and preserves the query.
  await recordRow(page, CATEGORY_B.name).click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/categories/${CATEGORY_B.slug}/edit\\?q=`)
  );
  await expect(recordRow(page, CATEGORY_B.name)).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(recordRow(page, CATEGORY_A.name)).not.toHaveAttribute(
    "aria-current",
    "page"
  );

  // The thumbnails are still present throughout — A has a real image, B
  // (never given one) shows the fallback, and Categories with no image
  // remain fully valid, selectable records.
  await expect(
    recordRow(page, CATEGORY_A.name)
      .locator(".admin-record-thumb-wrap")
  ).not.toHaveClass(/admin-record-thumb-empty/);
  await expect(
    recordRow(page, CATEGORY_B.name)
      .locator(".admin-record-thumb-wrap")
  ).toHaveClass(/admin-record-thumb-empty/);
});

test("seeded fixtures are preserved and no suite row or object remains", async () => {
  expect(await countE2eTestCategoryImageRecords()).toBe(0);
  // The categories/ folder holds exactly as many objects as before the
  // suite: nothing was orphaned by any create, replace, remove, reject, or
  // delete.
  expect(await countCategoryFolderObjects()).toBe(categoryFolderBaseline);
});
