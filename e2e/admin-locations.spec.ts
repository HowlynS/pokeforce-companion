// Authenticated Location admin lifecycle against the REAL application and
// the isolated Supabase test project. Runs in the chromium-admin project
// with the storage state saved by auth.setup.ts. All temporary Location
// rows use the test-e2e-location slug prefix and are removed by
// guard-first, prefix-scoped cleanup in beforeAll/afterEach/afterAll — a
// mid-test failure can never strand a row. No Location fixtures are
// seeded, so this suite creates every parent/child relation it needs
// through the real admin UI (the create/edit forms already support
// selecting an existing Location as a parent — no separate raw-SQL
// relation helper is needed, unlike Profession/Item). No image file is
// ever provided in the non-image tests: the optional image input stays
// empty, so no Storage object is written or deleted.
//
// Slice 9F.1 moved Location onto the shared admin workspace/record-list:
// the embedded creation form is gone from /admin/locations (now the
// workspace landing state), creation moved to the dedicated
// /admin/locations/new route, and Delete is reached from the edit page's
// toolbar instead of a per-row table action — mirroring the Item/Recipe/
// Profession/Category workspaces' own navigation-foundation slices
// exactly. Slice 9F.2 converted General to the shared editor primitives
// (EditorHeader/EditorTabs/ImagePanel/VerificationPanel/TimestampsPanel/
// EditorActions) — the old inline "Edit Location" heading, "Update
// details..." subtitle sentence, and "Gameplay data verified for X on Y"
// paragraph are gone, replaced by the record's own name as the h1, its
// slug as the subtitle, and the shared VerificationPanel's status badge
// and rows. Every CRUD, hierarchy, verification, and image behavior below
// is otherwise unchanged.

import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  E2E_CURRENT_GAME_VERSION_NAME,
  countE2eTestLocationRecords,
  createE2eTestGameVersion,
  deleteE2eTestGameVersionRecords,
  deleteE2eTestLocationRecords,
} from "./helpers/database-cleanup";

// The persistent test-only Game Version fixture, made current by
// auth.setup.ts before any admin spec runs.
const CURRENT_VERSION_NAME = E2E_CURRENT_GAME_VERSION_NAME;

// A NON-current browser-test version for the historical-selection flow;
// carries the test-e2e-gv- prefix so deleteE2eTestGameVersionRecords
// always catches it.
const HISTORICAL_VERSION_NAME = "test-e2e-gv-locations-historical";

const INITIAL = {
  name: "Test E2E Location",
  slug: "test-e2e-location",
  type: "Town",
  description: "Created by the authenticated Location browser test.",
  accessNote: "Reachable via the north bridge.",
} as const;

const EDITED = {
  name: "Test E2E Location Updated",
  slug: "test-e2e-location-updated",
  type: "Region",
  description: "Updated by the authenticated Location browser test.",
  accessNote: "Reachable via the south road.",
} as const;

// A separate parent/child pair for the blocked-deletion test, so it never
// depends on the lifecycle test's data.
const BLOCKED_PARENT = {
  name: "Test E2E Location Blocked Parent",
  slug: "test-e2e-location-blocked-parent",
  type: "Region",
} as const;

const BLOCKED_CHILD = {
  name: "Test E2E Location Blocked Child",
  slug: "test-e2e-location-blocked-child",
  type: "Town",
} as const;

// A separate ancestor/descendant pair for the cycle-rejection test.
const CYCLE_ANCESTOR = {
  name: "Test E2E Location Cycle Ancestor",
  slug: "test-e2e-location-cycle-ancestor",
  type: "Region",
} as const;

const CYCLE_DESCENDANT = {
  name: "Test E2E Location Cycle Descendant",
  slug: "test-e2e-location-cycle-descendant",
  type: "Town",
} as const;

const VERIFY_LOCATION = {
  name: "Test E2E Location Verified",
  slug: "test-e2e-location-verified",
  type: "Dungeon",
} as const;

const VERIFICATION_CHECKBOX_LABEL =
  "Mark gameplay data as verified for the selected game version.";

