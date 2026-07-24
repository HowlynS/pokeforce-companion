// Authenticated Item admin lifecycle against the REAL application and the
// isolated Supabase test project. Runs in the chromium-admin project with
// the storage state saved by auth.setup.ts. All temporary Item rows use
// the test-e2e-item slug prefix, the temporary Recipe/RecipeIngredient
// rows for the blocked-deletion tests use the separate
// test-e2e-item-relation- prefix, and everything is removed by
// guard-first, prefix-scoped cleanup in beforeAll/afterEach/afterAll — a
// mid-test failure can never strand a row. Seeded fixtures are read but
// never modified: seeded Categories are only ASSIGNED to temporary Items,
// the duplicate test only borrows a seeded NAME, and the relation tests
// link temporary Recipes only to temporary Items. No image file is ever
// provided: the optional image input stays empty, so no Storage object is
// written or deleted.

import { expect, test, type Page } from "@playwright/test";
import { selectAdminOption } from "./helpers/admin-select";
import {
  E2E_CURRENT_GAME_VERSION_NAME,
  countE2eTestItemRecords,
  createE2eTestGameVersion,
  createTemporaryIngredientReferenceToItem,
  createTemporaryRecipeProducingItem,
  deleteE2eTestGameVersionRecords,
  deleteE2eTestItemRecords,
  readFixtureCounts,
  removeTemporaryItemRelationRecords,
} from "./helpers/database-cleanup";

// The lifecycle flips both booleans between create and edit (tradeable
// Yes -> No, held item No -> Yes), which also keeps every row's "Yes" and
// "No" cells unique so exact-name cell locators never hit strict-mode
// collisions.
const INITIAL = {
  name: "Test E2E Item",
  slug: "test-e2e-item",
  description: "Created by the authenticated Item browser test.",
  category: "Materials",
  baseValue: "5",
} as const;

const EDITED = {
  name: "Test E2E Item Updated",
  slug: "test-e2e-item-updated",
  description: "Updated by the authenticated Item browser test.",
  category: "Tools",
  baseValue: "12",
} as const;

// The persistent test-only Game Version fixture, made current by
// auth.setup.ts before any admin spec runs; the verification test asserts
// this exact server-resolved name is stamped and shown in the admin UI.
const CURRENT_VERSION_NAME = E2E_CURRENT_GAME_VERSION_NAME;

const VERIFY_ITEM = {
  name: "Test E2E Item Verified",
  slug: "test-e2e-item-verified",
} as const;

// A NON-current browser-test version for the historical-selection flow;
// carries the test-e2e-gv- prefix so deleteE2eTestGameVersionRecords
// always catches it.
const HISTORICAL_VERSION_NAME = "test-e2e-gv-items-historical";

// The checkbox's own label text is now dynamic ("Mark as verified for
// {selected version's name}"), so every call site matches this pattern
// rather than one fixed string.
const VERIFICATION_CHECKBOX_LABEL = /^Mark as verified for/;

// Separate temporary Items for the two relation-blocked deletion tests, so
// neither depends on the lifecycle test's data or on each other.
const BLOCKED_RESULT = {
  name: "Test E2E Item Blocked Result",
  slug: "test-e2e-item-blocked-result",
} as const;

const BLOCKED_INGREDIENT = {
  name: "Test E2E Item Blocked Ingredient",
  slug: "test-e2e-item-blocked-ingredient",
} as const;

