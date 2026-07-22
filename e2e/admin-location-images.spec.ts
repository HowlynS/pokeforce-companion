// Authenticated Location IMAGE workflow against the REAL application, the
// isolated Supabase test project, and its real game-images bucket. Mirrors
// the Item/Profession/Recipe image suites: every temporary Location slug
// carries the test-e2e-location-image prefix; Storage objects live under
// the production locations/ folder with server-generated names, identified
// ONLY through the exact object path stored on the temporary row — never
// by guessing names and never by bulk folder deletion. Guard-first cleanup
// in beforeAll/afterEach/afterAll removes those exact objects first and
// the rows second, and fails loudly on leftovers. Object paths and URLs
// are asserted boolean-only so they never reach test output.
//
// The committed fixtures are reused from the Item image suite; the
// oversized payload is generated at runtime in the OS temporary directory
// and removed afterwards.

import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  countE2eTestLocationImageRecords,
  countLocationFolderObjects,
  deleteE2eTestLocationImageRecords,
  fetchLocationImageContentType,
  locationImageObjectExists,
  readLocationImagePath,
} from "./helpers/database-cleanup";

const PNG_FIXTURE = path.join(__dirname, "fixtures", "tiny-valid.png");
const WEBP_FIXTURE = path.join(__dirname, "fixtures", "tiny-valid.webp");
const TEXT_FIXTURE = path.join(__dirname, "fixtures", "not-an-image.txt");

// Snapshot of how many objects the locations/ folder held before this suite
// ran; the preservation test proves the suite added none (read-only count —
// deletion is always by exact recorded path).
let locationFolderBaseline = 0;