// Browser error hygiene: any uncaught page error fails the test. Serial
// single-worker execution makes this module-level state safe.
let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(async () => {
  // Defensive prefix-scoped cleanup even when a test failed mid-lifecycle:
  // test Locations first, then the browser-test Game Version the
  // verification test creates (last — a stamped Location RESTRICT-
  // references it).
  await deleteE2eTestLocationRecords();
  await deleteE2eTestGameVersionRecords();
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

test.beforeAll(async () => {
  // Remove stale rows from interrupted earlier runs; the guard inside the
  // helper throws here if the environment is not the verified test project.
  await deleteE2eTestLocationRecords();
  await deleteE2eTestGameVersionRecords();
  expect(await countE2eTestLocationRecords()).toBe(0);
});

test.afterAll(async () => {
  const remaining =
    (await deleteE2eTestLocationRecords()) +
    (await deleteE2eTestGameVersionRecords());
  // afterEach should already have removed everything — fail loudly if not.
  expect(remaining).toBe(0);
});

// One row of the shared Location record list (Slice 9F.1), located by its
// exact primary text inside the list's navigation landmark. The row link
// itself opens the edit route — there is no separate per-row Edit/Delete
// action any more (Delete is reached from the edit page's toolbar).
function recordRow(page: Page, name: string) {
  return page
    .getByRole("navigation", { name: "Locations records" })
    .getByRole("link")
    .filter({ has: page.getByText(name, { exact: true }) });
}

// One of the shared panels' rows (Verification or Timestamps) in the
// Location editor's aside, located by its label (dt) text — scoped to
// the panel by heading so identical row labels can never collide. The
// row's dt/dd text is concatenated with no separator, so the filter is
// anchored to the START of the row's text — otherwise "Current version"
// would also match the unrelated "Verified — current version" status
// badge's own "admin-panel-row" wrapper (case-insensitive substring).
function panelRow(page: Page, panelTitle: string, label: string) {
  return page
    .locator(".admin-panel")
    .filter({
      has: page.getByRole("heading", { level: 2, name: panelTitle, exact: true }),
    })
    .locator(".admin-panel-row")
    .filter({ hasText: new RegExp(`^${label}`) });
}

// Reads the visible text of a <select>'s currently selected option, for
// prefill assertions where option values (database ids) are unknown.
async function selectedOptionLabel(select: Locator): Promise<string> {
  return select.evaluate(
    (el) =>
      (el as HTMLSelectElement).selectedOptions[0]?.textContent?.trim() ?? ""
  );
}

// Fills the create form on /admin/locations/new (the page must already be
// open — the dedicated creation route since Slice 9F.1) and submits it.
// The optional image input, parent, description, and access note are only
// filled when supplied.
async function createLocationThroughForm(
  page: Page,
  data: {
    name: string;
    slug: string;
    type: string;
    description?: string;
    accessNote?: string;
    parentName?: string;
  }
) {
  await page.getByLabel("Name", { exact: true }).fill(data.name);
  await page.getByLabel(/^Slug/).fill(data.slug);
  await page
    .getByRole("combobox", { name: "Type", exact: true })
    .selectOption({ label: data.type });
  if (data.parentName) {
    await page
      .getByRole("combobox", { name: "Parent location", exact: true })
      .selectOption({ label: data.parentName });
  }
  if (data.description) {
    await page.getByLabel(/^Description/).fill(data.description);
  }
  if (data.accessNote) {
    await page.getByLabel(/^Access or unlock note/).fill(data.accessNote);
  }
  await page.getByRole("button", { name: "Create Location", exact: true }).click();

  await expect(page).toHaveURL("/admin/locations?success=created");
  await expect(page.getByRole("status")).toHaveText("Location created.");
  await expect(recordRow(page, data.name)).toBeVisible();
}

test("authenticated location admin access uses the saved storage state", async ({
  page,
}) => {
  await page.goto("/admin/locations");

  // No redirect to /login: the saved state authenticates the request.
  await expect(page).toHaveURL("/admin/locations");
  await expect(
    page.getByRole("heading", { level: 1, name: "Location Management" })
  ).toBeVisible();

  // The workspace landing state: the record list with its create link —
  // the embedded creation form is gone from this page (Slice 9F.1,
  // following the Item/Recipe/Profession/Category workspaces' own
  // navigation-foundation precedent).
  await expect(
    page.getByRole("link", { name: "+ New location", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create Location", exact: true })
  ).toHaveCount(0);
  await expect(page.getByLabel("Name", { exact: true })).toHaveCount(0);
});

test("Create Location opens the dedicated creation route", async ({ page }) => {
  await page.goto("/admin/locations");
  await page.getByRole("link", { name: "+ New location", exact: true }).click();

  await expect(page).toHaveURL("/admin/locations/new");
  await expect(
    page.getByRole("heading", { level: 1, name: "Create Location" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create Location", exact: true })
  ).toBeVisible();
});

test("Location editor: create shows only General with its own parent selector; edit marks General active with Hierarchy, Acquisition Sources, and Metadata all real; exactly one h1 renders; Timestamps render on edit only", async ({
  page,
}) => {
  // --- Create: exactly one h1, one real tab, no disabled placeholders,
  // Image panel present, no Timestamps panel (nothing to show yet), and
  // the parent selector still lives right here (Slice 9F.3 moved parent
  // assignment out of General edit, but create never had a General/
  // Hierarchy split — there is no record yet to have a Hierarchy tab
  // for) -----------------------------------------------------------------
  await page.goto("/admin/locations/new");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  const createTabNav = page.getByRole("navigation", {
    name: "Location editor sections",
  });
  await expect(
    createTabNav.getByRole("link", { name: "General", exact: true })
  ).toHaveAttribute("aria-current", "page");
  await expect(createTabNav.getByText("Hierarchy")).toHaveCount(0);
  await expect(createTabNav.getByText("Acquisition Sources")).toHaveCount(0);
  await expect(createTabNav.getByText("Metadata")).toHaveCount(0);
  await expect(
    page.getByRole("combobox", { name: "Parent location", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Image", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Timestamps", exact: true })
  ).toHaveCount(0);

  await createLocationThroughForm(page, {
    name: "Test E2E Location Tabs",
    slug: "test-e2e-location-tabs",
    type: "Town",
    description: "Verifies the shared editor structure.",
  });

  // --- Edit: exactly one h1 (the location's own name), General active,
  // Hierarchy, Acquisition Sources, and Metadata all now real (but not
  // current) tabs — no Location tab remains disabled — Timestamps
  // present (Created/Updated, no Verified stamp yet), and NO parent
  // selector anywhere on General (Slice 9F.3 moved it to Hierarchy) -----
  await recordRow(page, "Test E2E Location Tabs").click();
  await expect(page).toHaveURL("/admin/locations/test-e2e-location-tabs/edit");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Test E2E Location Tabs",
      exact: true,
    })
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Parent location", exact: true })
  ).toHaveCount(0);

  const editTabNav = page.getByRole("navigation", {
    name: "Location editor sections",
  });
  await expect(
    editTabNav.getByRole("link", { name: "General", exact: true })
  ).toHaveAttribute("aria-current", "page");
  await expect(editTabNav.locator('[aria-current="page"]')).toHaveCount(1);
  await expect(
    editTabNav.getByRole("link", { name: "Hierarchy", exact: true })
  ).not.toHaveAttribute("aria-current", "page");
  await expect(
    editTabNav.getByText("Hierarchy", { exact: true })
  ).not.toHaveAttribute("aria-disabled", "true");
  await expect(
    editTabNav.getByRole("link", {
      name: "Acquisition Sources",
      exact: true,
    })
  ).not.toHaveAttribute("aria-current", "page");
  await expect(
    editTabNav.getByText("Acquisition Sources", { exact: true })
  ).not.toHaveAttribute("aria-disabled", "true");
  await expect(
    editTabNav.getByRole("link", { name: "Metadata", exact: true })
  ).not.toHaveAttribute("aria-current", "page");
  await expect(
    editTabNav.getByText("Metadata", { exact: true })
  ).not.toHaveAttribute("aria-disabled", "true");
  await expect(editTabNav.locator('[aria-disabled="true"]')).toHaveCount(0);

  await expect(
    page.getByRole("heading", { level: 2, name: "Image", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Timestamps", exact: true })
  ).toBeVisible();
  await expect(panelRow(page, "Timestamps", "Created")).toBeVisible();
  await expect(panelRow(page, "Timestamps", "Updated")).toBeVisible();
  await expect(panelRow(page, "Timestamps", "Verified")).toHaveCount(0);

  // --- Hierarchy tab: marks itself active, General becomes the real
  // link back, no image/verification/unrelated General controls render
  // here at all --------------------------------------------------------
  await editTabNav.getByRole("link", { name: "Hierarchy", exact: true }).click();
  await expect(page).toHaveURL(
    "/admin/locations/test-e2e-location-tabs/hierarchy"
  );
  const hierarchyTabNav = page.getByRole("navigation", {
    name: "Location editor sections",
  });
  await expect(
    hierarchyTabNav.getByRole("link", { name: "Hierarchy", exact: true })
  ).toHaveAttribute("aria-current", "page");
  await expect(
    hierarchyTabNav.getByRole("link", { name: "General", exact: true })
  ).not.toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("combobox", { name: "Parent location", exact: true })
  ).toBeVisible();
  await expect(page.getByLabel("Name", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Slug", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("combobox", { name: "Type", exact: true })
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 2, name: "Image", exact: true })
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 2, name: "Verification", exact: true })
  ).toHaveCount(0);
  await expect(page.getByLabel(VERIFICATION_CHECKBOX_LABEL)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Save Hierarchy", exact: true })
  ).toBeVisible();
  // No sub-locations yet: the restrained empty state renders, never an
  // empty table.
  await expect(
    page.getByRole("heading", { level: 2, name: "Sub-locations", exact: true })
  ).toHaveCount(0);
  await expect(page.getByText("No sub-locations yet")).toBeVisible();
});

test("location create/edit/delete lifecycle through the real admin UI", async ({
  page,
}) => {
  // --- Create (with the optional image input left empty) ---------------
  await page.goto("/admin/locations");
  await expect(
    page.getByRole("heading", { level: 1, name: "Location Management" })
  ).toBeVisible();

  await page.getByRole("link", { name: "+ New location", exact: true }).click();
  await expect(page).toHaveURL("/admin/locations/new");
  await createLocationThroughForm(page, INITIAL);

  // Public detail page renders the new location with the no-image
  // fallback and the access note. It has no children, so the entire
  // Sub-locations section (heading and empty state alike) is omitted.
  await page.goto(`/locations/${INITIAL.slug}`);
  await expect(
    page.getByRole("heading", { level: 1, name: INITIAL.name, exact: true })
  ).toBeVisible();
  await expect(page.getByText(INITIAL.description)).toBeVisible();
  await expect(page.getByText(`Type: ${INITIAL.type}`)).toBeVisible();
  await expect(page.getByText(INITIAL.accessNote)).toBeVisible();
  await expect(page.getByText("No image available")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Sub-locations", exact: true })
  ).toHaveCount(0);
  await expect(page.getByText("No sub-locations yet")).toHaveCount(0);
  // No verification line: this location was created without checking the
  // opt-in box.
  await expect(page.getByText("Gameplay data verified")).toHaveCount(0);

  // --- Edit (name, slug, type, description, access note; image untouched) -
  // Quick switching: the record-list row itself is the edit link, and the
  // open record is marked selected (aria-current) in the list.
  await page.goto("/admin/locations");
  await recordRow(page, INITIAL.name).click();
  await expect(page).toHaveURL(`/admin/locations/${INITIAL.slug}/edit`);
  await expect(recordRow(page, INITIAL.name)).toHaveAttribute(
    "aria-current",
    "page"
  );
  // The editor's one h1 is the location's own name; its slug is the
  // subtitle context underneath (Slice 9F.2, matching the Item/Recipe/
  // Profession General editors' convention exactly).
  await expect(
    page.getByRole("heading", { level: 1, name: INITIAL.name, exact: true })
  ).toBeVisible();
  await expect(page.getByText(INITIAL.slug, { exact: true })).toBeVisible();

  await page.getByLabel("Name", { exact: true }).fill(EDITED.name);
  await page.getByLabel("Slug", { exact: true }).fill(EDITED.slug);
  await page
    .getByRole("combobox", { name: "Type", exact: true })
    .selectOption({ label: EDITED.type });
  await page.getByLabel(/^Description/).fill(EDITED.description);
  await page.getByLabel(/^Access or unlock note/).fill(EDITED.accessNote);
  // The verification checkbox must render unchecked by default and stays
  // untouched here: a normal edit must not stamp verification metadata.
  await expect(page.getByLabel(VERIFICATION_CHECKBOX_LABEL)).not.toBeChecked();
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();

  await expect(page).toHaveURL("/admin/locations?success=updated");
  await expect(page.getByRole("status")).toHaveText("Location updated.");
  await expect(recordRow(page, EDITED.name)).toBeVisible();

  // The slug changed, so the original public route must be gone...
  const staleResponse = await page.goto(`/locations/${INITIAL.slug}`);
  expect(staleResponse?.status()).toBe(404);

  // ...and the new public detail page renders the edited values.
  await page.goto(`/locations/${EDITED.slug}`);
  await expect(
    page.getByRole("heading", { level: 1, name: EDITED.name, exact: true })
  ).toBeVisible();
  await expect(page.getByText(EDITED.description)).toBeVisible();
  await expect(page.getByText(`Type: ${EDITED.type}`)).toBeVisible();
  await expect(page.getByText(EDITED.accessNote)).toBeVisible();
  await expect(page.getByText("Gameplay data verified")).toHaveCount(0);

  // --- Delete -------------------------------------------------------------
  // Delete is reached from the edit page's sticky EditorActions (the old
  // table's per-row Delete link is gone).
  await page.goto("/admin/locations");
  await recordRow(page, EDITED.name).click();
  await expect(page).toHaveURL(`/admin/locations/${EDITED.slug}/edit`);
  await page.getByRole("link", { name: "Delete Location", exact: true }).click();
  await expect(page).toHaveURL(`/admin/locations/${EDITED.slug}/delete`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Delete Location" })
  ).toBeVisible();
  // The confirmation identifies exactly this location by name and slug.
  await expect(page.getByText(`(${EDITED.slug})`)).toBeVisible();
  await expect(page.getByText("Sub-locations: 0")).toBeVisible();

  await page
    .getByRole("button", { name: "Delete Permanently", exact: true })
    .click();

  await expect(page).toHaveURL("/admin/locations?success=deleted");
  await expect(page.getByRole("status")).toHaveText("Location deleted.");
  await expect(recordRow(page, EDITED.name)).toHaveCount(0);

  // Gone from the public site as well.
  const deletedResponse = await page.goto(`/locations/${EDITED.slug}`);
  expect(deletedResponse?.status()).toBe(404);
});

test("gameplay verification stamps the selected game version, stays admin-only, and survives normal edits", async ({
  page,
}) => {
  // A NON-current historical version for the picker flows below.
  await createE2eTestGameVersion(HISTORICAL_VERSION_NAME);

  // --- Create unverified (checkbox untouched) ---------------------------
  await page.goto("/admin/locations/new");
  await createLocationThroughForm(page, VERIFY_LOCATION);

  await page.goto(`/locations/${VERIFY_LOCATION.slug}`);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: VERIFY_LOCATION.name,
      exact: true,
    })
  ).toBeVisible();
  await expect(page.getByText("Gameplay data verified")).toHaveCount(0);

  // --- The shared VerificationPanel shows Unverified with no stamp rows,
  // and the picker lists versions and defaults to the current one -------
  await page.goto("/admin/locations");
  await recordRow(page, VERIFY_LOCATION.name).click();
  await expect(page).toHaveURL(`/admin/locations/${VERIFY_LOCATION.slug}/edit`);
  await expect(
    page.locator(".admin-status-badge", { hasText: "Unverified" })
  ).toBeVisible();
  await expect(panelRow(page, "Verification", "Verified against")).toHaveCount(
    0
  );
  const picker = page.getByLabel("Game version to verify against");
  await expect(
    picker.locator("option:checked"),
    "the current version is preselected"
  ).toHaveText(`${CURRENT_VERSION_NAME} (current)`);
  await expect(
    picker.locator("option", { hasText: HISTORICAL_VERSION_NAME })
  ).toHaveCount(1);

  // --- Verify via the explicit opt-in checkbox (picker untouched) -------
  const verifyCheckbox = page.getByLabel(VERIFICATION_CHECKBOX_LABEL);
  await expect(verifyCheckbox).not.toBeChecked();
  await verifyCheckbox.check();
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(page).toHaveURL("/admin/locations?success=updated");

  // The edit page shows the stamp carrying the preselected current Game
  // Version, resolved and validated server-side, classified as
  // verified-for-the-current-version by the shared panel.
  await recordRow(page, VERIFY_LOCATION.name).click();
  await expect(
    page.locator(".admin-status-badge", {
      hasText: "Verified — current version",
    })
  ).toBeVisible();
  await expect(
    panelRow(page, "Verification", "Verified against")
  ).toContainText(CURRENT_VERSION_NAME);
  const stampedDateText = await panelRow(page, "Verification", "Verified on")
    .textContent();
  await expect(panelRow(page, "Timestamps", "Verified")).toBeVisible();

  // Verification is admin-only since Slice 9A: the PUBLIC page must not
  // render it even for a verified location.
  await page.goto(`/locations/${VERIFY_LOCATION.slug}`);
  await expect(page.getByText("Gameplay data verified")).toHaveCount(0);
  await expect(page.getByText(CURRENT_VERSION_NAME)).toHaveCount(0);

  // --- A later NORMAL edit, even one that moves the picker, must not
  // alter the stamp: the picker only ever proposes a version, and
  // nothing is written while the checkbox stays unchecked. ---------------
  // Unchecked by default on every render, even for an already-verified
  // location: verification is a per-save action, not persistent form
  // state.
  await page.goto(`/admin/locations/${VERIFY_LOCATION.slug}/edit`);
  await expect(page.getByLabel(VERIFICATION_CHECKBOX_LABEL)).not.toBeChecked();
  await page
    .getByLabel("Game version to verify against")
    .selectOption({ label: HISTORICAL_VERSION_NAME });
  await page
    .getByLabel(/^Description/)
    .fill("Edited without touching verification.");
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(page).toHaveURL("/admin/locations?success=updated");

  await page.goto(`/locations/${VERIFY_LOCATION.slug}`);
  await expect(
    page.getByText("Edited without touching verification.")
  ).toBeVisible();

  await page.goto(`/admin/locations/${VERIFY_LOCATION.slug}/edit`);
  await expect(
    page.locator(".admin-status-badge", {
      hasText: "Verified — current version",
    })
  ).toBeVisible();
  await expect(
    panelRow(page, "Verification", "Verified against")
  ).toContainText(CURRENT_VERSION_NAME);
  expect(
    await panelRow(page, "Verification", "Verified on").textContent()
  ).toBe(stampedDateText);

  // --- Verifying against a SELECTED historical version -------------------
  await page
    .getByLabel("Game version to verify against")
    .selectOption({ label: HISTORICAL_VERSION_NAME });
  await page.getByLabel(VERIFICATION_CHECKBOX_LABEL).check();
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(page).toHaveURL("/admin/locations?success=updated");

  await recordRow(page, VERIFY_LOCATION.name).click();
  await expect(
    page.locator(".admin-status-badge", { hasText: "Verified — older version" })
  ).toBeVisible();
  await expect(
    panelRow(page, "Verification", "Verified against")
  ).toContainText(HISTORICAL_VERSION_NAME);
});

