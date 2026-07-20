// Pure URL and search-normalization rules for the Location workspace —
// the FIFTH production adoption of the shared admin workspace, following
// the Item, Recipe, Profession, and Category workspaces' precedent
// exactly. No React, no database: the LocationWorkspace component
// applies these, and the unit tests pin them.
//
// The Location's URL identifier remains the SLUG, exactly as everywhere
// else in the application (public pages, the existing edit/delete
// routes): the workspace links to /admin/locations/[slug]/edit.
// Database ids never appear in URLs.
//
// Slice 9F.2 (General editor conversion) added `locationEditorTabs`,
// mirroring the Profession workspace's Slice 9D.2 shape exactly: General
// is the only real tab so far — Hierarchy, Acquisition Sources, and
// Metadata (all later slices, not yet implemented) render as disabled
// placeholders, never links to empty pages.
//
// Slice 9F.3 (Hierarchy tab) made Hierarchy a real destination too,
// mirroring the Profession workspace's Recipes tab (Slice 9D.3) shape:
// `locationEditorTabs` now takes an `active` key (General or Hierarchy)
// exactly like `professionEditorTabs` does. Acquisition Sources and
// Metadata remain the only disabled placeholders.
//
// Slice 9F.4 (Acquisition Sources tab) made Acquisition Sources a real
// destination too: `active` now accepts `"sources"` as well. Metadata
// remains the only disabled placeholder. Acquisition Sources stays a
// READ-ONLY relationship view — every mutation continues to happen
// through the existing Item-owned source routes, never here.

import {
  ACQUISITION_TYPES,
  type AcquisitionType,
} from "@/lib/validation/acquisition-source";

export const LOCATION_LIST_PATH = "/admin/locations";
export const LOCATION_CREATE_PATH = "/admin/locations/new";

/** The URL parameter the Location list's search submits as. */
export const LOCATION_SEARCH_PARAM = "q";

/**
 * Normalizes a raw ?q= value the same way the server filters: trimmed;
 * anything non-string (absent, array-shaped, tampered) becomes "" — an
 * unfiltered list, never an error.
 */
export function normalizeLocationSearchQuery(raw: unknown): string {
  return typeof raw === "string" ? raw.trim() : "";
}

/**
 * Appends the active search query to a workspace path, so quick
 * switching, the create page, and back/cancel links all keep the
 * admin's filter. A blank query appends nothing — clean URLs stay clean.
 */
export function withLocationSearchQuery(path: string, query: string): string {
  if (!query) {
    return path;
  }

  return `${path}?${LOCATION_SEARCH_PARAM}=${encodeURIComponent(query)}`;
}

/** The edit route for one location, preserving the active search query. */
export function locationEditHref(slug: string, query: string): string {
  return withLocationSearchQuery(`${LOCATION_LIST_PATH}/${slug}/edit`, query);
}

/** The delete-confirmation route for one location, preserving the query. */
export function locationDeleteHref(slug: string, query: string): string {
  return withLocationSearchQuery(`${LOCATION_LIST_PATH}/${slug}/delete`, query);
}

/** The Hierarchy tab route for one location, preserving the query (Slice
    9F.3) — parent assignment plus the read-only sub-location list. */
export function locationHierarchyHref(slug: string, query: string): string {
  return withLocationSearchQuery(
    `${LOCATION_LIST_PATH}/${slug}/hierarchy`,
    query
  );
}

/** The Acquisition Sources tab route for one location, preserving the
    query (Slice 9F.4) — read-only relationship content; every mutation
    stays on the existing Item-owned source routes. */
export function locationSourcesHref(slug: string, query: string): string {
  return withLocationSearchQuery(
    `${LOCATION_LIST_PATH}/${slug}/sources`,
    query
  );
}

/** Which Location editor tab is active — General (the record's own
    fields), Hierarchy (Slice 9F.3), or Acquisition Sources (Slice 9F.4).
    Metadata is not yet implemented and always renders as a disabled
    placeholder. */
export type LocationEditorTabKey = "general" | "hierarchy" | "sources";

/**
 * Sorts Acquisition Sources for the Location Sources tab: grouped by
 * type in the enum's declared order (reusing `ACQUISITION_TYPES` — never
 * a second, hand-maintained ordering), then by whatever order the caller
 * already supplied within each type (a stable sort never reorders equal
 * keys). The caller is expected to have queried with
 * `orderBy: { item: { name: "asc" } }`, so that per-item-name order
 * survives untouched within each type group.
 */
export function sortLocationAcquisitionSourcesByType<
  T extends { type: AcquisitionType },
>(sources: readonly T[]): T[] {
  return [...sources].sort(
    (a, b) => ACQUISITION_TYPES.indexOf(a.type) - ACQUISITION_TYPES.indexOf(b.type)
  );
}

/** Structurally compatible with the shared `EditorTab` type
    (`src/components/admin/editor-tabs.tsx`) without importing a
    component into this pure, React-free module. */
export type LocationEditorTab = {
  label: string;
  href: string;
  active: boolean;
  disabled?: boolean;
};

/**
 * The Location editor's tab strip, shared by every route inside the
 * Location workspace that renders tabs (General edit, Hierarchy, and the
 * Acquisition Sources route added in Slice 9F.4) — one function so every
 * tab's href/active state can never drift out of sync between pages.
 * Metadata remains a disabled placeholder (not yet implemented); the
 * create page shows only General with no placeholders at all (mirroring
 * the Item/Recipe/Profession workspaces' create-page precedent), so this
 * helper stays edit-only.
 */
export function locationEditorTabs(
  slug: string,
  query: string,
  active: LocationEditorTabKey
): LocationEditorTab[] {
  return [
    {
      label: "General",
      href: locationEditHref(slug, query),
      active: active === "general",
    },
    {
      label: "Hierarchy",
      href: locationHierarchyHref(slug, query),
      active: active === "hierarchy",
    },
    {
      label: "Acquisition Sources",
      href: locationSourcesHref(slug, query),
      active: active === "sources",
    },
    { label: "Metadata", href: "", active: false, disabled: true },
  ];
}
