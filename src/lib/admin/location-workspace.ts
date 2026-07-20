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
 * The Location edit route's tab strip (Slice 9F.2): General is the only
 * real destination this slice — Hierarchy, Acquisition Sources, and
 * Metadata (all later slices) render as disabled placeholders, never
 * links to empty pages. The create page shows only General with no
 * placeholders at all (mirroring the Item/Recipe/Profession workspaces'
 * create-page precedent), so this helper is deliberately edit-only.
 */
export function locationEditorTabs(
  slug: string,
  query: string
): LocationEditorTab[] {
  return [
    {
      label: "General",
      href: locationEditHref(slug, query),
      active: true,
    },
    { label: "Hierarchy", href: "", active: false, disabled: true },
    {
      label: "Acquisition Sources",
      href: "",
      active: false,
      disabled: true,
    },
    { label: "Metadata", href: "", active: false, disabled: true },
  ];
}