test("creating a location with a duplicate name is rejected server-side", async ({
  page,
}) => {
  await page.goto("/admin/locations/new");
  await createLocationThroughForm(page, {
    name: "Test E2E Location Duplicate Source",
    slug: "test-e2e-location-duplicate-source",
    type: "Route",
  });

  await page.goto("/admin/locations/new");
  // Same name in different casing with surrounding whitespace: the server
  // trims the name and its duplicate check is case-insensitive, so this
  // must be rejected.
  await page.getByLabel("Name", { exact: true }).fill("  test e2e location duplicate source  ");
  await page.getByLabel(/^Slug/).fill("test-e2e-location-duplicate-attempt");
  await page
    .getByRole("combobox", { name: "Type", exact: true })
    .selectOption({ label: "Route" });
  await page
    .getByRole("button", { name: "Create Location", exact: true })
    .click();

  await expect(page).toHaveURL("/admin/locations/new?error=duplicate_name");
  // Next.js injects a hidden route-announcer div that also has role=alert,
  // so the application's alert is located by its exact readable text.
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "A location with that name already exists." })
  ).toBeVisible();

  await expect(
    page.getByRole("button", { name: "Create Location", exact: true })
  ).toBeVisible();
  // Only the one source location exists — the duplicate attempt wrote
  // nothing.
  await page.goto("/admin/locations");
  await expect(
    recordRow(page, "Test E2E Location Duplicate Source")
  ).toHaveCount(1);
});

