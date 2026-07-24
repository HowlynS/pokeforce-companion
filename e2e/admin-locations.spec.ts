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
import { selectAdminOption } from "./helpers/admin-select";
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

// The checkbox's own label text is now dynamic ("Mark as verified for
// {selected version's name}"), so every call site matches this pattern
// rather than one fixed string.
const VERIFICATION_CHECKBOX_LABEL = /^Mark as verified for/;

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

// Reads the visible text of an AdminSelect's currently selected value, for
// prefill assertions where option values (database ids) are unknown.
// AdminSelect's trigger button's own text content IS the selected label
// (unlike a native <select>, whose plain textContent would concatenate
// every <option> rather than just the selected one — the reason this
// helper originally read `.selectedOptions[0]` instead).
async function selectedOptionLabel(select: Locator): Promise<string> {
  return (await select.textContent())?.trim() ?? "";
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
  await page.getByLabel(/^Page address/).fill(data.slug);
  await selectAdminOption(
    page.getByRole("combobox", { name: "Type", exact: true }),
    data.type
  );
  if (data.parentName) {
    await selectAdminOption(
      page.getByRole("combobox", { name: "Parent location", exact: true }),
      data.parentName
    );
  }
  if (data.description) {
    await page.getByLabel(/^Description/).fill(data.description);
  }
  if (data.accessNote) {
    await page.getByLabel(/^Extra information/).fill(data.accessNote);
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

test("Location editor: create shows only General with its own parent selector; edit marks General active with Hierarchy and Acquisition Sources both real; exactly one h1 renders; Timestamps render on edit only", async ({
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
  // Hierarchy and Acquisition Sources both now real (but not current)
  // tabs — no Location tab remains disabled, and the removed Metadata
  // tab does not reappear — Timestamps present (Created/Updated only, no
  // Verified row), and NO parent selector anywhere on General (moved to
  // Hierarchy) -------------------------------------------------------------
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
    editTabNav.getByRole("link", { name: "Hierarchy", exact: true })
  ).not.toHaveAttribute("aria-disabled", "true");
  await expect(
    editTabNav.getByRole("link", {
      name: "Acquisition Sources",
      exact: true,
    })
  ).not.toHaveAttribute("aria-current", "page");
  await expect(
    editTabNav.getByRole("link", {
      name: "Acquisition Sources",
      exact: true,
    })
  ).not.toHaveAttribute("aria-disabled", "true");
  await expect(editTabNav.getByRole("link")).toHaveCount(3);
  await expect(editTabNav.getByText("Metadata")).toHaveCount(0);
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
  await expect(page.getByLabel("Page address", { exact: true })).toHaveCount(0);
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
  // Slice 10D: the type is the PageHeader's own eyebrow, shown as its
  // plain label ("Town") rather than a "Type: Town" fact row.
  await expect(page.getByText(INITIAL.type, { exact: true })).toBeVisible();
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
  await page.getByLabel("Page address", { exact: true }).fill(EDITED.slug);
  await selectAdminOption(
    page.getByRole("combobox", { name: "Type", exact: true }),
    EDITED.type
  );
  await page.getByLabel(/^Description/).fill(EDITED.description);
  await page.getByLabel(/^Extra information/).fill(EDITED.accessNote);
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
  // Slice 10D: the type is the PageHeader's own eyebrow, shown as its
  // plain label ("Region") rather than a "Type: Region" fact row.
  await expect(page.getByText(EDITED.type, { exact: true })).toBeVisible();
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
  await expect(panelRow(page, "Verification", "Verified for")).toHaveCount(
    0
  );
  // AdminSelect (Massive Admin Interaction Completion Pass, Phase 1)
  // replaced the native <select> here — see admin-items.spec.ts's own
  // identical fix for why.
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
    panelRow(page, "Verification", "Verified for")
  ).toContainText(CURRENT_VERSION_NAME);
  const stampedDateText = await panelRow(page, "Verification", "Verified on")
    .textContent();
  // The Verified date now lives only in VerificationPanel's own "Verified
  // on" row above (Visual Pass sub-slice 7) — TimestampsPanel dropped the
  // duplicate row entirely.
  await expect(panelRow(page, "Timestamps", "Verified")).toHaveCount(0);

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
  await selectAdminOption(
    page.getByLabel("Verify this record for"),
    HISTORICAL_VERSION_NAME
  );
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
    panelRow(page, "Verification", "Verified for")
  ).toContainText(CURRENT_VERSION_NAME);
  expect(
    await panelRow(page, "Verification", "Verified on").textContent()
  ).toBe(stampedDateText);

  // --- Verifying against a SELECTED historical version -------------------
  await selectAdminOption(
    page.getByLabel("Verify this record for"),
    HISTORICAL_VERSION_NAME
  );
  await page.getByLabel(VERIFICATION_CHECKBOX_LABEL).check();
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(page).toHaveURL("/admin/locations?success=updated");

  await recordRow(page, VERIFY_LOCATION.name).click();
  await expect(
    page.locator(".admin-status-badge", { hasText: "Verified — older version" })
  ).toBeVisible();
  await expect(
    panelRow(page, "Verification", "Verified for")
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
  await page.getByLabel(/^Page address/).fill("test-e2e-location-duplicate-attempt");
  await selectAdminOption(
    page.getByRole("combobox", { name: "Type", exact: true }),
    "Route"
  );
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
  await selectAdminOption(
    page.getByRole("combobox", { name: "Parent location", exact: true }),
    CYCLE_DESCENDANT.name
  );
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
  // self-parenting was never even offerable. AdminSelect only renders its
  // options while open (portaled), so the picker is opened first; Escape
  // closes it again without changing anything.
  await page
    .getByRole("combobox", { name: "Parent location", exact: true })
    .click();
  await expect(
    page.getByRole("option", { name: CYCLE_ANCESTOR.name, exact: true })
  ).toHaveCount(0);
  await page.keyboard.press("Escape");

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
  // Self excluded from its own choices — opened first since AdminSelect
  // only renders options while open (portaled); Escape closes it again.
  await parentSelect.click();
  await expect(
    page.getByRole("option", { name: SUBJECT.name, exact: true })
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  // Relationship-count badge (Phase B sub-slice): direct children + 1 if a
  // parent exists. The subject has a parent and no children of its own:
  // 0 children + 1 = 1.
  await expect(
    page
      .getByRole("navigation", { name: "Location editor sections" })
      .getByRole("link", { name: "Hierarchy", exact: true })
  ).toContainText("1");

  await page.goto(`/admin/locations/${PARENT_A.slug}/hierarchy`);
  await expect(
    page.getByRole("heading", { level: 2, name: "Sub-locations", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: SUBJECT.name, exact: true })
  ).toBeVisible();
  await expect(page.getByText("Dungeon", { exact: true })).toBeVisible();
  // Parent A has one direct child (the subject) and no parent of its own:
  // 1 child + 0 = 1.
  await expect(
    page
      .getByRole("navigation", { name: "Location editor sections" })
      .getByRole("link", { name: "Hierarchy", exact: true })
  ).toContainText("1");

  // --- Reassign to Parent B: only parentId changes ------------------------
  await page.goto(`/admin/locations/${SUBJECT.slug}/hierarchy`);
  await selectAdminOption(
    page.getByRole("combobox", { name: "Parent location", exact: true }),
    PARENT_B.name
  );
  await page
    .getByRole("button", { name: "Save Hierarchy", exact: true })
    .click();
  await expect(page).toHaveURL("/admin/locations?success=updated");

  // Parent A no longer lists the subject as a sub-location; Parent B does.
  await page.goto(`/admin/locations/${PARENT_A.slug}/hierarchy`);
  await expect(page.getByText("No sub-locations yet")).toBeVisible();
  // Parent A now has zero children and no parent of its own: 0 + 0 = 0,
  // rendered as the visible digit 0, never omitted.
  await expect(
    page
      .getByRole("navigation", { name: "Location editor sections" })
      .getByRole("link", { name: "Hierarchy", exact: true })
  ).toContainText("0");
  await page.goto(`/admin/locations/${PARENT_B.slug}/hierarchy`);
  await expect(
    page.getByRole("cell", { name: SUBJECT.name, exact: true })
  ).toBeVisible();
  // Parent B now has one direct child (the subject) and no parent of its
  // own: 1 child + 0 = 1.
  await expect(
    page
      .getByRole("navigation", { name: "Location editor sections" })
      .getByRole("link", { name: "Hierarchy", exact: true })
  ).toContainText("1");

  // General fields, image state, and the verification stamp are all
  // exactly as they were — a Hierarchy save touches nothing else.
  await page.goto(`/admin/locations/${SUBJECT.slug}/edit`);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    SUBJECT.name
  );
  await expect(page.getByLabel(/^Description/)).toHaveValue(
    SUBJECT.description
  );
  await expect(page.getByLabel(/^Extra information/)).toHaveValue(
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

  // --- Removing the parent (No parent) works. Danger Zone was removed
  // from the Hierarchy tab (Visual Pass II Section 7: General tab only),
  // so Delete Location is no longer offered there — reachability is
  // proven from General instead, where it always unconditionally lives. --
  await page.goto(`/admin/locations/${SUBJECT.slug}/hierarchy`);
  await selectAdminOption(
    page.getByRole("combobox", { name: "Parent location", exact: true }),
    "No parent"
  );
  await page
    .getByRole("button", { name: "Save Hierarchy", exact: true })
    .click();
  await expect(page).toHaveURL("/admin/locations?success=updated");

  await page.goto(`/admin/locations/${PARENT_B.slug}/hierarchy`);
  await expect(page.getByText("No sub-locations yet")).toBeVisible();

  await page.goto(`/locations/${SUBJECT.slug}`);
  await expect(page.getByText(/^Part of/)).toHaveCount(0);

  await page.goto(`/admin/locations/${SUBJECT.slug}/hierarchy`);
  await expect(
    page.getByRole("link", { name: "Delete Location", exact: true })
  ).toHaveCount(0);

  await page.goto(`/admin/locations/${SUBJECT.slug}/edit`);
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
  ).toBeDisabled();

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
  // Slice 10D: the type is the PageHeader's own eyebrow ("Special area"),
  // not a "Type: Special area" fact row.
  await expect(page.getByText("Special area", { exact: true })).toBeVisible();
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
  // Slice 10D: with no access note, the facts column next to the image is
  // omitted entirely — never rendered empty just to reserve its own
  // width beside the image.
  await expect(page.locator(".detail-hero-facts")).toHaveCount(0);
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

test("record-list search filters instantly while typing by name, slug, and type label, preserves the query across switching, and clears — no Search button, no page reload", async ({
  page,
}) => {
  // Two temporary locations sharing the test prefix, so one query matches
  // both; a third carries a distinct type (Dungeon, unique among these
  // three) and a parent, so both the type-label filter and the secondary
  // row context (type plus parent) can be confirmed.
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

  await expect(
    page.getByRole("button", { name: "Search", exact: true })
  ).toHaveCount(0);

  // --- Filter by NAME (trimmed, case-insensitive) — typing alone
  // filters immediately, no click, no navigation ------------------------
  await page
    .getByRole("searchbox", { name: "Search locations" })
    .fill("  test e2e location search  ");
  await expect(recordRow(page, "Test E2E Location Search A")).toBeVisible();
  await expect(recordRow(page, "Test E2E Location Search B")).toBeVisible();
  await expect(recordRow(page, "Test E2E Location Search C")).toBeVisible();
  await expect(page.getByText("3 of ", { exact: false })).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/locations\?q=/);

  // --- Quick switching keeps the query applied --------------------------
  await recordRow(page, "Test E2E Location Search A").click();
  await expect(page).toHaveURL(
    /\/admin\/locations\/test-e2e-location-search-a\/edit\?q=/
  );
  await expect(
    recordRow(page, "Test E2E Location Search A")
  ).toHaveAttribute("aria-current", "page");

  await recordRow(page, "Test E2E Location Search B").click();
  await expect(page).toHaveURL(
    /\/admin\/locations\/test-e2e-location-search-b\/edit\?q=/
  );
  await expect(
    recordRow(page, "Test E2E Location Search B")
  ).toHaveAttribute("aria-current", "page");
  await expect(
    recordRow(page, "Test E2E Location Search A")
  ).not.toHaveAttribute("aria-current", "page");

  // The create action, and this edit page's own Cancel/Delete links, keep
  // the filter context too.
  await expect(
    page.getByRole("link", { name: "+ New location", exact: true })
  ).toHaveAttribute("href", /\/admin\/locations\/new\?q=/);
  await expect(
    page.getByRole("link", { name: "Cancel", exact: true })
  ).toHaveAttribute("href", /\/admin\/locations\?q=/);
  await expect(
    page.getByRole("link", { name: "Delete Location", exact: true })
  ).toHaveAttribute(
    "href",
    /\/admin\/locations\/test-e2e-location-search-b\/delete\?q=/
  );

  // The delete confirmation page's own Cancel link keeps the query too.
  await page
    .getByRole("link", { name: "Delete Location", exact: true })
    .click();
  await expect(page).toHaveURL(
    /\/admin\/locations\/test-e2e-location-search-b\/delete\?q=/
  );
  await expect(
    page.getByRole("link", { name: "Cancel", exact: true })
  ).toHaveAttribute("href", /\/admin\/locations\?q=/);

  // --- Filter by Page address (slug) -------------------------------------
  await page.goto("/admin/locations");
  await page
    .getByRole("searchbox", { name: "Search locations" })
    .fill("test-e2e-location-search-b");
  await expect(recordRow(page, "Test E2E Location Search B")).toBeVisible();
  await expect(recordRow(page, "Test E2E Location Search A")).toHaveCount(0);
  await expect(page.getByText("1 of ", { exact: false })).toBeVisible();

  // --- Filter by TYPE LABEL (restored via RecordListRow's own optional
  // searchTerms — the shared filter's resource-agnostic escape hatch,
  // never a Location-specific branch inside RecordList itself) -----------
  await page.goto("/admin/locations");
  await page.getByRole("searchbox", { name: "Search locations" }).fill("Dungeon");
  await expect(recordRow(page, "Test E2E Location Search C")).toBeVisible();
  await expect(recordRow(page, "Test E2E Location Search A")).toHaveCount(0);
  await expect(recordRow(page, "Test E2E Location Search B")).toHaveCount(0);
  await expect(page.getByText("1 of ", { exact: false })).toBeVisible();

  // --- No-match state (distinct from the no-locations-at-all state) -----
  await page
    .getByRole("searchbox", { name: "Search locations" })
    .fill("zzz-no-such-location");
  const emptyRegion = page.locator(".admin-record-empty");
  await expect(emptyRegion).toContainText("No matching records.");
  await expect(page.getByText(/^0 of \d+ locations$/)).toBeVisible();

  // --- Escape clears the query, keeping focus in the field ---------------
  await page
    .getByRole("searchbox", { name: "Search locations" })
    .press("Escape");
  await expect(
    page.getByRole("searchbox", { name: "Search locations" })
  ).toHaveValue("");
  await expect(
    page.getByRole("searchbox", { name: "Search locations" })
  ).toBeFocused();
  await expect(recordRow(page, "Test E2E Location Search A")).toBeVisible();

  // --- The inline clear button restores the full list ---------------------
  await page
    .getByRole("searchbox", { name: "Search locations" })
    .fill("test-e2e-location-search-c");
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(
    page.getByRole("searchbox", { name: "Search locations" })
  ).toHaveValue("");
  await expect(recordRow(page, "Test E2E Location Search A")).toBeVisible();
  await expect(page.getByRole("button", { name: "Clear search" })).toHaveCount(0);
  await expect(page).toHaveURL("/admin/locations");
});

test("seeded fixtures are unaffected and no test location remains", async () => {
  expect(await countE2eTestLocationRecords()).toBe(0);
});
