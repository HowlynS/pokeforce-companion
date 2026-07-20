// Authenticated coverage for the Location "Metadata" tab (Slice 9F.5):
// the fourth and final real Location tab, completing the Location
// workspace, showing restrained, read-only administrative information —
// type, parent (when present), sub-location count, Acquisition Source
// count, created/updated dates, and verification status/version/date —
// with no form, picker, checkbox, submit button, delete action,
// hierarchy-mutation, or Acquisition-Source-mutation control anywhere in
// the main content region. The Game Version verification rules
// themselves (stamping, current-version resolution, tampered-id
// rejection) are exhaustively covered by admin-locations.spec.ts's own
// verification test and the Game Version service tests; this suite only
// proves the Metadata tab DISPLAYS that state correctly and never
// exposes internal ids. Mirrors admin-profession-metadata.spec.ts's
// (Slice 9D.4) structure exactly.
//
// Runs in the chromium-admin project with the storage state saved by
// auth.setup.ts. Every temporary Location uses the test-e2e-location
// slug prefix; the Acquisition Source count test reuses the existing
// test-e2e-acqsrc-location-/test-e2e-acqsrc-item- prefixes already
// relied on by admin-location-sources.spec.ts, so cleanup combines the
// two already-established, guard-first helpers — no new cleanup surface
// is introduced.

import { expect, test, type Page } from "@playwright/test";
import {
  E2E_CURRENT_GAME_VERSION_NAME,
  countE2eTestAcquisitionRecords,
  countE2eTestLocationRecords,
  deleteE2eTestAcquisitionRecords,
  deleteE2eTestLocationRecords,
} from "./helpers/database-cleanup";

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
  await deleteE2eTestLocationRecords();
  await deleteE2eTestAcquisitionRecords();
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

test.beforeAll(async () => {
  await deleteE2eTestLocationRecords();
  await deleteE2eTestAcquisitionRecords();
  expect(await countE2eTestLocationRecords()).toBe(0);
});

test.afterAll(async () => {
  const remaining =
    (await deleteE2eTestLocationRecords()) +
    (await deleteE2eTestAcquisitionRecords());
  expect(remaining).toBe(0);
});

// One row of the shared Location record list, located by its exact
// primary text inside the list's navigation landmark.
function recordRow(page: Page, name: string) {
  return page
    .getByRole("navigation", { name: "Locations records" })
    .getByRole("link")
    .filter({ has: page.getByText(name, { exact: true }) });
}

function tabNav(page: Page) {
  return page.getByRole("navigation", { name: "Location editor sections" });
}

// The Metadata tab's own content, excluding the record list and header —
// the record list's search form is expected to stay on-screen, so "no
// form/mutation control" assertions must be scoped to this region rather
// than the whole page.
function mainContent(page: Page) {
  return page.locator(".admin-workspace-main");
}

// One of the shared panels' rows (Location, Verification, or
// Timestamps), located by its label (dt) text — scoped to the panel by
// heading so identical row labels in different panels can never collide.
// The row's dt/dd text is concatenated with no separator, so the filter
// is anchored to the START of the row's text — otherwise a label like
// "Current version" would also match the unrelated "Verified — current
// version" status badge's own "admin-panel-row" wrapper (case-insensitive
// substring).
function panelRow(page: Page, panelTitle: string, label: string) {
  return page
    .locator(".admin-panel")
    .filter({
      has: page.getByRole("heading", { level: 2, name: panelTitle, exact: true }),
    })
    .locator(".admin-panel-row")
    .filter({ hasText: new RegExp(`^${label}`) });
}

async function createTemporaryLocation(
  page: Page,
  data: { name: string; slug: string; type: string; parentName?: string }
) {
  await page.goto("/admin/locations/new");
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
  await page
    .getByRole("button", { name: "Create Location", exact: true })
    .click();
  await expect(page).toHaveURL("/admin/locations?success=created");
}