test("assigning a location's own descendant as its parent is rejected server-side", async ({
  page,
}) => {
  await page.goto("/admin/locations/new");
  await createLocationThroughForm(page, CYCLE_ANCESTOR);
  await page.goto("/admin/locations/new");
  await createLocationThroughForm(page, {
    ...CYCLE_DESCENDANT,
    parentName: CYCLE_ANCESTOR.name,
  });

  // Attempt to reassign the ancestor's parent to its own descendant, which
  // would create a cycle (ancestor -> descendant -> ancestor). Parent
  // assignment lives on the Hierarchy tab since Slice 9F.3.
  await page.goto(`/admin/locations/${CYCLE_ANCESTOR.slug}/hierarchy`);
  await page
    .getByRole("combobox", { name: "Parent location", exact: true })
    .selectOption({ label: CYCLE_DESCENDANT.name });
  await page
    .getByRole("button", { name: "Save Hierarchy", exact: true })
    .click();

  await expect(page).toHaveURL(
    `/admin/locations/${CYCLE_ANCESTOR.slug}/hierarchy?error=cyclic_parent`
  );
  await expect(
    page.getByRole("alert").filter({
      hasText:
        "A location cannot be its own parent or one of its own sub-locations.",
    })
  ).toBeVisible();
  // The picker itself still excludes the ancestor from its own choices —
  // self-parenting was never even offerable.
  await expect(
    page
      .getByRole("combobox", { name: "Parent location", exact: true })
      .locator("option", { hasText: CYCLE_ANCESTOR.name })
  ).toHaveCount(0);

  // The ancestor's parent assignment was never applied.
  await page.goto(`/locations/${CYCLE_ANCESTOR.slug}`);
  await expect(page.getByText(/^Part of/)).toHaveCount(0);
});