// Browser error hygiene: any uncaught page error fails the test. Serial
// single-worker execution makes this module-level state safe.
let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(async () => {
  // Defensive prefix-scoped cleanup even when a test failed mid-lifecycle:
  // temporary RecipeIngredient/Recipe rows first, then test Items, then the
  // browser-test Game Version the verification test creates (last — a
  // stamped Item RESTRICT-references it).
  await deleteE2eTestItemRecords();
  await deleteE2eTestGameVersionRecords();
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

test.beforeAll(async () => {
  // Remove stale rows from interrupted earlier runs; the guard inside the
  // helper throws here if the environment is not the verified test project.
  await deleteE2eTestItemRecords();
  await deleteE2eTestGameVersionRecords();
  expect(await countE2eTestItemRecords()).toBe(0);
});

test.afterAll(async () => {
  const remaining =
    (await deleteE2eTestItemRecords()) +
    (await deleteE2eTestGameVersionRecords());
  // afterEach should already have removed everything — fail loudly if not.
  expect(remaining).toBe(0);
});

// The public item card renders its title as an h3 inside the card link.
function cardLink(page: Page, name: string) {
  return page
    .getByRole("link")
    .filter({ has: page.getByRole("heading", { level: 3, name, exact: true }) });
}

// One row of the shared Item record list (Slice 9B.4), located by its
// exact primary text inside the list's navigation landmark.
function recordRow(page: Page, name: string) {
  return page
    .getByRole("navigation", { name: "Items records" })
    .getByRole("link")
    .filter({ has: page.getByText(name, { exact: true }) });
}

// Creates an item through the dedicated /admin/items/new page (navigating
// there itself) with name, slug, and description only, and submits. The
// optional image input is deliberately left untouched: creation must
// succeed with no image. Lands back on the workspace list with the new
// record visible.
async function createMinimalItemThroughForm(
  page: Page,
  data: { name: string; slug: string }
) {
  await page.goto("/admin/items/new");
  await page.getByLabel("Name", { exact: true }).fill(data.name);
  await page.getByLabel(/^Page address/).fill(data.slug);
  await page.getByRole("button", { name: "Create item", exact: true }).click();

  // The toast's own success param is consumed and stripped from the URL
  // almost immediately (AdminSuccessToast), so the URL is asserted at its
  // settled, query-free state; the toast text itself confirms which
  // outcome actually fired.
  await expect(page).toHaveURL(`/admin/items/${data.slug}/edit`);
  await expect(page.getByRole("status")).toHaveText("Item created");
  // The record list is part of the persistent ItemWorkspace shell, so the
  // new row is already visible here on the editor itself — no navigation
  // back to the list is needed.
  await expect(recordRow(page, data.name)).toBeVisible();
}

// One of the shared VerificationPanel's rows inside the Item edit page's
// aside column, located by its label (dt) text — scoped to the panel so
// "Current version" and "Verified for" can never collide when both
// happen to show the same Game Version name.
function verificationRow(page: Page, label: string) {
  return page
    .locator(".admin-panel")
    .filter({ has: page.getByRole("heading", { level: 2, name: "Verification", exact: true }) })
    .locator(".admin-panel-row")
    .filter({ hasText: label });
}

test("authenticated item admin access uses the saved storage state", async ({
  page,
}) => {
  await page.goto("/admin/items");

  // No redirect to /login: the saved state authenticates the request.
  await expect(page).toHaveURL("/admin/items");
  await expect(
    page.getByRole("heading", { level: 1, name: "Item Management" })
  ).toBeVisible();

  // The workspace landing state: the record list with its create link —
  // the embedded creation form is gone from this page (Slice 9B.4).
  await expect(
    page.getByRole("link", { name: "+ New", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create item", exact: true })
  ).toHaveCount(0);

  // Seeded items appear as record-list rows.
  await expect(recordRow(page, "Iron Ore")).toBeVisible();
  await expect(recordRow(page, "Iron Sword")).toBeVisible();
});

test("item create/edit/delete lifecycle through the real admin UI", async ({
  page,
}) => {
  // --- Create (all fields, optional image input left empty) ------------
  await page.goto("/admin/items");
  await expect(
    page.getByRole("heading", { level: 1, name: "Item Management" })
  ).toBeVisible();

  // The create form lives on its own page since Slice 9B.4, reached
  // through the record list's create action.
  await page.getByRole("link", { name: "+ New", exact: true }).click();
  await expect(page).toHaveURL("/admin/items/new");
  await expect(
    page.getByRole("heading", { level: 1, name: "Create item" })
  ).toBeVisible();

  await page.getByLabel("Name", { exact: true }).fill(INITIAL.name);
  await page.getByLabel(/^Page address/).fill(INITIAL.slug);
  await page.getByLabel(/^Description/).fill(INITIAL.description);
  // getByLabel cannot target the select exactly (a wrapping label's text
  // includes the option texts), so the accessible role/name is used.
  await selectAdminOption(
    page.getByRole("combobox", { name: "Category", exact: true }),
    INITIAL.category
  );
  // Held item stays unchecked: the omitted checkbox must resolve to false.
  await page.getByLabel("Tradeable").check();
  await page.getByLabel(/^Base value/).fill(INITIAL.baseValue);
  // The verification checkbox must render unchecked by default and stays
  // untouched here: a normal create must leave verification fields NULL.
  await expect(page.getByLabel(VERIFICATION_CHECKBOX_LABEL)).not.toBeChecked();
  await page.getByRole("button", { name: "Create item", exact: true }).click();

  await expect(page).toHaveURL(`/admin/items/${INITIAL.slug}/edit`);
  await expect(page.getByRole("status")).toHaveText("Item created");

  // The record list shows the new row with its Category as the secondary
  // context; the remaining submitted fields are asserted on the public
  // detail page below, which renders them all.
  const createdRow = recordRow(page, INITIAL.name);
  await expect(createdRow).toBeVisible();
  await expect(
    createdRow.getByText(INITIAL.category, { exact: true })
  ).toBeVisible();

  // Public detail page renders every field the UI shows for an item, plus
  // the no-image fallback. It has no recipe relations, so both optional
  // recipe sections (heading and empty state alike) are omitted.
  await page.goto(`/items/${INITIAL.slug}`);
  await expect(
    page.getByRole("heading", { level: 1, name: INITIAL.name, exact: true })
  ).toBeVisible();
  await expect(page.getByText(INITIAL.description)).toBeVisible();
  await expect(
    page.getByText(
      `Category: ${INITIAL.category} · Tradeable: Yes · Held item: No · Base value: ${INITIAL.baseValue}`
    )
  ).toBeVisible();
  // A newly created, never-verified item must not render a verification
  // line (both metadata fields are NULL).
  await expect(page.getByText("Gameplay data verified")).toHaveCount(0);
  await expect(page.getByText("No image available")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Produced by", exact: true })
  ).toHaveCount(0);
  await expect(page.getByText("No recipes produce this item")).toHaveCount(0);
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: "Used as an ingredient in",
      exact: true,
    })
  ).toHaveCount(0);
  await expect(page.getByText("Not used in any recipes")).toHaveCount(0);

  // Public list card appears and points at the detail route.
  await page.goto("/items");
  const createdCard = cardLink(page, INITIAL.name);
  await expect(createdCard).toBeVisible();
  await expect(createdCard).toHaveAttribute("href", `/items/${INITIAL.slug}`);

  // --- Edit (name, slug, description, Category reassignment, held item,
  // --- tradeable, base value; image untouched) --------------------------
  // Quick switching: the record-list row itself is the edit link, and the
  // open record is marked selected (aria-current) in the list.
  await page.goto("/admin/items");
  await recordRow(page, INITIAL.name).click();
  await expect(page).toHaveURL(`/admin/items/${INITIAL.slug}/edit`);
  // The editor's one h1 is the item's own name; its slug is the subtitle
  // context underneath (Slice 9B.5).
  await expect(
    page.getByRole("heading", { level: 1, name: INITIAL.name, exact: true })
  ).toBeVisible();
  await expect(page.getByText(INITIAL.slug, { exact: true })).toBeVisible();
  await expect(recordRow(page, INITIAL.name)).toHaveAttribute(
    "aria-current",
    "page"
  );
  // General is active; Acquisition Sources and Used in Recipes are both
  // real tab links — the Metadata tab was removed (Visual Pass sub-slice
  // 4), so exactly three Item tabs exist and none is a disabled
  // placeholder.
  const tabNav = page.getByRole("navigation", { name: "Item editor sections" });
  await expect(
    tabNav.getByRole("link", { name: "General", exact: true })
  ).toHaveAttribute("aria-current", "page");
  await expect(
    tabNav.getByRole("link", { name: "Acquisition Sources", exact: true })
  ).toBeVisible();
  await expect(
    tabNav.getByRole("link", { name: "Used in Recipes", exact: true })
  ).toBeVisible();
  await expect(tabNav.getByRole("link")).toHaveCount(3);
  await expect(tabNav.locator('[aria-disabled="true"]')).toHaveCount(0);

  await page.getByLabel("Name", { exact: true }).fill(EDITED.name);
  await page.getByLabel("Page address", { exact: true }).fill(EDITED.slug);
  await page.getByLabel(/^Description/).fill(EDITED.description);
  await selectAdminOption(
    page.getByRole("combobox", { name: "Category", exact: true }),
    EDITED.category
  );
  await page.getByLabel("Held item").check();
  await page.getByLabel("Tradeable").uncheck();
  await page.getByLabel(/^Base value/).fill(EDITED.baseValue);
  // Unchecked by default on the edit form too, and left untouched: this
  // normal edit must not stamp verification metadata.
  await expect(page.getByLabel(VERIFICATION_CHECKBOX_LABEL)).not.toBeChecked();
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();

  // The redirect follows the NEW slug (this save also renamed the item),
  // never the stale INITIAL.slug — the same canonical editor, now saved.
  await expect(page).toHaveURL(
    `/admin/items/${EDITED.slug}/edit`
  );
  await expect(page.getByRole("status")).toHaveText("Item saved");

  // The list reflects the rename and the reassigned Category; the flipped
  // booleans and new base value are asserted on the public page below.
  const editedRow = recordRow(page, EDITED.name);
  await expect(editedRow).toBeVisible();
  await expect(
    editedRow.getByText(EDITED.category, { exact: true })
  ).toBeVisible();

  // The slug changed, so the original public route must be gone...
  const staleResponse = await page.goto(`/items/${INITIAL.slug}`);
  expect(staleResponse?.status()).toBe(404);

  // ...and the new public detail page renders the edited values, including
  // the reassigned Category.
  await page.goto(`/items/${EDITED.slug}`);
  await expect(
    page.getByRole("heading", { level: 1, name: EDITED.name, exact: true })
  ).toBeVisible();
  await expect(page.getByText(EDITED.description)).toBeVisible();
  await expect(
    page.getByText(
      `Category: ${EDITED.category} · Tradeable: No · Held item: Yes · Base value: ${EDITED.baseValue}`
    )
  ).toBeVisible();
  // The normal edit above never touched the verification checkbox, so the
  // item must still render as unverified.
  await page.goto(`/admin/items/${EDITED.slug}/edit`);
  await expect(verificationRow(page, "Verified for")).toHaveCount(0);

  await page.goto("/items");
  const editedCard = cardLink(page, EDITED.name);
  await expect(editedCard).toBeVisible();
  await expect(editedCard).toHaveAttribute("href", `/items/${EDITED.slug}`);

  // --- Delete -----------------------------------------------------------
  // Delete opens the shared confirmation dialog directly over the edit
  // page (Admin Polish Pass 1, Part 5) — no route change until the
  // deletion itself succeeds.
  await page.goto("/admin/items");
  await recordRow(page, EDITED.name).click();
  await expect(page).toHaveURL(`/admin/items/${EDITED.slug}/edit`);
  await page.getByRole("button", { name: "Delete item", exact: true }).click();
  await expect(page).toHaveURL(`/admin/items/${EDITED.slug}/edit`);
  await expect(
    page.getByRole("heading", { level: 2, name: "Delete Item" })
  ).toBeVisible();
  // The confirmation identifies exactly this item by name, slug, Category,
  // and both recipe-reference counts.
  await expect(page.getByText(`(${EDITED.slug})`)).toBeVisible();
  await expect(page.getByText(`Category: ${EDITED.category}`)).toBeVisible();
  await expect(page.getByText("Used as a recipe result: 0")).toBeVisible();
  await expect(page.getByText("Used as a recipe ingredient: 0")).toBeVisible();

  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete Permanently", exact: true })
    .click();

  await expect(page).toHaveURL("/admin/items");
  await expect(page.getByRole("status")).toHaveText("Item deleted");
  await expect(recordRow(page, EDITED.name)).toHaveCount(0);

  // Gone from the public site as well.
  const deletedResponse = await page.goto(`/items/${EDITED.slug}`);
  expect(deletedResponse?.status()).toBe(404);

  await page.goto("/items");
  await expect(cardLink(page, EDITED.name)).toHaveCount(0);
});

test("gameplay verification stamps the selected game version, stays admin-only, and survives normal edits", async ({
  page,
}) => {
  // A NON-current historical version for the picker flows below.
  await createE2eTestGameVersion(HISTORICAL_VERSION_NAME);

  // --- Create unverified (picker and checkbox untouched) ----------------
  await createMinimalItemThroughForm(page, VERIFY_ITEM);

  await page.goto(`/items/${VERIFY_ITEM.slug}`);
  await expect(
    page.getByRole("heading", { level: 1, name: VERIFY_ITEM.name, exact: true })
  ).toBeVisible();
  await expect(page.getByText("Gameplay data verified")).toHaveCount(0);

  // --- The shared VerificationPanel shows Unverified with no stamp rows,
  // and the picker lists versions and defaults to the current one -------
  await page.goto(`/admin/items/${VERIFY_ITEM.slug}/edit`);
  await expect(
    page.locator(".admin-status-badge", { hasText: "Unverified" })
  ).toBeVisible();
  await expect(verificationRow(page, "Verified for")).toHaveCount(0);
  // AdminSelect (Massive Admin Interaction Completion Pass, Phase 1)
  // replaced the native <select> here — the current version is preselected
  // as the trigger's own displayed text, and the historical version is
  // confirmed present by opening the panel rather than querying
  // <option:checked>, which no longer exists.
  const picker = page.getByLabel("Verify this record for");
  await expect(picker, "the current version is preselected").toHaveText(
    `${CURRENT_VERSION_NAME} (current)`
  );
  await picker.click();
  await expect(
    page.getByRole("option", { name: HISTORICAL_VERSION_NAME, exact: true })
  ).toHaveCount(1);
  await page.keyboard.press("Escape");

  // --- Verify via the explicit opt-in checkbox (picker untouched) -------
  const verifyCheckbox = page.getByLabel(VERIFICATION_CHECKBOX_LABEL);
  await expect(verifyCheckbox).not.toBeChecked();
  await verifyCheckbox.check();
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(page).toHaveURL(
    `/admin/items/${VERIFY_ITEM.slug}/edit`
  );
  // Guards against the isolated test database's brief read-after-write
  // consistency lag (observed empirically: a read immediately after a
  // write can occasionally return the pre-write row) — a fixed short
  // wait, not a retry loop.
  await page.waitForTimeout(500);

  // The admin edit page shows the stamp carrying the preselected current
  // Game Version, resolved and validated server-side, classified as
  // verified-for-the-current-version by the shared panel. Save-in-place
  // already lands here — a redundant same-URL page.goto right after would
  // race the still-settling client navigation and can observe stale,
  // pre-mutation content, so the persisted state is checked directly.
  await expect(
    page.locator(".admin-status-badge", {
      hasText: "Verified — current version",
    })
  ).toBeVisible();
  await expect(verificationRow(page, "Verified for")).toContainText(
    CURRENT_VERSION_NAME
  );
  const stampedDateText = await verificationRow(page, "Verified on").textContent();

  // Verification is admin-only since Slice 9A: the PUBLIC page must not
  // render it even for a verified item.
  await page.goto(`/items/${VERIFY_ITEM.slug}`);
  await expect(page.getByText("Gameplay data verified")).toHaveCount(0);
  await expect(page.getByText(CURRENT_VERSION_NAME)).toHaveCount(0);

  // --- A NORMAL edit, even one that moves the picker, must not alter the
  // stamp: the picker only ever proposes a version, and nothing is written
  // while the checkbox stays unchecked. ----------------------------------
  await page.goto(`/admin/items/${VERIFY_ITEM.slug}/edit`);
  // Unchecked by default on every render, even for an already-verified
  // item: verification is a per-save action, not persistent form state.
  await expect(page.getByLabel(VERIFICATION_CHECKBOX_LABEL)).not.toBeChecked();
  await selectAdminOption(
    page.getByLabel("Verify this record for"),
    HISTORICAL_VERSION_NAME
  );
  await page
    .getByLabel(/^Description/)
    .fill("Edited without touching verification.");
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(page).toHaveURL(
    `/admin/items/${VERIFY_ITEM.slug}/edit`
  );
  // Guards against the isolated test database's brief read-after-write
  // consistency lag (observed empirically: a read immediately after a
  // write can occasionally return the pre-write row) — a fixed short
  // wait, not a retry loop, since the very next assertion is a fresh
  // navigation/read that must see the just-committed value.
  await page.waitForTimeout(500);

  await page.goto(`/items/${VERIFY_ITEM.slug}`);
  await expect(page.getByText("Edited without touching verification.")).toBeVisible();

  await page.goto(`/admin/items/${VERIFY_ITEM.slug}/edit`);
  await page.waitForTimeout(500);
  await expect(
    page.locator(".admin-status-badge", {
      hasText: "Verified — current version",
    })
  ).toBeVisible();
  await expect(verificationRow(page, "Verified for")).toContainText(
    CURRENT_VERSION_NAME
  );
  expect(await verificationRow(page, "Verified on").textContent()).toBe(
    stampedDateText
  );

  // --- Verifying against a SELECTED historical version ------------------
  await selectAdminOption(
    page.getByLabel("Verify this record for"),
    HISTORICAL_VERSION_NAME
  );
  await page.getByLabel(VERIFICATION_CHECKBOX_LABEL).check();
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(page).toHaveURL(
    `/admin/items/${VERIFY_ITEM.slug}/edit`
  );
  // Guards against the isolated test database's brief read-after-write
  // consistency lag (observed empirically: a read immediately after a
  // write can occasionally return the pre-write row) — a fixed short
  // wait, not a retry loop.
  await page.waitForTimeout(500);
  await expect(
    page.locator(".admin-status-badge", {
      hasText: "Verified — older version",
    })
  ).toBeVisible();
  await expect(verificationRow(page, "Verified for")).toContainText(
    HISTORICAL_VERSION_NAME
  );

  // The historical stamp stays admin-only on the public page too.
  await page.goto(`/items/${VERIFY_ITEM.slug}`);
  await expect(page.getByText("Gameplay data verified")).toHaveCount(0);
  await expect(page.getByText(HISTORICAL_VERSION_NAME)).toHaveCount(0);
});

test("creating an item with a seeded name is rejected server-side", async ({
  page,
}) => {
  await page.goto("/admin/items/new");

  // Seeded name "Iron Ore" in different casing with surrounding
  // whitespace: the server trims the name and its duplicate check is
  // case-insensitive, so this must be rejected. The slug carries the test
  // prefix so cleanup would catch the row if creation ever slipped through.
  await page.getByLabel("Name", { exact: true }).fill("  iron ore  ");
  await page.getByLabel(/^Page address/).fill("test-e2e-item-duplicate");
  await page.getByRole("button", { name: "Create item", exact: true }).click();

  // Rejections land back on the creation page, where the form lives.
  await expect(page).toHaveURL("/admin/items/new?error=duplicate_name");
  // Next.js injects a hidden route-announcer div that also has role=alert,
  // so the application's alert is located by its exact readable text.
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "An item with that name already exists." })
  ).toBeVisible();

  // Back on a safe form state, and nothing was written.
  await expect(
    page.getByRole("button", { name: "Create item", exact: true })
  ).toBeVisible();
  expect(await countE2eTestItemRecords()).toBe(0);
});

