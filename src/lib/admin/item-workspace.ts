// Pure URL and search-normalization rules for the Item workspace
// (Slice 9B.4) — the first production adoption of the shared admin
// workspace. No React, no database: the ItemWorkspace component applies
// these, and the unit tests pin them.
//
// The Item's URL identifier remains the SLUG, exactly as everywhere else
// in the application (public pages, sources nesting, existing E2E): the
// workspace links to /admin/items/[slug]/edit. Database ids never appear
// in URLs.

export const ITEM_LIST_PATH = "/admin/items";
export const ITEM_CREATE_PATH = "/admin/items/new";

/** The URL parameter the Item list's search submits as. */
export const ITEM_SEARCH_PARAM = "q";

/**
 * Normalizes a raw ?q= value the same way the server filters: trimmed;
 * anything non-string (absent, array-shaped, tampered) becomes "" — an
 * unfiltered list, never an error.
 */
export function normalizeItemSearchQuery(raw: unknown): string {
  return typeof raw === "string" ? raw.trim() : "";
}

/**
 * Appends the active search query to a workspace path, so quick
 * switching, the create page, and back links all keep the admin's
 * filter. A blank query appends nothing — clean URLs stay clean.
 */
export function withItemSearchQuery(path: string, query: string): string {
  if (!query) {
    return path;
  }

  return `${path}?${ITEM_SEARCH_PARAM}=${encodeURIComponent(query)}`;
}

/** The edit route for one item, preserving the active search query. */
export function itemEditHref(slug: string, query: string): string {
  return withItemSearchQuery(`${ITEM_LIST_PATH}/${slug}/edit`, query);
}

/** The delete-confirmation route for one item, preserving the query. */
export function itemDeleteHref(slug: string, query: string): string {
  return withItemSearchQuery(`${ITEM_LIST_PATH}/${slug}/delete`, query);
}