test("Hierarchy tab: changing and removing the parent preserves General fields, image, and verification, and updates sub-location lists", async ({
  page,
}) => {
  const PARENT_A = {
    name: "Test E2E Location Hierarchy Parent A",
    slug: "test-e2e-location-hierarchy-parent-a",
    type: "Region",
  };
  const PARENT_B = {
    name: "Test E2E Location Hierarchy Parent B",
    slug: "test-e2e-location-hierarchy-parent-b",
    type: "Region",
  };
  const SUBJECT = {
    name: "Test E2E Location Hierarchy Subject",
    slug: "test-e2e-location-hierarchy-subject",
    type: "Dungeon",
    description: "Original description.",
    accessNote: "Original access note.",
  };

  await page.goto("/admin/locations/new");
  await createLocationThroughForm(page, PARENT_A);
  await page.goto("/admin/locations/new");
  await createLocationThroughForm(page, PARENT_B);
  await page.goto("/admin/locations/new");
  await createLocationThroughForm(page, { ...SUBJECT, parentName: PARENT_A.name });

  // Verify the subject through General first, so the later Hierarchy
  // saves have a real stamp to prove untouched.
  await recordRow(page, SUBJECT.name).click();
  await expect(page).toHaveURL(`/admin/locations/${SUBJECT.slug}/edit`);
  await page.getByLabel(VERIFICATION_CHECKBOX_LABEL).check();
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(page).toHaveURL("/admin/locations?success=updated");

  // Slice 10C: the public page shows the parent via its breadcrumb, not a
  // separate "Parent location" card.
  await page.goto(`/locations/${SUBJECT.slug}`);
  await expect(
    page
      .getByRole("navigation", { name: "Breadcrumb" })
      .getByRole("link", { name: PARENT_A.name, exact: true })
  ).toBeVisible();

  // --- Hierarchy tab shows the current parent preselected, self excluded,
  // Parent A's sub-locations list includes the subject --------------------
  await page.goto(`/admin/locations/${SUBJECT.slug}/hierarchy`);
  const parentSelect = page.getByRole("combobox", {
    name: "Parent location",
    exact: true,
  });
  expect(await selectedOptionLabel(parentSelect)).toBe(PARENT_A.name);
  await expect(
    parentSelect.locator("option", { hasText: SUBJECT.name })
  ).toHaveCount(0);

  await page.goto(`/admin/locations/${PARENT_A.slug}/hierarchy`);
  await expect(
    page.getByRole("heading", { level: 2, name: "Sub-locations", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: SUBJECT.name, exact: true })
  ).toBeVisible();
  await expect(page.getByText("Dungeon", { exact: true })).toBeVisible();

  // --- Reassign to Parent B: only parentId changes ------------------------
  await page.goto(`/admin/locations/${SUBJECT.slug}/hierarchy`);
  await page
    .getByRole("combobox", { name: "Parent location", exact: true })
    .selectOption({ label: PARENT_B.name });
  await page
    .getByRole("button", { name: "Save Hierarchy", exact: true })
    .click();
  await expect(page).toHaveURL("/admin/locations?success=updated");

  // Parent A no longer lists the subject as a sub-location; Parent B does.
  await page.goto(`/admin/locations/${PARENT_A.slug}/hierarchy`);
  await expect(page.getByText("No sub-locations yet")).toBeVisible();
  await page.goto(`/admin/locations/${PARENT_B.slug}/hierarchy`);
  await expect(
    page.getByRole("cell", { name: SUBJECT.name, exact: true })
  ).toBeVisible();

  // General fields, image state, and the verification stamp are all
  // exactly as they were — a Hierarchy save touches nothing else.
  await page.goto(`/admin/locations/${SUBJECT.slug}/edit`);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    SUBJECT.name
  );
  await expect(page.getByLabel(/^Description/)).toHaveValue(
    SUBJECT.description
  );
  await expect(page.getByLabel(/^Access or unlock note/)).toHaveValue(
    SUBJECT.accessNote
  );
  await expect(
    page.locator(".admin-status-badge", {
      hasText: "Verified — current version",
    })
  ).toBeVisible();

  await page.goto(`/locations/${SUBJECT.slug}`);
  await expect(
    page
      .getByRole("navigation", { name: "Breadcrumb" })
      .getByRole("link", { name: PARENT_B.name, exact: true })
  ).toBeVisible();
  await expect(page.getByText(SUBJECT.description)).toBeVisible();
  await expect(page.getByText(SUBJECT.accessNote)).toBeVisible();

  // --- Removing the parent (No parent) works, and Delete Location stays
  // reachable directly from the Hierarchy tab --------------------------
  await page.goto(`/admin/locations/${SUBJECT.slug}/hierarchy`);
  await page
    .getByRole("combobox", { name: "Parent location", exact: true })
    .selectOption({ label: "No parent" });
  await page
    .getByRole("button", { name: "Save Hierarchy", exact: true })
    .click();
  await expect(page).toHaveURL("/admin/locations?success=updated");

  await page.goto(`/admin/locations/${PARENT_B.slug}/hierarchy`);
  await expect(page.getByText("No sub-locations yet")).toBeVisible();

  await page.goto(`/locations/${SUBJECT.slug}`);
  await expect(page.getByText(/^Part of/)).toHaveCount(0);

  await page.goto(`/admin/locations/${SUBJECT.slug}/hierarchy`);
  await page
    .getByRole("link", { name: "Delete Location", exact: true })
    .click();
  await expect(page).toHaveURL(`/admin/locations/${SUBJECT.slug}/delete`);
});

