// Browser coverage for the Admin Editor Usability pass (ultrawide surface
// sizing, form section hierarchy, field/checkbox alignment, sticky
// EditorActions refinement, and destructive-confirmation polish) against
// the REAL application. This suite deliberately does NOT re-prove ground
// already covered exhaustively elsewhere (CRUD lifecycles, route
// ownership, validation, image/verification behavior, tab wiring,
// record-list mechanics, .admin-frame geometry — see each resource's own
// admin-<resource>.spec.ts, admin-shell-background.spec.ts, and
// admin-editor-surface.spec.ts). It targets only what THIS pass changed:
// the editor surface filling its main-column width instead of leaving a
// gap before the context rail, the new .form-section-heading dividers,
// checkbox top-alignment, the sticky actions bar's overlap safety, and
// the new confirm-card-eyebrow destructive marker. No screenshot or
// pixel-diff infrastructure, and no exact-color assertions beyond the
// existing semantic danger/gold checks — bounding boxes and computed
// styles are the narrowest checks that can catch a regression.

import { expect, test, type Page } from "@playwright/test";

// Browser error hygiene: any uncaught page error fails the test. Serial
// single-worker execution makes this module-level state safe.
let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(async () => {
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

async function noHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

test("the editor surface fills its main-column width at 3440px, leaving no arbitrary gap before the context rail", async ({
  page,
}) => {
  // Seeded fixture only — read, never modified.
  await page.goto("/admin/items/iron-ore/edit");
  await page.setViewportSize({ width: 3440, height: 1440 });

  // Polled rather than a one-shot Promise.all read: a freshly resized
  // dev-mode page can briefly report layout mid-reflow across three
  // concurrent boundingBox() calls before it settles.
  await expect
    .poll(async () => {
      const surfaceBox = await page.locator(".admin-editor-surface").boundingBox();
      const mainBox = await page.locator(".admin-workspace-main").boundingBox();
      if (!surfaceBox || !mainBox) return Number.POSITIVE_INFINITY;
      // The surface now matches its main column's own width (within a
      // sub-pixel tolerance) rather than shrinking to its form's content.
      return Math.abs(surfaceBox.width - mainBox.width);
    })
    .toBeLessThanOrEqual(1);

  // No arbitrary gap: the surface's right edge sits directly against the
  // gap that separates the main column from the aside (the existing
  // 24px column gap — not a large additional stranded void).
  await expect
    .poll(async () => {
      const surfaceBox = await page.locator(".admin-editor-surface").boundingBox();
      const asideBox = await page.locator(".admin-workspace-aside").boundingBox();
      if (!surfaceBox || !asideBox) return Number.POSITIVE_INFINITY;
      return asideBox.x - (surfaceBox.x + surfaceBox.width);
    })
    .toBeLessThanOrEqual(30);

  await noHorizontalOverflow(page);
});

test("the inner form content stays within its established readable width even though the surface itself is wide", async ({
  page,
}) => {
  await page.goto("/admin/items/iron-ore/edit");
  await page.setViewportSize({ width: 3440, height: 1440 });

  const formBox = await page.locator(".admin-editor-surface form.form-grid").boundingBox();
  expect(formBox).not.toBeNull();
  // Matches the existing .form-grid max-width (560px) plus a small
  // tolerance — proves controls never stretched to the surface's own
  // much wider box.
  expect(formBox!.width).toBeLessThanOrEqual(580);
});

test("a no-aside route (Recipe Ingredients) keeps its surface within the main column and its fieldset content capped, with no horizontal overflow at any target width", async ({
  page,
}) => {
  // Seeded fixture only — read, never modified.
  await page.goto("/admin/recipes/iron-sword/ingredients");

  for (const width of [1440, 1920, 2560, 3440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator(".admin-workspace-aside")).toHaveCount(0);
    await noHorizontalOverflow(page);
  }

  const fieldsetBox = await page.locator(".form-fieldset").boundingBox();
  expect(fieldsetBox).not.toBeNull();
  // form-grid-wide's 680px cap plus tolerance.
  expect(fieldsetBox!.width).toBeLessThanOrEqual(700);
});

test("Item edit's form section headings render in the documented order, and every original field is still present and labeled", async ({
  page,
}) => {
  await page.goto("/admin/items/iron-ore/edit");

  const headings = await page
    .locator(".admin-editor-surface .form-section-heading")
    .allTextContents();
  expect(headings).toEqual([
    "Identity",
    "Description",
    "Classification",
    "Gameplay details",
  ]);

  // Every field from before this pass is still reachable by its exact
  // accessible label — proves no field disappeared and no name/id
  // changed.
  await expect(page.getByLabel("Name", { exact: true })).toBeVisible();
  await expect(page.getByLabel(/^Slug/)).toBeVisible();
  await expect(page.getByLabel(/^Description/)).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Category", exact: true })).toBeVisible();
  await expect(page.getByLabel("Held item", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Tradeable", { exact: true })).toBeVisible();
  await expect(page.getByLabel(/^Base value/)).toBeVisible();

  // Exactly one page-level h1 — section headings are plain paragraphs,
  // never a second heading competing with the record title.
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
});

test("Item create's every original field name still exists inside the same form after the section-heading insertions", async ({
  page,
}) => {
  await page.goto("/admin/items/new");

  await expect(page.locator('#item-create-form input[name="name"]')).toHaveCount(1);
  await expect(page.locator('#item-create-form input[name="slug"]')).toHaveCount(1);
  await expect(page.locator('#item-create-form textarea[name="description"]')).toHaveCount(1);
  await expect(page.locator('#item-create-form select[name="categoryId"]')).toHaveCount(1);
  await expect(page.locator('#item-create-form input[name="heldItem"]')).toHaveCount(1);
  await expect(page.locator('#item-create-form input[name="tradeable"]')).toHaveCount(1);
  await expect(page.locator('#item-create-form input[name="baseValue"]')).toHaveCount(1);
});

test("the verification checkbox stays top-aligned with its label's first line, and remains keyboard-operable", async ({
  page,
}) => {
  await page.goto("/admin/items/iron-ore/edit");

  const checkbox = page.getByRole("checkbox", {
    name: /Mark gameplay data as verified/,
  });
  await expect(checkbox).toBeVisible();

  const field = page.locator(".form-checkbox-field", { has: checkbox });

  // Top-aligned (flex-start), not vertically centered against the
  // multi-line label: proven relatively (the checkbox sits in the top
  // half of the row, not centered) rather than against a fixed pixel
  // budget, since the exact offset depends on font metrics. Polled
  // rather than a one-shot Promise.all read, matching this suite's own
  // dev-mode settling convention.
  await expect
    .poll(async () => {
      const checkboxBox = await checkbox.boundingBox();
      const fieldBox = await field.boundingBox();
      if (!checkboxBox || !fieldBox) return Number.POSITIVE_INFINITY;
      const offsetFromTop = checkboxBox.y - fieldBox.y;
      const offsetFromBottom =
        fieldBox.y + fieldBox.height - (checkboxBox.y + checkboxBox.height);
      // Strictly closer to the row's top edge than to its bottom edge.
      return offsetFromTop - offsetFromBottom;
    })
    .toBeLessThan(0);

  await checkbox.focus();
  await expect(checkbox).toBeFocused();
  await expect(checkbox).not.toBeChecked();
  await page.keyboard.press("Space");
  await expect(checkbox).toBeChecked();
});

test("sticky EditorActions stays sticky, keeps Save as a real submit control, and Delete keeps its exact route", async ({
  page,
}) => {
  await page.goto("/admin/items/iron-ore/edit");

  const actions = page.locator(".admin-editor-actions");
  const position = await actions.evaluate((el) => getComputedStyle(el).position);
  expect(position).toBe("sticky");

  const saveButton = page.getByRole("button", { name: "Save item", exact: true });
  await expect(saveButton).toHaveAttribute("type", "submit");

  const deleteLink = page.getByRole("link", { name: "Delete item", exact: true });
  await expect(deleteLink).toHaveAttribute(
    "href",
    /\/admin\/items\/iron-ore\/delete/
  );
});

test("at 1440x650, the sticky actions bar never overlaps the context rail, and the last field remains reachable above it", async ({
  page,
}) => {
  await page.goto("/admin/categories/materials/edit");
  await page.setViewportSize({ width: 1440, height: 650 });

  const actions = page.locator(".admin-editor-actions");
  const aside = page.locator(".admin-workspace-aside");
  await expect(actions).toBeVisible();
  await expect(aside).toBeVisible();

  const [actionsBox, asideBox] = await Promise.all([
    actions.boundingBox(),
    aside.boundingBox(),
  ]);
  expect(actionsBox).not.toBeNull();
  expect(asideBox).not.toBeNull();
  const horizontallyDisjoint =
    actionsBox!.x >= asideBox!.x + asideBox!.width ||
    asideBox!.x >= actionsBox!.x + actionsBox!.width;
  expect(horizontallyDisjoint).toBe(true);

  // The last field before the actions bar stays scrollable into view
  // (not permanently hidden behind the sticky footer).
  const description = page.getByLabel(/^Description/);
  await description.scrollIntoViewIfNeeded();
  await expect(description).toBeInViewport();

  await noHorizontalOverflow(page);
});

test("every delete confirmation now shows the destructive eyebrow, and Delete/Cancel keep their exact existing routes", async ({
  page,
}) => {
  // Seeded fixture only — read, never modified. Iron Ore cannot be
  // deleted (it is a recipe ingredient), so the dependency-warning path
  // is exercised for free.
  await page.goto("/admin/items/iron-ore/delete");

  await expect(page.locator(".confirm-card-eyebrow")).toHaveText(
    "Destructive action"
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);

  // The withheld-delete dependency warning is still shown, and no delete
  // form renders while the dependency blocks it.
  await expect(
    page.getByText(/cannot be deleted because it is used as/)
  ).toBeVisible();
  await expect(page.locator(".confirm-card form")).toHaveCount(0);

  const cancel = page.getByRole("link", { name: "Cancel", exact: true });
  await expect(cancel).toHaveAttribute("href", "/admin/items/iron-ore/edit");

  await noHorizontalOverflow(page);
});

test("the Game Version delete confirmation also shows the destructive eyebrow and preserves its Delete Permanently action", async ({
  page,
}) => {
  await page.goto("/admin/settings/game-versions");

  const currentRow = page
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: "test-gv-current", exact: true }) });
  await currentRow.getByRole("link", { name: "Delete", exact: true }).click();

  await expect(page.locator(".confirm-card-eyebrow")).toHaveText(
    "Destructive action"
  );
  // Read-only: this route's own existing dependency-check behavior is
  // already covered by admin-game-versions.spec.ts — this test only
  // proves the new eyebrow renders here too, and Cancel still returns
  // to the exact existing route, without depending on (or changing)
  // whether this specific version happens to be deletable right now.
  await expect(
    page.getByRole("link", { name: "Cancel", exact: true })
  ).toHaveAttribute("href", "/admin/settings/game-versions");
});