test("deletion is blocked while a recipe produces the item", async ({
  page,
}) => {
  // The temporary Item is created through the real admin UI; only the
  // producing Recipe is set up through the guarded database helper,
  // because Recipe admin browser workflows are out of scope for this
  // suite.
  await createMinimalItemThroughForm(page, BLOCKED_RESULT);

  // Open the confirmation page while the item is still unreferenced: both
  // counts are zero and the delete button is offered.
  await page.goto(`/admin/items/${BLOCKED_RESULT.slug}/delete`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Delete Item" })
  ).toBeVisible();
  await expect(page.getByText("Used as a recipe result: 0")).toBeVisible();
  await expect(page.getByText("Used as a recipe ingredient: 0")).toBeVisible();
  const deleteButton = page.getByRole("button", {
    name: "Delete Permanently",
    exact: true,
  });
  await expect(deleteButton).toBeVisible();

  // Make the item a Recipe RESULT after the page loaded, then confirm
  // deletion: the server action re-checks both reference counts
  // immediately before deleting, so the stale confirmation page must not
  // slip through.
  await createTemporaryRecipeProducingItem(BLOCKED_RESULT.slug);
  await deleteButton.click();

  await expect(page).toHaveURL(
    `/admin/items/${BLOCKED_RESULT.slug}/delete?error=linked_recipes`
  );
  await expect(
    page.getByRole("alert").filter({
      hasText:
        "This item cannot be deleted because it is used as the result of 1 recipe.",
    })
  ).toBeVisible();

  // The re-rendered confirmation page also blocks statically: the count is
  // shown, the warning explains the rule, and the delete action is
  // disabled (visible, never hidden — the dialog keeps the blocked reason
  // and the action it explains in view together).
  await expect(page.getByText("Used as a recipe result: 1")).toBeVisible();
  await expect(
    page.getByText("Remove or reassign those recipe references first.")
  ).toBeVisible();
  await expect(deleteButton).toBeDisabled();

  // The item survived, in the admin record list and on the public site,
  // where the temporary recipe is rendered through the real relation.
  await page.goto("/admin/items");
  await expect(recordRow(page, BLOCKED_RESULT.name)).toBeVisible();
  await page.goto(`/items/${BLOCKED_RESULT.slug}`);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: BLOCKED_RESULT.name,
      exact: true,
    })
  ).toBeVisible();
  await expect(
    cardLink(page, "Test E2E Item Relation Producing Recipe")
  ).toBeVisible();

  // Safely remove ONLY the temporary Recipe, then delete the item through
  // the real confirmation flow.
  expect(await removeTemporaryItemRelationRecords()).toBe(1);

  await page.goto(`/admin/items/${BLOCKED_RESULT.slug}/delete`);
  await expect(page.getByText("Used as a recipe result: 0")).toBeVisible();
  await page
    .getByRole("button", { name: "Delete Permanently", exact: true })
    .click();

  await expect(page).toHaveURL("/admin/items");
  await expect(page.getByRole("status")).toHaveText("Item deleted");
  await expect(recordRow(page, BLOCKED_RESULT.name)).toHaveCount(0);

  const deletedResponse = await page.goto(`/items/${BLOCKED_RESULT.slug}`);
  expect(deletedResponse?.status()).toBe(404);
});

