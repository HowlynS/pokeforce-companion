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

test("the inner form content fills the editor surface's width — the legacy reading-width cap is gone for section-card forms", async ({
  page,
}) => {
  await page.goto("/admin/items/iron-ore/edit");
  await page.setViewportSize({ width: 3440, height: 1440 });

  const formBox = await page.locator(".admin-editor-surface form.form-grid").boundingBox();
  const surfaceBox = await page.locator(".admin-editor-surface").boundingBox();
  expect(formBox).not.toBeNull();
  expect(surfaceBox).not.toBeNull();
  // Admin Full-Width Card Layout pass: the old capped max-width
  // (clamp(900px, 58vw, 1600px), proven live to leave a large unused
  // strip inside the card at 3440px) was removed for any form wrapping
  // section cards (.form-grid:has(> .admin-editor-section...) in
  // globals.css) — the form now fills essentially the surface's own
  // width (minus the surface's own 32px horizontal padding each side),
  // rather than stopping hundreds of pixels short of it.
  expect(surfaceBox!.width - formBox!.width).toBeLessThanOrEqual(80);
});

test("a no-aside route (Recipe Ingredients) keeps its surface within the main column with no horizontal overflow, and its fieldset now fills the section width", async ({
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
  const surfaceBox = await page.locator(".admin-editor-surface").boundingBox();
  expect(fieldsetBox).not.toBeNull();
  expect(surfaceBox).not.toBeNull();
  // Admin Full-Width Card Layout pass: the old capped max-width
  // (clamp(1060px, 68vw, 1840px)) is gone for this same reason — the
  // fieldset (nested inside EditorSection, whose own
  // .admin-editor-section-body > .form-fieldset rule resets its border/
  // background/padding to avoid a doubled card) now fills essentially
  // the full surface width instead of a bounded reading width.
  expect(surfaceBox!.width - fieldsetBox!.width).toBeLessThanOrEqual(150);
});

test("Item edit's form section headings render in the documented order, and every original field is still present and labeled", async ({
  page,
}) => {
  await page.goto("/admin/items/iron-ore/edit");

  const headings = await page
    .locator(".admin-editor-surface .admin-editor-section-title")
    .allTextContents();
  expect(headings).toEqual([
    "Identity",
    "Description",
    "Classification",
    "Gameplay Details",
  ]);

  // Every field from before this pass is still reachable by its exact
  // accessible label — proves no field disappeared and no name/id
  // changed.
  await expect(page.getByLabel("Name", { exact: true })).toBeVisible();
  await expect(page.getByLabel(/^Page address/)).toBeVisible();
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
  // AdminSelect (Massive Admin Interaction Completion Pass, Phase 1)
  // replaced the native <select> here — the field's own name is still
  // carried by its submitted proxy <input>.
  await expect(page.locator('#item-create-form input[name="categoryId"]')).toHaveCount(1);
  await expect(page.locator('#item-create-form input[name="heldItem"]')).toHaveCount(1);
  await expect(page.locator('#item-create-form input[name="tradeable"]')).toHaveCount(1);
  await expect(page.locator('#item-create-form input[name="baseValue"]')).toHaveCount(1);
});

// Admin Visual/UX Correction pass, follow-up: the Item General editor's
// explicit two-column composition (Name/Page address/Description on the
// left; Category/Held item/Tradeable/Base value on the right) — a
// deliberate LEFT-STACK/RIGHT-STACK grouping, not the shared
// .form-grid-responsive auto-flow every other resource still uses.
// `elementHandle.evaluate` locates each field's own nearest
// .item-general-column ancestor and reads back which side it landed in,
// so this is a structural proof of the grouping itself (not just that
// every field is present, which the tests above already cover).
//
// Admin Editor Section Redesign pass: the right column's own
// .item-general-column-right modifier class (and its border-left divider)
// was removed once the four EditorSection cards made the split visually
// clear on their own — both columns now share the identical
// .item-general-column class, so "which side" is read from DOM order
// (first vs. second column) instead of a class that no longer exists.
function columnSideOf(page: Page, fieldLocator: string) {
  return page.locator(fieldLocator).evaluate((el) => {
    const column = el.closest(".item-general-column");
    if (!column) return "no-column";
    const columns = Array.from(
      column.parentElement?.querySelectorAll(":scope > .item-general-column") ?? []
    );
    const index = columns.indexOf(column);
    if (index === 0) return "left";
    if (index === 1) return "right";
    return "unknown-column";
  });
}

test("Item edit: General renders the explicit two-column composition — Name/Page address/Description left, Category/Held item/Tradeable/Base value right — with Save/Cancel outside both columns", async ({
  page,
}) => {
  await page.goto("/admin/items/iron-ore/edit");

  const columns = page.locator(".item-general-columns > .item-general-column");
  await expect(columns).toHaveCount(2);

  // Left column: Name, Page address, Description.
  await expect(
    columnSideOf(page, '#item-edit-form input[name="name"]')
  ).resolves.toBe("left");
  await expect(
    columnSideOf(page, '#item-edit-form input[name="slug"]')
  ).resolves.toBe("left");
  await expect(
    columnSideOf(page, '#item-edit-form textarea[name="description"]')
  ).resolves.toBe("left");

  // Right column: Category, Held item, Tradeable, Base value.
  await expect(
    columnSideOf(page, '#item-edit-form input[name="categoryId"]')
  ).resolves.toBe("right");
  await expect(
    columnSideOf(page, '#item-edit-form input[name="heldItem"]')
  ).resolves.toBe("right");
  await expect(
    columnSideOf(page, '#item-edit-form input[name="tradeable"]')
  ).resolves.toBe("right");
  await expect(
    columnSideOf(page, '#item-edit-form input[name="baseValue"]')
  ).resolves.toBe("right");

  // No field appears in both columns, or outside the two-column wrapper
  // entirely (besides the two hidden id/originalSlug inputs, which carry
  // no visible column membership at all).
  const fieldCounts = await page.evaluate(() => {
    const names = ["name", "slug", "description", "categoryId", "heldItem", "tradeable", "baseValue"];
    return names.map((name) => ({
      name,
      count: document.querySelectorAll(
        `#item-edit-form .item-general-columns [name="${name}"]`
      ).length,
    }));
  });
  for (const { name, count } of fieldCounts) {
    expect(count, `${name} should appear exactly once inside the columns`).toBe(1);
  }

  // The action row is a sibling of .item-general-columns, never nested
  // inside either column.
  const actionsInsideColumns = await page
    .locator(".item-general-columns .admin-editor-actions")
    .count();
  expect(actionsInsideColumns).toBe(0);
  await expect(page.locator("#item-edit-form > .admin-editor-actions")).toHaveCount(1);
});

test("Item create: General renders the same explicit two-column composition, with Save/Cancel outside both columns", async ({
  page,
}) => {
  await page.goto("/admin/items/new");

  const columns = page.locator(".item-general-columns > .item-general-column");
  await expect(columns).toHaveCount(2);

  await expect(
    columnSideOf(page, '#item-create-form input[name="name"]')
  ).resolves.toBe("left");
  await expect(
    columnSideOf(page, '#item-create-form input[name="slug"]')
  ).resolves.toBe("left");
  await expect(
    columnSideOf(page, '#item-create-form textarea[name="description"]')
  ).resolves.toBe("left");
  await expect(
    columnSideOf(page, '#item-create-form input[name="categoryId"]')
  ).resolves.toBe("right");
  await expect(
    columnSideOf(page, '#item-create-form input[name="heldItem"]')
  ).resolves.toBe("right");
  await expect(
    columnSideOf(page, '#item-create-form input[name="tradeable"]')
  ).resolves.toBe("right");
  await expect(
    columnSideOf(page, '#item-create-form input[name="baseValue"]')
  ).resolves.toBe("right");

  const actionsInsideColumns = await page
    .locator(".item-general-columns .admin-editor-actions")
    .count();
  expect(actionsInsideColumns).toBe(0);
  await expect(page.locator("#item-create-form > .admin-editor-actions")).toHaveCount(1);
});

test("Item General: the two-column composition activates at wide widths and stacks cleanly at 1440x900 — the old divider is gone, replaced by the section cards' own borders", async ({
  page,
}) => {
  await page.goto("/admin/items/iron-ore/edit");

  // Wide: two columns, side by side. Admin Editor Section Redesign pass:
  // the right column's old border-left divider was removed once the four
  // EditorSection cards (Identity/Description/Classification/Gameplay
  // Details) made the split visually clear on their own — asserting a
  // divider that was deliberately retired would be a stale expectation,
  // not a real regression check.
  await page.setViewportSize({ width: 1920, height: 1080 });
  const leftBox = await page.locator(".item-general-column").nth(0).boundingBox();
  const rightBox = await page.locator(".item-general-column").nth(1).boundingBox();
  expect(leftBox).not.toBeNull();
  expect(rightBox).not.toBeNull();
  // Side by side, not stacked: the right column starts to the right of
  // where the left column ends.
  expect(rightBox!.x).toBeGreaterThan(leftBox!.x + leftBox!.width);

  // Narrow: stacked, no horizontal overflow.
  await page.setViewportSize({ width: 1440, height: 900 });
  const stackedLeft = await page.locator(".item-general-column").nth(0).boundingBox();
  const stackedRight = await page.locator(".item-general-column").nth(1).boundingBox();
  expect(stackedLeft).not.toBeNull();
  expect(stackedRight).not.toBeNull();
  // Stacked: the right column starts below the left column, not beside it.
  expect(stackedRight!.y).toBeGreaterThanOrEqual(
    stackedLeft!.y + stackedLeft!.height
  );

  await noHorizontalOverflow(page);
});

test("the verification checkbox stays top-aligned with its label's first line, and remains keyboard-operable", async ({
  page,
}) => {
  await page.goto("/admin/items/iron-ore/edit");

  const checkbox = page.getByRole("checkbox", {
    name: /^Mark as verified for/,
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

test("sticky EditorActions stays sticky, keeps Save as a real submit control, and Delete opens its dialog in place", async ({
  page,
}) => {
  await page.goto("/admin/items/iron-ore/edit");

  const actions = page.locator(".admin-editor-actions");
  const position = await actions.evaluate((el) => getComputedStyle(el).position);
  expect(position).toBe("sticky");

  const saveButton = page.getByRole("button", { name: "Save Changes", exact: true });
  await expect(saveButton).toHaveAttribute("type", "submit");

  // Admin Polish Pass 1, Part 5: Delete is a button opening the shared
  // dialog directly over this editor, never an <a href> to a separate
  // route (that dedicated route still exists as a fallback — see
  // delete-record-dialog.tsx's own module comment).
  await page.getByRole("button", { name: "Delete item", exact: true }).click();
  await expect(page).toHaveURL("/admin/items/iron-ore/edit");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
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

  // Polled rather than a one-shot read: a freshly resized dev-mode page
  // can briefly report a stale/transitional aside box (still settling
  // from the previous viewport's flex layout) before it stabilizes.
  await expect
    .poll(async () => {
      const asideBox = await aside.boundingBox();
      return asideBox?.width;
    })
    .toBeLessThanOrEqual(320);

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

  // The withheld-delete dependency warning is still shown, and the delete
  // action is disabled (visible, never hidden) while the dependency blocks
  // it.
  await expect(
    page.getByText(/cannot be deleted because it is used as/)
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Delete Permanently", exact: true })
  ).toBeDisabled();

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
  // Admin Polish Pass 1, Part 5: Delete opens the shared dialog directly
  // over this list page, never navigating to a separate route.
  await currentRow.getByRole("button", { name: "Delete", exact: true }).click();

  await expect(page.locator(".confirm-card-eyebrow")).toHaveText(
    "Destructive action"
  );
  // Read-only: this route's own existing dependency-check behavior is
  // already covered by admin-game-versions.spec.ts — this test only
  // proves the eyebrow renders here too, and Cancel still closes the
  // dialog in place (never a navigable link here, since there is no
  // separate route to link to).
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL("/admin/settings/game-versions");
});