test("switching locations while on the Hierarchy tab preserves the tab and q, and General's own tab link preserves q too", async ({
  page,
}) => {
  const LOCATION_A = {
    name: "Test E2E Location Hierarchy Switch A",
    slug: "test-e2e-location-hierarchy-switch-a",
    type: "Region",
  };
  const LOCATION_B = {
    name: "Test E2E Location Hierarchy Switch B",
    slug: "test-e2e-location-hierarchy-switch-b",
    type: "Region",
  };

  await page.goto("/admin/locations/new");
  await createLocationThroughForm(page, LOCATION_A);
  await page.goto("/admin/locations/new");
  await createLocationThroughForm(page, LOCATION_B);

  // A shared, distinguishing query so only these two temporary locations
  // match.
  await page.goto("/admin/locations");
  await page
    .getByRole("searchbox", { name: "Search locations" })
    .fill("test e2e location hierarchy switch");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(recordRow(page, LOCATION_A.name)).toBeVisible();
  await expect(recordRow(page, LOCATION_B.name)).toBeVisible();

  await recordRow(page, LOCATION_A.name).click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/locations/${LOCATION_A.slug}/edit\\?q=`)
  );

  const tabNav = page.getByRole("navigation", {
    name: "Location editor sections",
  });
  await tabNav.getByRole("link", { name: "Hierarchy", exact: true }).click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/locations/${LOCATION_A.slug}/hierarchy\\?q=`)
  );
  await expect(recordRow(page, LOCATION_A.name)).toHaveAttribute(
    "aria-current",
    "page"
  );

  // Switching records while ON the Hierarchy tab opens the OTHER
  // location's Hierarchy tab — not its General tab — with q intact.
  await recordRow(page, LOCATION_B.name).click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/locations/${LOCATION_B.slug}/hierarchy\\?q=`)
  );
  await expect(
    page.getByRole("heading", { level: 1, name: LOCATION_B.name, exact: true })
  ).toBeVisible();
  await expect(
    tabNav.getByRole("link", { name: "Hierarchy", exact: true })
  ).toHaveAttribute("aria-current", "page");
  await expect(recordRow(page, LOCATION_B.name)).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(recordRow(page, LOCATION_A.name)).not.toHaveAttribute(
    "aria-current",
    "page"
  );

  // General's own tab link, followed from the Hierarchy tab, preserves q
  // too.
  await tabNav.getByRole("link", { name: "General", exact: true }).click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/locations/${LOCATION_B.slug}/edit\\?q=`)
  );
  await expect(
    tabNav.getByRole("link", { name: "General", exact: true })
  ).toHaveAttribute("aria-current", "page");
});

