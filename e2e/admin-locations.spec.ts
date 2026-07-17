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

import { expect, test, type Page } from "@playwright/test";
import {
  countE2eTestLocationRecords,
  deleteE2eTestLocationRecords,
} from "./helpers/database-cleanup";

const TEST_BUILD_ID = "test-build-001";

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
  "Mark gameplay data as verified for the current build.";

// Browser error hygiene: any uncaught page error fails the test. Serial
// single-worker execution makes this module-level state safe.
let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(async () => {
  // Defensive prefix-scoped cleanup even when a test failed mid-lifecycle.
  await deleteE2eTestLocationRecords();
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

test.beforeAll(async () => {
  // Remove stale rows from interrupted earlier runs; the guard inside the
  // helper throws here if the environment is not the verified test project.
  await deleteE2eTestLocationRecords();
  expect(await countE2eTestLocationRecords()).toBe(0);
});

test.afterAll(async () => {
  const remaining = await deleteE2eTestLocationRecords();
  // afterEach should already have removed everything — fail loudly if not.
  expect(remaining).toBe(0);
});

// Escapes a value for safe use inside a RegExp literal.
function exactTextPattern(value: string): RegExp {
  return new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
}

// The admin table row for a location, located by its exact Name cell
// SPECIFICALLY (the table's first column) — not just any cell, because the
// Parent column can legitimately display another row's name (a parent
// referenced by one of its children), which a plain "any cell matches"
// filter would also match.
function adminRow(page: Page, name: string) {
  return page.getByRole("row").filter({
    has: page.locator("td:nth-child(1)", { hasText: exactTextPattern(name) }),
  });
}

// Fills the create form on /admin/locations (the page must already be
// open) and submits it. The optional image input, parent, description, and
// access note are only filled when supplied.
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
  await expect(
    page.getByRole("cell", { name: data.name, exact: true })
  ).toBeVisible();
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
  await expect(
    page.getByRole("button", { name: "Create Location", exact: true })
  ).toBeVisible();
});

test("location create/edit/delete lifecycle through the real admin UI", async ({
  page,
}) => {
  // --- Create (with the optional image input left empty) ---------------
  await page.goto("/admin");
  await page.getByRole("link", { name: /Manage Locations/ }).click();
  await expect(page).toHaveURL("/admin/locations");
  await expect(
    page.getByRole("heading", { level: 1, name: "Location Management" })
  ).toBeVisible();

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
  await page.goto("/admin/locations");
  await adminRow(page, INITIAL.name).getByRole("link", { name: "Edit" }).click();
  await expect(page).toHaveURL(`/admin/locations/${INITIAL.slug}/edit`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Edit Location" })
  ).toBeVisible();
  await expect(
    page.getByText(`Update details for "${INITIAL.name}".`)
  ).toBeVisible();

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
  await expect(
    page.getByRole("cell", { name: EDITED.name, exact: true })
  ).toBeVisible();

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

  // --- Delete -----------------------------------------------------------
  await page.goto("/admin/locations");
  await adminRow(page, EDITED.name).getByRole("link", { name: "Delete" }).click();
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
  await expect(
    page.getByRole("cell", { name: EDITED.name, exact: true })
  ).toHaveCount(0);

  // Gone from the public site as well.
  const deletedResponse = await page.goto(`/locations/${EDITED.slug}`);
  expect(deletedResponse?.status()).toBe(404);
});

test("gameplay verification stamps the server build id and survives normal edits", async ({
  page,
}) => {
  // --- Create unverified (checkbox untouched) ---------------------------
  await page.goto("/admin/locations");
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

  // --- Verify via the explicit opt-in checkbox --------------------------
  await page.goto(`/admin/locations/${VERIFY_LOCATION.slug}/edit`);
  const verifyCheckbox = page.getByLabel(VERIFICATION_CHECKBOX_LABEL);
  await expect(verifyCheckbox).not.toBeChecked();
  await verifyCheckbox.check();
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(page).toHaveURL("/admin/locations?success=updated");

  // The rendered line carries the deterministic SERVER-side build id from
  // .env.test.local — the browser never submitted a build value.
  await page.goto(`/locations/${VERIFY_LOCATION.slug}`);
  const verificationLine = page.getByText(
    `Gameplay data verified for build ${TEST_BUILD_ID} on`
  );
  await expect(verificationLine).toBeVisible();
  const stampedText = await verificationLine.textContent();

  // --- A later NORMAL edit must not alter the stamp ----------------------
  await page.goto(`/admin/locations/${VERIFY_LOCATION.slug}/edit`);
  await expect(page.getByLabel(VERIFICATION_CHECKBOX_LABEL)).not.toBeChecked();
  await page
    .getByLabel(/^Description/)
    .fill("Edited without touching verification.");
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(page).toHaveURL("/admin/locations?success=updated");

  await page.goto(`/locations/${VERIFY_LOCATION.slug}`);
  await expect(
    page.getByText("Edited without touching verification.")
  ).toBeVisible();
  const preservedLine = page.getByText(
    `Gameplay data verified for build ${TEST_BUILD_ID} on`
  );
  await expect(preservedLine).toBeVisible();
  expect(await preservedLine.textContent()).toBe(stampedText);
});

test("creating a location with a duplicate name is rejected server-side", async ({
  page,
}) => {
  await page.goto("/admin/locations");
  await createLocationThroughForm(page, {
    name: "Test E2E Location Duplicate Source",
    slug: "test-e2e-location-duplicate-source",
    type: "Route",
  });

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

  await expect(page).toHaveURL("/admin/locations?error=duplicate_name");
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
  await expect(
    page.getByRole("cell", { name: "Test E2E Location Duplicate Source", exact: true })
  ).toHaveCount(1);
});

test("assigning a location's own descendant as its parent is rejected server-side", async ({
  page,
}) => {
  await page.goto("/admin/locations");
  await createLocationThroughForm(page, CYCLE_ANCESTOR);
  await createLocationThroughForm(page, {
    ...CYCLE_DESCENDANT,
    parentName: CYCLE_ANCESTOR.name,
  });

  // Attempt to reassign the ancestor's parent to its own descendant, which
  // would create a cycle (ancestor -> descendant -> ancestor).
  await adminRow(page, CYCLE_ANCESTOR.name)
    .getByRole("link", { name: "Edit" })
    .click();
  await expect(page).toHaveURL(
    `/admin/locations/${CYCLE_ANCESTOR.slug}/edit`
  );
  await page
    .getByRole("combobox", { name: "Parent location", exact: true })
    .selectOption({ label: CYCLE_DESCENDANT.name });
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();

  await expect(page).toHaveURL(
    `/admin/locations/${CYCLE_ANCESTOR.slug}/edit?error=cyclic_parent`
  );
  await expect(
    page.getByRole("alert").filter({
      hasText:
        "A location cannot be its own parent or one of its own sub-locations.",
    })
  ).toBeVisible();

  // The ancestor's parent assignment was never applied.
  await page.goto(`/locations/${CYCLE_ANCESTOR.slug}`);
  await expect(page.getByText(/^Part of/)).toHaveCount(0);
});

test("deletion is blocked while a sub-location exists", async ({ page }) => {
  await page.goto("/admin/locations");
  await createLocationThroughForm(page, BLOCKED_PARENT);
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
  await page.goto("/admin/locations");
  await adminRow(page, BLOCKED_CHILD.name)
    .getByRole("link", { name: "Delete" })
    .click();
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
  await page.goto("/admin/locations");
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

test("seeded fixtures are unaffected and no test location remains", async () => {
  expect(await countE2eTestLocationRecords()).toBe(0);
});