test("deletion is blocked while the item is a recipe ingredient", async ({
  page,
}) => {
  await createMinimalItemThroughForm(page, BLOCKED_INGREDIENT);

  await page.goto(`/admin/items/${BLOCKED_INGREDIENT.slug}/delete`);
  await expect(page.getByText("Used as a recipe ingredient: 0")).toBeVisible();
  const deleteButton = page.getByRole("button", {
    name: "Delete Permanently",
    exact: true,
  });
  await expect(deleteButton).toBeVisible();

  // Make the item a Recipe INGREDIENT (helper result Item + Recipe +
  // RecipeIngredient) after the page loaded, then confirm deletion: the
  // action's re-check must block on the ingredient path as well.
  await createTemporaryIngredientReferenceToItem(BLOCKED_INGREDIENT.slug);
  await deleteButton.click();

  await expect(page).toHaveURL(
    `/admin/items/${BLOCKED_INGREDIENT.slug}/delete?error=linked_recipes`
  );
  await expect(
    page.getByRole("alert").filter({
      hasText:
        "This item cannot be deleted because it is used as an ingredient in 1 recipe.",
    })
  ).toBeVisible();

  // Static block on the re-render, with the ingredient count shown.
  await expect(page.getByText("Used as a recipe ingredient: 1")).toBeVisible();
  await expect(
    page.getByText("Remove or reassign those recipe references first.")
  ).toBeVisible();
  await expect(deleteButton).toBeDisabled();

  // The item survived; its public page renders the consuming recipe
  // through the real ingredient relation.
  await page.goto(`/items/${BLOCKED_INGREDIENT.slug}`);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: BLOCKED_INGREDIENT.name,
      exact: true,
    })
  ).toBeVisible();
  await expect(
    cardLink(page, "Test E2E Item Relation Consuming Recipe")
  ).toBeVisible();

  // Safely remove ONLY the temporary relation rows (RecipeIngredient,
  // Recipe, and helper result Item), then delete through the real flow.
  expect(await removeTemporaryItemRelationRecords()).toBe(3);

  await page.goto(`/admin/items/${BLOCKED_INGREDIENT.slug}/delete`);
  await expect(page.getByText("Used as a recipe ingredient: 0")).toBeVisible();
  await page
    .getByRole("button", { name: "Delete Permanently", exact: true })
    .click();

  await expect(page).toHaveURL("/admin/items");
  await expect(page.getByRole("status")).toHaveText("Item deleted");
  await expect(recordRow(page, BLOCKED_INGREDIENT.name)).toHaveCount(0);

  const deletedResponse = await page.goto(
    `/items/${BLOCKED_INGREDIENT.slug}`
  );
  expect(deletedResponse?.status()).toBe(404);
});