test("deletion is blocked while a sub-location exists", async ({ page }) => {
  await page.goto("/admin/locations/new");
  await createLocationThroughForm(page, BLOCKED_PARENT);
  await page.goto("/admin/locations/new");
  await createLocationThroughForm(page, {
    ...BLOCKED_CHILD,
    parentName: BLOCKED_PARENT.name,
  });

  await page.goto(`/admin/locations/${BLOCKED_PARENT.slug}/delete`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Delete Location" })
  ).toBeVisible();
  await expect(page.getByText("Sub-locations: 1")).toBeVisible();
  await expect(
    page.getByText("Move or remove those sub-locations first.")
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Delete Permanently", exact: true })
  ).toHaveCount(0);

  // The safe workflow: remove the child first, then the parent.
  await page.goto(`/admin/locations/${BLOCKED_CHILD.slug}/delete`);
  await page
    .getByRole("button", { name: "Delete Permanently", exact: true })
    .click();
  await expect(page).toHaveURL("/admin/locations?success=deleted");

  await page.goto(`/admin/locations/${BLOCKED_PARENT.slug}/delete`);
  await expect(page.getByText("Sub-locations: 0")).toBeVisible();
  await page
    .getByRole("button", { name: "Delete Permanently", exact: true })
    .click();
  await expect(page).toHaveURL("/admin/locations?success=deleted");
});

test("a sparse location (no description, no image, no parent) renders without empty optional content", async ({
  page,
}) => {
  await page.goto("/admin/locations/new");
  await createLocationThroughForm(page, {
    name: "Test E2E Location Sparse",
    slug: "test-e2e-location-sparse",
    type: "Special area",
  });

  await page.goto("/locations/test-e2e-location-sparse");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Test E2E Location Sparse",
      exact: true,
    })
  ).toBeVisible();
  await expect(page.getByText("Type: Special area")).toBeVisible();
  await expect(page.getByText("No image available")).toBeVisible();
  // No children: the entire Sub-locations section — heading and empty
  // state alike — must be absent, not just its content hidden.
  await expect(
    page.getByRole("heading", { level: 2, name: "Sub-locations", exact: true })
  ).toHaveCount(0);
  await expect(page.getByText("No sub-locations yet")).toHaveCount(0);
  await expect(page.getByText(/^Part of/)).toHaveCount(0);
  await expect(page.getByText("Access", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Gameplay data verified")).toHaveCount(0);
});

test("visiting an unknown location slug returns 404", async ({ page }) => {
  const response = await page.goto("/locations/test-e2e-location-does-not-exist");
  expect(response?.status()).toBe(404);
});

test("an unknown location slug fails safely on the hierarchy route", async ({
  page,
}) => {
  const response = await page.goto(
    "/admin/locations/test-e2e-location-does-not-exist/hierarchy"
  );
  expect(response?.status()).toBe(404);
});