// Browser error hygiene: any uncaught page error fails the test. Serial
// single-worker execution makes this module-level state safe.
let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(async () => {
  // Defensive cleanup even when a test failed mid-flow: exact recorded
  // Storage objects first, then the prefixed Location rows.
  await deleteE2eTestLocationImageRecords();
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

test.beforeAll(async () => {
  // Remove stale rows/objects from interrupted earlier runs; the guard
  // inside the helper throws here if the environment is not the verified
  // test project. Only then is the folder baseline recorded.
  await deleteE2eTestLocationImageRecords();
  expect(await countE2eTestLocationImageRecords()).toBe(0);
  locationFolderBaseline = await countLocationFolderObjects();
});

test.afterAll(async () => {
  const remaining = await deleteE2eTestLocationImageRecords();
  // afterEach should already have removed everything — fail loudly if not.
  expect(remaining).toBe(0);
});

// One row of the shared Location record list (Slice 9F.1), located by its
// exact primary text inside the list's navigation landmark.
function recordRow(page: Page, name: string) {
  return page
    .getByRole("navigation", { name: "Locations records" })
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

// Creates a Location through the real create form with the given image
// file attached, and waits for the success state.
async function createLocationWithImage(
  page: Page,
  data: { name: string; slug: string },
  imageFile: string
) {
  await page.goto("/admin/locations/new");
  await page.getByLabel("Name", { exact: true }).fill(data.name);
  await page.getByLabel(/^Page address/).fill(data.slug);
  await page
    .getByRole("combobox", { name: "Type", exact: true })
    .selectOption({ label: "Region" });
  await page.locator('input[name="image"]').setInputFiles(imageFile);
  await page
    .getByRole("button", { name: "Create Location", exact: true })
    .click();

  await expect(page).toHaveURL("/admin/locations?success=created");
  await expect(page.getByRole("status")).toHaveText("Location created.");
  await expect(recordRow(page, data.name)).toBeVisible();
}

test("creating a location with a valid PNG stores, serves, and renders it", async ({
  page,
}) => {
  const LOCATION = {
    name: "Test E2E Location Image",
    slug: "test-e2e-location-image",
  };
  await createLocationWithImage(page, LOCATION, PNG_FIXTURE);

  // The database stores a generated locations/ object path (boolean-only
  // assertions keep the path out of test output).
  const objectPath = await readLocationImagePath(LOCATION.slug);
  expect(objectPath !== null).toBe(true);
  expect(/^locations\/[a-z0-9-]+\.png$/.test(objectPath as string)).toBe(
    true
  );

  // That exact object exists and is publicly readable as a PNG.
  expect(await locationImageObjectExists(objectPath as string)).toBe(true);
  const contentType = await fetchLocationImageContentType(
    objectPath as string
  );
  expect(contentType !== null && contentType.includes("image/png")).toBe(true);

  // Admin rendering: the edit form's current-image preview displays it.
  await page.goto(`/admin/locations/${LOCATION.slug}/edit`);
  await expectRenderedImage(page, `Current image for ${LOCATION.name}`);

  // Public detail page renders the image instead of the fallback.
  await page.goto(`/locations/${LOCATION.slug}`);
  await expectRenderedImage(page, `Image of ${LOCATION.name}`);
  await expect(page.getByText("No image available")).toHaveCount(0);
});

test("replacing the location image stores a new object and removes the old one", async ({
  page,
}) => {
  const LOCATION = {
    name: "Test E2E Location Image Replace",
    slug: "test-e2e-location-image-replace",
  };
  await createLocationWithImage(page, LOCATION, PNG_FIXTURE);

  const originalPath = await readLocationImagePath(LOCATION.slug);
  expect(originalPath !== null).toBe(true);
  expect(await locationImageObjectExists(originalPath as string)).toBe(true);

  // Real edit form: attach the WebP replacement, leave the remove control
  // untouched, keep every other field as prefilled.
  await page.goto(`/admin/locations/${LOCATION.slug}/edit`);
  await page
    .locator('input[name="image"]')
    .setInputFiles(WEBP_FIXTURE);
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();

  await expect(page).toHaveURL("/admin/locations?success=updated");
  await expect(page.getByRole("status")).toHaveText("Location updated.");

  // A different generated path is stored; the new exact object exists and
  // serves WebP; the old exact object is gone (deleted only after the
  // database update succeeded — the row already references the new path).
  const newPath = await readLocationImagePath(LOCATION.slug);
  expect(newPath !== null).toBe(true);
  expect(newPath !== originalPath).toBe(true);
  expect(/^locations\/[a-z0-9-]+\.webp$/.test(newPath as string)).toBe(true);
  expect(await locationImageObjectExists(newPath as string)).toBe(true);
  const newContentType = await fetchLocationImageContentType(
    newPath as string
  );
  expect(
    newContentType !== null && newContentType.includes("image/webp")
  ).toBe(true);
  expect(await locationImageObjectExists(originalPath as string)).toBe(false);

  // Admin and public rendering now use the replacement image.
  await page.goto(`/admin/locations/${LOCATION.slug}/edit`);
  await expectRenderedImage(page, `Current image for ${LOCATION.name}`);
  await page.goto(`/locations/${LOCATION.slug}`);
  await expectRenderedImage(page, `Image of ${LOCATION.name}`);
});

test("removing the location image clears the row, deletes the object, and restores the fallback", async ({
  page,
}) => {
  const LOCATION = {
    name: "Test E2E Location Image Remove",
    slug: "test-e2e-location-image-remove",
  };
  await createLocationWithImage(page, LOCATION, PNG_FIXTURE);

  const objectPath = await readLocationImagePath(LOCATION.slug);
  expect(objectPath !== null).toBe(true);

  // The removal checkbox itself is visually hidden (screen-reader pattern);
  // its accessible label is the visible toggle, and checking it reveals the
  // confirmation note. No replacement file is attached.
  await page.goto(`/admin/locations/${LOCATION.slug}/edit`);
  await page.getByTitle("Remove image").click();
  await expect(
    page.getByRole("checkbox", { name: "Remove image" })
  ).toBeChecked();
  await expect(
    page.getByText("Image will be removed when saved.")
  ).toBeVisible();
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();

  await expect(page).toHaveURL("/admin/locations?success=updated");
  await expect(page.getByRole("status")).toHaveText("Location updated.");

  // The database image field is null and the exact previous object is gone.
  expect(await readLocationImagePath(LOCATION.slug)).toBeNull();
  expect(await locationImageObjectExists(objectPath as string)).toBe(false);

  // The public detail page shows the no-image fallback again.
  await page.goto(`/locations/${LOCATION.slug}`);
  await expect(page.getByText("No image available")).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: `Image of ${LOCATION.name}`,
      exact: true,
    })
  ).toHaveCount(0);
});

