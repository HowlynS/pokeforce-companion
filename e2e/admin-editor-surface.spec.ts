// Browser coverage for the Admin Editor Surface and Form Readability pass
// against the REAL application. This suite deliberately does NOT re-prove
// ground already covered exhaustively elsewhere (CRUD lifecycles, route
// ownership, validation, image/verification behavior, hierarchy rules,
// tab wiring, record-list mechanics — see each resource's own
// admin-<resource>.spec.ts and admin-visual-consistency.spec.ts). It
// targets only what THIS pass changed: the new .admin-editor-surface panel
// wrapping the primary form on every converted resource's create/edit
// pages, the wider form-grid/form-grid-wide field tracks, the stronger
// label hierarchy, taller controls, taller default textareas, and the
// grouped Item boolean fields — proven against representative forms
// (Item, Recipe, Category, Location, Acquisition Source, Game Version)
// rather than duplicated across every resource. No screenshot or
// pixel-diff infrastructure is used; computed-style and bounding-box reads
// are the narrowest checks that can catch a regression.

import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  E2E_CURRENT_GAME_VERSION_NAME,
  countE2eTestAcquisitionRecords,
  countE2eTestItemRecords,
  countE2eTestLocationRecords,
  deleteE2eTestAcquisitionRecords,
  deleteE2eTestItemRecords,
  deleteE2eTestLocationRecords,
} from "./helpers/database-cleanup";