test("record-list search filters instantly while typing, preserves the query across switching, and clears — no Search button, no page reload", async ({
  page,
}) => {
  // Two temporary items sharing the test prefix, so one query matches
  // both while seeded records stay out of the way.
  await createMinimalItemThroughForm(page, INITIAL);
  await createMinimalItemThroughForm(page, VERIFY_ITEM);

  await page.goto("/admin/items");
  await expect(
    page.getByRole("button", { name: "Search", exact: true })
  ).toHaveCount(0);

  const totalMatch = (await page.getByText(/^\d+ items$/).textContent()) ?? "";
  const totalCount = Number(totalMatch.match(/\d+/)?.[0] ?? "0");
  expect(totalCount).toBeGreaterThan(0);

  // --- Filter by NAME (trimmed, case-insensitive) — typing alone
  // filters immediately, no click, no navigation ------------------------
  const searchbox = page.getByRole("searchbox", { name: "Search items" });
  await searchbox.fill("  test e2e item  ");
  await expect(recordRow(page, INITIAL.name)).toBeVisible();
  await expect(recordRow(page, VERIFY_ITEM.name)).toBeVisible();
  await expect(recordRow(page, "Iron Ore")).toHaveCount(0);
  await expect(page.getByText("2 of ", { exact: false })).toBeVisible();

  // The address bar picks up the trimmed filter shortly after typing
  // stops, with no page reload (still the same document/session).
  await expect(page).toHaveURL(/\/admin\/items\?q=/);

  // --- Quick switching keeps the query applied --------------------------
  await recordRow(page, INITIAL.name).click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/items/${INITIAL.slug}/edit\\?q=`)
  );
  await expect(recordRow(page, INITIAL.name)).toHaveAttribute(
    "aria-current",
    "page"
  );

  // Switch directly to the second match: the list stays filtered, the
  // selection follows, and the first record is no longer marked.
  await recordRow(page, VERIFY_ITEM.name).click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/items/${VERIFY_ITEM.slug}/edit\\?q=`)
  );
  await expect(recordRow(page, VERIFY_ITEM.name)).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(recordRow(page, INITIAL.name)).not.toHaveAttribute(
    "aria-current",
    "page"
  );

  // The create action keeps the filter context too.
  await expect(
    page.getByRole("link", { name: "+ New", exact: true })
  ).toHaveAttribute("href", /\/admin\/items\/new\?q=/);

  // --- Filter by Page address (slug) ------------------------------------
  await page.goto("/admin/items");
  await page.getByRole("searchbox", { name: "Search items" }).fill(VERIFY_ITEM.slug);
  await expect(recordRow(page, VERIFY_ITEM.name)).toBeVisible();
  await expect(recordRow(page, INITIAL.name)).toHaveCount(0);
  await expect(page.getByText("1 of ", { exact: false })).toBeVisible();

  // --- No-match state (distinct from the no-items-at-all state) ---------
  await page
    .getByRole("searchbox", { name: "Search items" })
    .fill("zzz-no-such-item");
  const emptyRegion = page.locator(".admin-record-empty");
  await expect(emptyRegion).toContainText("No matching records.");
  await expect(page.getByText(/^0 of \d+ items$/)).toBeVisible();

  // --- Escape clears the query and keeps focus in the field --------------
  await page
    .getByRole("searchbox", { name: "Search items" })
    .press("Escape");
  await expect(page.getByRole("searchbox", { name: "Search items" })).toHaveValue("");
  await expect(page.getByRole("searchbox", { name: "Search items" })).toBeFocused();
  await expect(recordRow(page, "Iron Ore")).toBeVisible();
  await expect(recordRow(page, INITIAL.name)).toBeVisible();
  await expect(page.getByText(new RegExp(`^${totalCount} items$`))).toBeVisible();

  // --- The inline clear button restores the full list, and only appears
  // while a filter is active ---------------------------------------------
  await searchbox.fill(VERIFY_ITEM.slug);
  await expect(recordRow(page, INITIAL.name)).toHaveCount(0);
  const clearButton = page.getByRole("button", { name: "Clear search" });
  await expect(clearButton).toBeVisible();
  await clearButton.click();
  await expect(searchbox).toHaveValue("");
  await expect(recordRow(page, "Iron Ore")).toBeVisible();
  await expect(recordRow(page, INITIAL.name)).toBeVisible();
  await expect(page.getByRole("button", { name: "Clear search" })).toHaveCount(0);

  // Blanking the filter removes `q` from the address bar entirely.
  await expect(page).toHaveURL("/admin/items");
});