test("record-list search filters by name, slug, and type, preserves the query across switching, and clears", async ({
  page,
}) => {
  // Two temporary locations sharing the test prefix, so one query matches
  // both; a third, differently-named location carries a distinct type so
  // it can be found purely by its type label.
  await page.goto("/admin/locations/new");
  await createLocationThroughForm(page, {
    name: "Test E2E Location Search A",
    slug: "test-e2e-location-search-a",
    type: "Town",
  });
  await page.goto("/admin/locations/new");
  await createLocationThroughForm(page, {
    name: "Test E2E Location Search B",
    slug: "test-e2e-location-search-b",
    type: "Route",
  });
  await page.goto("/admin/locations/new");
  await createLocationThroughForm(page, {
    name: "Test E2E Location Search C",
    slug: "test-e2e-location-search-c",
    type: "Dungeon",
    parentName: "Test E2E Location Search A",
  });

  // --- Secondary row context shows type, and parent when present --------
  await page.goto("/admin/locations");
  await expect(
    recordRow(page, "Test E2E Location Search A").getByText("Town", {
      exact: true,
    })
  ).toBeVisible();
  await expect(
    recordRow(page, "Test E2E Location Search C").getByText(
      "Dungeon · Test E2E Location Search A",
      { exact: true }
    )
  ).toBeVisible();

  // --- Search by NAME (trimmed, case-insensitive) -----------------------
  await page
    .getByRole("searchbox", { name: "Search locations" })
    .fill("  test e2e location search  ");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/locations\?q=/);
  await expect(recordRow(page, "Test E2E Location Search A")).toBeVisible();
  await expect(recordRow(page, "Test E2E Location Search B")).toBeVisible();
  await expect(recordRow(page, "Test E2E Location Search C")).toBeVisible();
  await expect(page.getByText("3 matches")).toBeVisible();

  // --- Quick switching keeps the query applied --------------------------
  // Row hrefs carry the TRIMMED query, %20-encoded by the server helper.
  await recordRow(page, "Test E2E Location Search A").click();
  await expect(page).toHaveURL(
    "/admin/locations/test-e2e-location-search-a/edit?q=test%20e2e%20location%20search"
  );
  await expect(
    recordRow(page, "Test E2E Location Search A")
  ).toHaveAttribute("aria-current", "page");

  // Switch directly to another match: the list stays filtered, the
  // selection follows, and the first record is no longer marked.
  await recordRow(page, "Test E2E Location Search B").click();
  await expect(page).toHaveURL(
    "/admin/locations/test-e2e-location-search-b/edit?q=test%20e2e%20location%20search"
  );
  await expect(
    recordRow(page, "Test E2E Location Search B")
  ).toHaveAttribute("aria-current", "page");
  await expect(
    recordRow(page, "Test E2E Location Search A")
  ).not.toHaveAttribute("aria-current", "page");

  // The create action, and this edit page's own Cancel/Delete links, keep
  // the search context too.
  await expect(
    page.getByRole("link", { name: "+ New location", exact: true })
  ).toHaveAttribute(
    "href",
    "/admin/locations/new?q=test%20e2e%20location%20search"
  );
  await expect(
    page.getByRole("link", { name: "Cancel", exact: true })
  ).toHaveAttribute(
    "href",
    "/admin/locations?q=test%20e2e%20location%20search"
  );
  await expect(
    page.getByRole("link", { name: "Delete Location", exact: true })
  ).toHaveAttribute(
    "href",
    "/admin/locations/test-e2e-location-search-b/delete?q=test%20e2e%20location%20search"
  );

  // The delete confirmation page's own Cancel link keeps the query too.
  await page
    .getByRole("link", { name: "Delete Location", exact: true })
    .click();
  await expect(page).toHaveURL(
    "/admin/locations/test-e2e-location-search-b/delete?q=test%20e2e%20location%20search"
  );
  await expect(
    page.getByRole("link", { name: "Cancel", exact: true })
  ).toHaveAttribute(
    "href",
    "/admin/locations?q=test%20e2e%20location%20search"
  );

  // --- Search by SLUG ---------------------------------------------------
  await page.goto("/admin/locations");
  await page
    .getByRole("searchbox", { name: "Search locations" })
    .fill("test-e2e-location-search-b");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(recordRow(page, "Test E2E Location Search B")).toBeVisible();
  await expect(recordRow(page, "Test E2E Location Search A")).toHaveCount(0);
  await expect(page.getByText("1 match", { exact: true })).toBeVisible();

  // --- Search by TYPE LABEL ----------------------------------------------
  await page.goto("/admin/locations");
  await page
    .getByRole("searchbox", { name: "Search locations" })
    .fill("Dungeon");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(recordRow(page, "Test E2E Location Search C")).toBeVisible();
  await expect(recordRow(page, "Test E2E Location Search A")).toHaveCount(0);
  await expect(recordRow(page, "Test E2E Location Search B")).toHaveCount(0);

  // --- No-match state (distinct from the no-locations-at-all state) -----
  await page
    .getByRole("searchbox", { name: "Search locations" })
    .fill("zzz-no-such-location");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const emptyRegion = page.locator(".admin-record-empty");
  await expect(emptyRegion).toContainText("No locations match");
  await expect(emptyRegion).toContainText("zzz-no-such-location");
  await expect(page.getByText("0 matches")).toBeVisible();

  // --- Clear search returns the full list -------------------------------
  await page.getByRole("link", { name: "Clear search", exact: true }).click();
  await expect(page).toHaveURL("/admin/locations");
  await expect(recordRow(page, "Test E2E Location Search A")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Clear search", exact: true })
  ).toHaveCount(0);
});

test("seeded fixtures are unaffected and no test location remains", async () => {
  expect(await countE2eTestLocationRecords()).toBe(0);
});