test("an unsupported file type is rejected and nothing is written", async ({
  page,
}) => {
  await page.goto("/admin/locations/new");
  await page
    .getByLabel("Name", { exact: true })
    .fill("Test E2E Location Image Invalid");
  await page.getByLabel(/^Page address/).fill("test-e2e-location-image-invalid");
  await page
    .getByRole("combobox", { name: "Type", exact: true })
    .selectOption({ label: "Region" });
  // setInputFiles bypasses the accept picker hint (which is not
  // validation), so the submission reaches the server-side type check.
  await page.locator('input[name="image"]').setInputFiles(TEXT_FIXTURE);
  await page
    .getByRole("button", { name: "Create Location", exact: true })
    .click();

  await expect(page).toHaveURL(
    "/admin/locations/new?error=invalid_image_type"
  );
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Only PNG, JPEG, and WebP images are allowed." })
  ).toBeVisible();

  // No Location row was created; the action validates before uploading, so
  // no object was written either (also proven by the suite-level folder
  // baseline in the preservation test).
  expect(await countE2eTestLocationImageRecords()).toBe(0);
});

test("an oversized image is rejected and nothing is written", async ({
  page,
}) => {
  // One byte over the 5 MB limit, generated in the OS temporary directory
  // (never committed) with an allowed extension/MIME so only the size check
  // can reject it. The application's server-action body limit (6 MB) still
  // admits the request, so the readable size error is exercised.
  const oversizedPath = path.join(
    os.tmpdir(),
    `test-e2e-location-image-oversized-${Date.now()}.png`
  );
  fs.writeFileSync(oversizedPath, Buffer.alloc(5 * 1024 * 1024 + 1));

  try {
    await page.goto("/admin/locations/new");
    await page
      .getByLabel("Name", { exact: true })
      .fill("Test E2E Location Image Oversized");
    await page.getByLabel(/^Page address/).fill("test-e2e-location-image-oversized");
    await page
      .getByRole("combobox", { name: "Type", exact: true })
      .selectOption({ label: "Region" });
    await page.locator('input[name="image"]').setInputFiles(oversizedPath);
    await page
      .getByRole("button", { name: "Create Location", exact: true })
      .click();

    await expect(page).toHaveURL(
      "/admin/locations/new?error=image_too_large"
    );
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "The image must be 5 MB or smaller." })
    ).toBeVisible();

    expect(await countE2eTestLocationImageRecords()).toBe(0);
  } finally {
    fs.unlinkSync(oversizedPath);
  }
});

test("deleting the location also deletes its stored image object", async ({
  page,
}) => {
  const LOCATION = {
    name: "Test E2E Location Image Delete",
    slug: "test-e2e-location-image-delete",
  };
  await createLocationWithImage(page, LOCATION, PNG_FIXTURE);

  const objectPath = await readLocationImagePath(LOCATION.slug);
  expect(objectPath !== null).toBe(true);
  expect(await locationImageObjectExists(objectPath as string)).toBe(true);

  // Real confirmation flow (no sub-locations reference the temporary
  // location, so deletion is offered); the plain "Location deleted."
  // message also proves the image cleanup succeeded (a failed cleanup uses
  // a distinct message). Quick switching opens the edit route; Delete is
  // reached from its toolbar (the old table's per-row Delete link is gone).
  await recordRow(page, LOCATION.name).click();
  await expect(page).toHaveURL(`/admin/locations/${LOCATION.slug}/edit`);
  await page
    .getByRole("link", { name: "Delete Location", exact: true })
    .click();
  await expect(page).toHaveURL(`/admin/locations/${LOCATION.slug}/delete`);
  await page
    .getByRole("button", { name: "Delete Permanently", exact: true })
    .click();

  await expect(page).toHaveURL("/admin/locations?success=deleted");
  await expect(page.getByRole("status")).toHaveText("Location deleted.");
  await expect(recordRow(page, LOCATION.name)).toHaveCount(0);

  // The row is gone and so is its exact Storage object.
  expect(await countE2eTestLocationImageRecords()).toBe(0);
  expect(await locationImageObjectExists(objectPath as string)).toBe(false);
});

test("no suite row or object remains", async () => {
  expect(await countE2eTestLocationImageRecords()).toBe(0);
  // The locations/ folder holds exactly as many objects as before the
  // suite: nothing was orphaned by any create, replace, remove, reject, or
  // delete.
  expect(await countLocationFolderObjects()).toBe(locationFolderBaseline);
});