test("Back and Forward restore the record-list filter, and switching records while filtered leaves the open editor in place if it no longer matches", async ({
  page,
}) => {
  await createMinimalItemThroughForm(page, INITIAL);

  await page.goto("/admin/items");
  await page
    .getByRole("searchbox", { name: "Search items" })
    .fill(INITIAL.slug);
  await expect(recordRow(page, INITIAL.name)).toBeVisible();
  await expect(recordRow(page, "Iron Ore")).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/admin/items\\?q=${INITIAL.slug}`));

  // Open the filtered record, then go Back: the filter text is restored
  // from the address bar without a full page reload breaking anything.
  await recordRow(page, INITIAL.name).click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/items/${INITIAL.slug}/edit\\?q=`)
  );
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/admin/items\\?q=${INITIAL.slug}`));
  await expect(
    page.getByRole("searchbox", { name: "Search items" })
  ).toHaveValue(INITIAL.slug);
  await expect(recordRow(page, INITIAL.name)).toBeVisible();

  await page.goForward();
  await expect(page).toHaveURL(
    new RegExp(`/admin/items/${INITIAL.slug}/edit\\?q=`)
  );

  // With the INITIAL item's own editor still open, typing a filter that
  // no longer matches it must not close or reset the open editor.
  await page
    .getByRole("searchbox", { name: "Search items" })
    .fill("zzz-no-such-item");
  await expect(recordRow(page, INITIAL.name)).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 1, name: INITIAL.name, exact: true })
  ).toBeVisible();
});

test("seeded fixtures are preserved and no test item remains", async () => {
  expect(await readFixtureCounts()).toEqual({
    categories: 5,
    professions: 10,
    items: 16,
    recipes: 8,
    recipeIngredients: 15,
  });
  expect(await countE2eTestItemRecords()).toBe(0);
});