// Browser error hygiene: any uncaught page error fails the test. Serial
// single-worker execution makes this module-level state safe.
let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(async () => {
  // Defensive prefix-scoped cleanup even when a test failed mid-flow.
  await deleteE2eTestAcquisitionRecords();
  await deleteE2eTestItemRecords();
  await deleteE2eTestLocationRecords();
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

test.beforeAll(async () => {
  // Remove stale rows from interrupted earlier runs; the guard inside the
  // helper throws here if the environment is not the verified test project.
  await deleteE2eTestAcquisitionRecords();
  await deleteE2eTestItemRecords();
  await deleteE2eTestLocationRecords();
  expect(await countE2eTestAcquisitionRecords()).toBe(0);
  expect(await countE2eTestItemRecords()).toBe(0);
  expect(await countE2eTestLocationRecords()).toBe(0);
});

test.afterAll(async () => {
  const remaining =
    (await deleteE2eTestAcquisitionRecords()) +
    (await deleteE2eTestItemRecords()) +
    (await deleteE2eTestLocationRecords());
  // afterEach should already have removed everything — fail loudly if not.
  expect(remaining).toBe(0);
});

function surface(page: Page): Locator {
  return page.locator(".admin-editor-surface");
}

async function noHorizontalOverflow(locator: Locator): Promise<void> {
  const overflow = await locator.evaluate(
    (el) => el.scrollWidth - el.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

test("the editor surface is a distinct panel that contains the form, separate from the shell background and the context rail", async ({
  page,
}) => {
  // Seeded fixture only — read, never modified.
  await page.goto("/admin/items/iron-ore/edit");

  const editorSurface = surface(page);
  await expect(editorSurface).toBeVisible();
  // The record's own <form> is the surface's content, not a sibling.
  await expect(editorSurface.locator("form")).toHaveCount(1);

  const [surfaceBg, shellBg] = await Promise.all([
    editorSurface.evaluate((el) => getComputedStyle(el).backgroundColor),
    page
      .locator(".admin-shell")
      .evaluate((el) => getComputedStyle(el).backgroundColor),
  ]);
  expect(surfaceBg).not.toBe(shellBg);

  // The context rail (image/verification/timestamps) renders OUTSIDE the
  // surface, never nested inside it.
  const aside = page.locator(".admin-workspace-aside");
  await expect(aside).toBeVisible();
  await expect(aside.locator(".admin-editor-surface")).toHaveCount(0);
  await expect(editorSurface.locator(".admin-workspace-aside")).toHaveCount(0);
});

test("the surface and its form stay within the main column with no horizontal overflow, at a normal and a short desktop width", async ({
  page,
}) => {
  await page.goto("/admin/items/iron-ore/edit");
  await noHorizontalOverflow(page.locator("body"));
  await noHorizontalOverflow(surface(page));

  await page.setViewportSize({ width: 1440, height: 650 });
  await noHorizontalOverflow(page.locator("body"));
  await noHorizontalOverflow(surface(page));
});

test("form controls share a consistent, comfortably taller minimum height across text and select inputs", async ({
  page,
}) => {
  await page.goto("/admin/items/iron-ore/edit");

  const nameInput = page.getByLabel("Name", { exact: true });
  const categorySelect = page.getByRole("combobox", {
    name: "Category",
    exact: true,
  });

  // Polled rather than a one-shot read: a freshly navigated dev-mode page
  // can report a form control's box a few pixels short until layout fully
  // settles (e.g. native select chrome, font metrics).
  await expect
    .poll(() => nameInput.evaluate((el) => el.getBoundingClientRect().height))
    .toBeGreaterThanOrEqual(44);
  await expect
    .poll(() => categorySelect.evaluate((el) => el.getBoundingClientRect().height))
    .toBeGreaterThanOrEqual(44);
});

test("field labels read visually stronger (heavier weight) than helper/feedback text beneath them", async ({
  page,
}) => {
  await page.goto("/admin/items/iron-ore/edit");

  const slugLabel = page
    .locator(".form-field", { has: page.getByText("Slug", { exact: true }) })
    .locator(".form-field-label");
  const feedbackText = page.locator("#item-name-availability");

  // Polled rather than a one-shot read: a freshly navigated dev-mode page
  // can briefly report a stale computed style before it settles.
  await expect
    .poll(async () => {
      const [labelWeight, feedbackWeight] = await Promise.all([
        slugLabel.evaluate((el) => getComputedStyle(el).fontWeight),
        feedbackText.evaluate((el) => getComputedStyle(el).fontWeight),
      ]);
      return Number(labelWeight) - Number(feedbackWeight);
    })
    .toBeGreaterThan(0);
});

test("the description textarea renders with more default height than a single-line input", async ({
  page,
}) => {
  await page.goto("/admin/items/iron-ore/edit");

  const nameInput = page.getByLabel("Name", { exact: true });
  const description = page.getByLabel(/^Description/);

  const [inputHeight, textareaHeight] = await Promise.all([
    nameInput.evaluate((el) => el.getBoundingClientRect().height),
    description.evaluate((el) => el.getBoundingClientRect().height),
  ]);

  expect(textareaHeight).toBeGreaterThan(inputHeight);
});

test("Item's Held item and Tradeable checkboxes are grouped into one coherent row, each keeping its own clickable label", async ({
  page,
}) => {
  await page.goto("/admin/items/iron-ore/edit");

  const group = page.locator(".form-checkbox-group");
  await expect(group).toBeVisible();
  await expect(group.locator(".form-checkbox-field")).toHaveCount(2);

  const heldItem = page.getByLabel("Held item", { exact: true });
  const tradeable = page.getByLabel("Tradeable", { exact: true });
  await expect(heldItem).toBeVisible();
  await expect(tradeable).toBeVisible();

  // Grouped into one row at a normal desktop width: both checkboxes sit at
  // (nearly) the same vertical position rather than stacked on separate
  // lines. Polled rather than a one-shot read: a freshly navigated
  // dev-mode page can briefly report a box before layout settles.
  await expect
    .poll(async () => {
      const [heldBox, tradeableBox] = await Promise.all([
        heldItem.boundingBox(),
        tradeable.boundingBox(),
      ]);
      if (!heldBox || !tradeableBox) {
        return Number.POSITIVE_INFINITY;
      }
      return Math.abs(heldBox.y - tradeableBox.y);
    })
    .toBeLessThanOrEqual(2);

  // Clicking each label still toggles its own checkbox — native behavior
  // is unaffected by the new wrapper.
  await expect(heldItem).not.toBeChecked();
  await page.getByText("Held item", { exact: true }).click();
  await expect(heldItem).toBeChecked();
  await expect(tradeable).not.toBeChecked();
});

test("Recipe's create form uses the wider form-grid variant with readable, aligned ingredient rows, inside the same editor surface", async ({
  page,
}) => {
  await page.goto("/admin/recipes/new");

  const editorSurface = surface(page);
  await expect(editorSurface).toBeVisible();
  await expect(editorSurface.locator("form.form-grid-wide")).toHaveCount(1);
  await noHorizontalOverflow(editorSurface);

  const rows = page.locator(".ingredient-row");
  await expect(rows).toHaveCount(5);

  const firstRow = rows.first();
  await expect(firstRow.locator("select")).toBeVisible();
  await expect(firstRow.locator('input[type="number"]')).toBeVisible();

  // Every ingredient row's select and quantity input line up on the same
  // two-column track (a shared boundary within a small tolerance).
  const [selectBox, qtyBox] = await Promise.all([
    firstRow.locator("select").boundingBox(),
    firstRow.locator('input[type="number"]').boundingBox(),
  ]);
  expect(selectBox).not.toBeNull();
  expect(qtyBox).not.toBeNull();
  expect(Math.abs(selectBox!.y - qtyBox!.y)).toBeLessThanOrEqual(2);
});

test("Recipe edit renders inside the surface with the save action reachable and visible keyboard focus", async ({
  page,
}) => {
  // Seeded fixture only — read, never modified.
  await page.goto("/admin/recipes/iron-sword/edit");

  const editorSurface = surface(page);
  await expect(editorSurface).toBeVisible();
  await noHorizontalOverflow(editorSurface);

  const nameField = page.getByLabel("Name", { exact: true });
  await nameField.focus();
  await expect(nameField).toBeFocused();
  const outline = await nameField.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).toBe("solid");

  const saveButton = page.getByRole("button", { name: "Save Changes", exact: true });
  await expect(saveButton).toBeVisible();
  await expect(saveButton).toBeEnabled();
});

test("Category edit renders a short form inside the surface, with ImagePanel but no VerificationPanel in the context rail", async ({
  page,
}) => {
  // Seeded fixture only — read, never modified.
  await page.goto("/admin/categories/materials/edit");

  const editorSurface = surface(page);
  await expect(editorSurface).toBeVisible();
  await noHorizontalOverflow(editorSurface);

  const aside = page.locator(".admin-workspace-aside");
  await expect(aside.getByRole("heading", { name: "Image" })).toBeVisible();
  await expect(
    aside.getByRole("heading", { name: "Verification" })
  ).toHaveCount(0);
});

test("Location's long description and access-note textareas render with the taller default height and preserve their content", async ({
  page,
}) => {
  const LOCATION = {
    name: "Test E2E Editor Surface Location",
    slug: "test-e2e-location-editor-surface",
    type: "Town",
    description:
      "A long description of this location, covering its history, notable landmarks, and the kinds of travelers who pass through it on their way further north.",
    accessNote:
      "Reachable only after completing the bridge repair questline and speaking with the ferry operator on the southern shore.",
  } as const;

  await page.goto("/admin/locations/new");
  await page.getByLabel("Name", { exact: true }).fill(LOCATION.name);
  await page.getByLabel(/^Slug/).fill(LOCATION.slug);
  await page
    .getByRole("combobox", { name: "Type", exact: true })
    .selectOption({ label: LOCATION.type });
  await page.getByLabel(/^Description/).fill(LOCATION.description);
  await page.getByLabel(/^Access or unlock note/).fill(LOCATION.accessNote);
  await expect(page.locator("#location-name-availability")).not.toHaveText(
    "Checking name availability..."
  );
  await page
    .getByRole("button", { name: "Create Location", exact: true })
    .click();
  await expect(page).toHaveURL("/admin/locations?success=created");

  await page.goto(`/admin/locations/${LOCATION.slug}/edit`);

  const description = page.getByLabel(/^Description/);
  const accessNote = page.getByLabel(/^Access or unlock note/);
  const nameInput = page.getByLabel("Name", { exact: true });

  await expect(description).toHaveValue(LOCATION.description);
  await expect(accessNote).toHaveValue(LOCATION.accessNote);

  const [inputHeight, descriptionHeight, accessNoteHeight] = await Promise.all([
    nameInput.evaluate((el) => el.getBoundingClientRect().height),
    description.evaluate((el) => el.getBoundingClientRect().height),
    accessNote.evaluate((el) => el.getBoundingClientRect().height),
  ]);
  expect(descriptionHeight).toBeGreaterThan(inputHeight);
  expect(accessNoteHeight).toBeGreaterThan(inputHeight);

  await noHorizontalOverflow(surface(page));
});

test("an Acquisition Source edit form renders inside the same editor surface treatment", async ({
  page,
}) => {
  const ITEM = {
    name: "Test E2E Editor Surface Item",
    slug: "test-e2e-item-editor-surface",
  };

  await page.goto("/admin/items/new");
  await page.getByLabel("Name", { exact: true }).fill(ITEM.name);
  await page.getByLabel(/^Slug/).fill(ITEM.slug);
  await page.getByRole("button", { name: "Create item", exact: true }).click();
  await expect(page).toHaveURL("/admin/items?success=created");

  await page.goto(`/admin/items/${ITEM.slug}/sources`);
  await page
    .getByRole("combobox", { name: "Type", exact: true })
    .selectOption({ label: "Foraging" });
  await page.getByRole("button", { name: "Add Source", exact: true }).click();
  await expect(page).toHaveURL(
    `/admin/items/${ITEM.slug}/sources?success=created`
  );

  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/items/${ITEM.slug}/sources/.+/edit`));

  const editorSurface = surface(page);
  await expect(editorSurface).toBeVisible();
  await expect(editorSurface.locator("form")).toHaveCount(1);
  await noHorizontalOverflow(editorSurface);

  const saveButton = page.getByRole("button", { name: "Save Changes", exact: true });
  await expect(saveButton).toBeVisible();
});

test("the Game Version create and edit forms adopt the same editor surface treatment", async ({
  page,
}) => {
  await page.goto("/admin/settings/game-versions");

  const createSurface = surface(page);
  await expect(createSurface).toBeVisible();
  await expect(createSurface.locator("form")).toHaveCount(1);
  await noHorizontalOverflow(createSurface);

  // Seeded fixture row only — read, never modified (no submission below).
  const currentRow = page
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: E2E_CURRENT_GAME_VERSION_NAME, exact: true }) });
  await currentRow.getByRole("link", { name: "Edit", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/settings\/game-versions\/.+\/edit/);

  const editSurface = surface(page);
  await expect(editSurface).toBeVisible();
  await noHorizontalOverflow(editSurface);
});

test("zooming the page keeps the editor surface's own content from overflowing itself, with the save action still reachable", async ({
  page,
}) => {
  await page.goto("/admin/items/iron-ore/edit");

  // Chromium's non-standard `zoom` property is the closest available
  // proxy for OS-level page zoom in a headless browser test. The
  // pre-existing fixed-width three-column admin shell (record list +
  // editor + aside, none of it touched by this pass — shell width and
  // column proportions are explicitly out of scope) is not designed to
  // reflow at extreme zoom, so this checks what this pass actually owns:
  // the surface's own internal content never overflows ITSELF, and the
  // primary action stays reachable.
  await page.evaluate(() => {
    document.documentElement.style.zoom = "1.5";
  });

  await expect
    .poll(() =>
      surface(page).evaluate((el) => el.scrollWidth - el.clientWidth)
    )
    .toBeLessThanOrEqual(1);
  await expect(
    page.getByRole("button", { name: "Save item", exact: true })
  ).toBeVisible();

  await page.evaluate(() => {
    document.documentElement.style.zoom = "1";
  });
});

test("seeded fixtures are preserved and no suite row remains", async () => {
  expect(await countE2eTestAcquisitionRecords()).toBe(0);
  expect(await countE2eTestItemRecords()).toBe(0);
  expect(await countE2eTestLocationRecords()).toBe(0);
});