test("opening the Metadata tab directly shows type, created/updated dates, Unverified status, and zero sub-location/source counts inside the Location workspace", async ({
  page,
}) => {
  const LOCATION = {
    name: "Test E2E Location Metadata Tab",
    slug: "test-e2e-location-metadata-tab",
    type: "Dungeon",
  };
  await createTemporaryLocation(page, LOCATION);

  await page.goto(`/admin/locations/${LOCATION.slug}/metadata`);

  // One h1: the location's own name; the record list stays visible with
  // this location selected; the Metadata tab is marked active.
  await expect(
    page.getByRole("heading", { level: 1, name: LOCATION.name, exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Locations records" })
  ).toBeVisible();
  await expect(recordRow(page, LOCATION.name)).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(
    tabNav(page).getByRole("link", { name: "Metadata", exact: true })
  ).toHaveAttribute("aria-current", "page");
  await expect(tabNav(page).locator('[aria-disabled="true"]')).toHaveCount(0);

  // Type always renders; no parent row for a root location.
  await expect(panelRow(page, "Location", "Type")).toContainText(
    LOCATION.type
  );
  await expect(panelRow(page, "Location", "Parent location")).toHaveCount(0);

  // Zero sub-locations and zero Acquisition Sources are themselves
  // meaningful administrative context, so both still render as real rows
  // (never omitted).
  await expect(panelRow(page, "Location", "Sub-locations")).toContainText(
    "0"
  );
  await expect(
    panelRow(page, "Location", "Acquisition Sources")
  ).toContainText("0");

  // Created/updated dates render (stable YYYY-MM-DD).
  await expect(panelRow(page, "Timestamps", "Created")).toBeVisible();
  await expect(panelRow(page, "Timestamps", "Updated")).toBeVisible();
  await expect(panelRow(page, "Timestamps", "Verified")).toHaveCount(0);

  // Unverified status, with no fabricated verified-version/date rows —
  // but the current Game Version still renders regardless of
  // verification state.
  await expect(
    page.locator(".admin-status-badge", { hasText: "Unverified" })
  ).toBeVisible();
  await expect(panelRow(page, "Verification", "Verified against")).toHaveCount(
    0
  );
  await expect(panelRow(page, "Verification", "Verified on")).toHaveCount(0);
  await expect(panelRow(page, "Verification", "Current version")).toContainText(
    E2E_CURRENT_GAME_VERSION_NAME
  );

  // No placeholder dash anywhere in the panels.
  await expect(
    page.locator(".admin-panel").getByText("—", { exact: true })
  ).toHaveCount(0);

  // Strictly read-only: no form, picker, checkbox, submit button, file
  // input, or delete/hierarchy/source-mutation control anywhere in the
  // main content region (the record list's own search form is outside
  // this region and stays visible, as required).
  const main = mainContent(page);
  await expect(main.locator("form")).toHaveCount(0);
  await expect(main.locator("select")).toHaveCount(0);
  await expect(main.locator('input[type="checkbox"]')).toHaveCount(0);
  await expect(main.locator('input[type="file"]')).toHaveCount(0);
  await expect(main.locator('button[type="submit"]')).toHaveCount(0);
  await expect(main.getByRole("button", { name: /save/i })).toHaveCount(0);
  await expect(main.getByRole("link", { name: /delete/i })).toHaveCount(0);
  // No raw database id, foreign key, or storage path field.
  await expect(main.locator('input[name="id"]')).toHaveCount(0);
  await expect(main.locator('input[type="hidden"]')).toHaveCount(0);
});

test("a verified location shows the verified version and verification date on the Metadata tab", async ({
  page,
}) => {
  const LOCATION = {
    name: "Test E2E Location Metadata Verified",
    slug: "test-e2e-location-metadata-verified",
    type: "Town",
  };
  await createTemporaryLocation(page, LOCATION);

  // Verify through the real General edit form's shared VerificationPanel
  // (unchanged behavior) — the picker defaults to the current version.
  await page.goto(`/admin/locations/${LOCATION.slug}/edit`);
  await page.getByLabel(VERIFICATION_CHECKBOX_LABEL).check();
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(page).toHaveURL("/admin/locations?success=updated");

  await page.goto(`/admin/locations/${LOCATION.slug}/metadata`);
  await expect(
    page.locator(".admin-status-badge", {
      hasText: "Verified — current version",
    })
  ).toBeVisible();
  await expect(
    panelRow(page, "Verification", "Verified against")
  ).toContainText(E2E_CURRENT_GAME_VERSION_NAME);
  await expect(panelRow(page, "Verification", "Verified on")).toBeVisible();
  await expect(panelRow(page, "Timestamps", "Verified")).toBeVisible();
  await expect(
    panelRow(page, "Verification", "Current version")
  ).toContainText(E2E_CURRENT_GAME_VERSION_NAME);

  // Still no mutation control of any kind.
  const main = mainContent(page);
  await expect(main.locator("form")).toHaveCount(0);
  await expect(main.locator("select")).toHaveCount(0);
  await expect(main.locator('input[type="checkbox"]')).toHaveCount(0);
});

test("the parent location and sub-location count on the Metadata tab reflect the real hierarchy accurately", async ({
  page,
}) => {
  const PARENT = {
    name: "Test E2E Location Metadata Parent",
    slug: "test-e2e-location-metadata-parent",
    type: "Region",
  };
  const CHILD = {
    name: "Test E2E Location Metadata Child",
    slug: "test-e2e-location-metadata-child",
    type: "Town",
  };
  await createTemporaryLocation(page, PARENT);
  await createTemporaryLocation(page, { ...CHILD, parentName: PARENT.name });

  // The child shows its parent's name; a root location has no such row.
  await page.goto(`/admin/locations/${CHILD.slug}/metadata`);
  await expect(panelRow(page, "Location", "Parent location")).toContainText(
    PARENT.name
  );
  await expect(panelRow(page, "Location", "Sub-locations")).toContainText("0");

  // The parent shows the accurate sub-location count and no parent row of
  // its own.
  await page.goto(`/admin/locations/${PARENT.slug}/metadata`);
  await expect(panelRow(page, "Location", "Parent location")).toHaveCount(0);
  await expect(panelRow(page, "Location", "Sub-locations")).toContainText("1");

  // No Hierarchy-relationship control (parent selection, sub-location
  // list) exists here — the Hierarchy tab is the dedicated place for
  // that content.
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(
    page.getByRole("combobox", { name: "Parent location", exact: true })
  ).toHaveCount(0);
});

test("the Acquisition Sources count on the Metadata tab reflects linked sources accurately", async ({
  page,
}) => {
  const LOCATION = {
    name: "Test E2E Acqsrc Location Metadata Count",
    slug: "test-e2e-acqsrc-location-metadata-count",
    type: "Region",
  };
  const ITEM = {
    name: "Test E2E Acqsrc Item Metadata Count",
    slug: "test-e2e-acqsrc-item-metadata-count",
  };
  await createTemporaryLocation(page, LOCATION);

  await page.goto("/admin/items/new");
  await page.getByLabel("Name", { exact: true }).fill(ITEM.name);
  await page.getByLabel(/^Slug/).fill(ITEM.slug);
  await page.getByRole("button", { name: "Create item", exact: true }).click();
  await expect(page).toHaveURL("/admin/items?success=created");

  await page.goto(`/admin/items/${ITEM.slug}/sources`);
  await page
    .getByRole("combobox", { name: "Type", exact: true })
    .selectOption({ label: "Foraging" });
  await page
    .getByRole("combobox", { name: "Location (optional)", exact: true })
    .selectOption({ label: LOCATION.name });
  await page.getByRole("button", { name: "Add Source", exact: true }).click();
  await expect(page).toHaveURL(`/admin/items/${ITEM.slug}/sources?success=created`);

  await page.goto(`/admin/locations/${LOCATION.slug}/metadata`);
  await expect(
    panelRow(page, "Location", "Acquisition Sources")
  ).toContainText("1");

  // No Acquisition-Source-relationship control (source list, create/
  // unlink) exists here — the Acquisition Sources tab is the dedicated
  // place for that content.
  await expect(page.getByRole("table")).toHaveCount(0);
});

test("switching locations while on the Metadata tab preserves the tab and q", async ({
  page,
}) => {
  const LOCATION_A = {
    name: "Test E2E Location Metadata Switch A",
    slug: "test-e2e-location-metadata-switch-a",
    type: "Region",
  };
  const LOCATION_B = {
    name: "Test E2E Location Metadata Switch B",
    slug: "test-e2e-location-metadata-switch-b",
    type: "Region",
  };
  await createTemporaryLocation(page, LOCATION_A);
  await createTemporaryLocation(page, LOCATION_B);

  // A shared, distinguishing query so only these two temporary locations
  // match.
  await page.goto("/admin/locations");
  await page
    .getByRole("searchbox", { name: "Search locations" })
    .fill("test e2e location metadata switch");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(recordRow(page, LOCATION_A.name)).toBeVisible();
  await expect(recordRow(page, LOCATION_B.name)).toBeVisible();

  await recordRow(page, LOCATION_A.name).click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/locations/${LOCATION_A.slug}/edit\\?q=`)
  );

  await tabNav(page).getByRole("link", { name: "Metadata", exact: true }).click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/locations/${LOCATION_A.slug}/metadata\\?q=`)
  );
  await expect(recordRow(page, LOCATION_A.name)).toHaveAttribute(
    "aria-current",
    "page"
  );

  // Switching records while ON the Metadata tab opens the OTHER
  // location's Metadata tab — not its General tab — with q intact.
  await recordRow(page, LOCATION_B.name).click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/locations/${LOCATION_B.slug}/metadata\\?q=`)
  );
  await expect(
    page.getByRole("heading", { level: 1, name: LOCATION_B.name, exact: true })
  ).toBeVisible();
  await expect(
    tabNav(page).getByRole("link", { name: "Metadata", exact: true })
  ).toHaveAttribute("aria-current", "page");
  await expect(recordRow(page, LOCATION_B.name)).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(recordRow(page, LOCATION_A.name)).not.toHaveAttribute(
    "aria-current",
    "page"
  );
});

test("General, Hierarchy, and Acquisition Sources remain real links from the Metadata tab, and no Location tab is disabled", async ({
  page,
}) => {
  const LOCATION = {
    name: "Test E2E Location Metadata Nav",
    slug: "test-e2e-location-metadata-nav",
    type: "Building or interior",
  };
  await createTemporaryLocation(page, LOCATION);

  await page.goto(`/admin/locations/${LOCATION.slug}/metadata`);
  await expect(
    tabNav(page).getByRole("link", { name: "Metadata", exact: true })
  ).toHaveAttribute("aria-current", "page");
  await expect(tabNav(page).locator('[aria-current="page"]')).toHaveCount(1);
  await expect(tabNav(page).locator('[aria-disabled="true"]')).toHaveCount(0);

  await tabNav(page).getByRole("link", { name: "General", exact: true }).click();
  await expect(page).toHaveURL(`/admin/locations/${LOCATION.slug}/edit`);
  await expect(
    tabNav(page).getByRole("link", { name: "General", exact: true })
  ).toHaveAttribute("aria-current", "page");

  await tabNav(page)
    .getByRole("link", { name: "Hierarchy", exact: true })
    .click();
  await expect(page).toHaveURL(`/admin/locations/${LOCATION.slug}/hierarchy`);
  await expect(
    tabNav(page).getByRole("link", { name: "Hierarchy", exact: true })
  ).toHaveAttribute("aria-current", "page");

  await tabNav(page)
    .getByRole("link", { name: "Acquisition Sources", exact: true })
    .click();
  await expect(page).toHaveURL(`/admin/locations/${LOCATION.slug}/sources`);
  await expect(
    tabNav(page).getByRole("link", {
      name: "Acquisition Sources",
      exact: true,
    })
  ).toHaveAttribute("aria-current", "page");

  await tabNav(page)
    .getByRole("link", { name: "Metadata", exact: true })
    .click();
  await expect(page).toHaveURL(`/admin/locations/${LOCATION.slug}/metadata`);
  await expect(
    tabNav(page).getByRole("link", { name: "Metadata", exact: true })
  ).toHaveAttribute("aria-current", "page");
});

test("an unknown location slug fails safely on the metadata route", async ({
  page,
}) => {
  const response = await page.goto(
    "/admin/locations/test-e2e-location-metadata-does-not-exist/metadata"
  );
  expect(response?.status()).toBe(404);
});

test("seeded fixtures are preserved and no test location or acquisition record remains", async () => {
  expect(await countE2eTestLocationRecords()).toBe(0);
  expect(await countE2eTestAcquisitionRecords()).toBe(0);
});
