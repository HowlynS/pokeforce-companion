// Pure URL and search-normalization rules for the Category workspace —
// the FOURTH production adoption of the shared admin workspace,
// following the Item, Recipe, and Profession workspaces' precedent
// exactly. No React, no database: the CategoryWorkspace component
// applies these, and the unit tests pin them.
//
// The Category's URL identifier remains the SLUG, exactly as everywhere
// else in the application (public pages, the existing edit/delete
// routes): the workspace links to /admin/categories/[slug]/edit.
// Database ids never appear in URLs.
//
// This is a narrow navigation-foundation pass, mirroring the Profession
// workspace's own Slice 9D.1 exactly: Categories have no tabs yet (the
// editor conversion is deferred), so this module only exports the
// list/create/edit/delete hrefs a plain record list and its two nested
// routes need.

export const CATEGORY_LIST_PATH = "/admin/categories";
export const CATEGORY_CREATE_PATH = "/admin/categories/new";

/** The URL parameter the Category list's search submits as. */
export const CATEGORY_SEARCH_PARAM = "q";

/**
 * Normalizes a raw ?q= value the same way the server filters: trimmed;
 * anything non-string (absent, array-shaped, tampered) becomes "" — an
 * unfiltered list, never an error.
 */
export function normalizeCategorySearchQuery(raw: unknown): string {
  return typeof raw === "string" ? raw.trim() : "";
}

/**
 * Appends the active search query to a workspace path, so quick
 * switching, the create page, and back/cancel links all keep the
 * admin's filter. A blank query appends nothing — clean URLs stay clean.
 */
export function withCategorySearchQuery(path: string, query: string): string {
  if (!query) {
    return path;
  }

  return `${path}?${CATEGORY_SEARCH_PARAM}=${encodeURIComponent(query)}`;
}

/** The edit route for one category, preserving the active search query. */
export function categoryEditHref(slug: string, query: string): string {
  return withCategorySearchQuery(`${CATEGORY_LIST_PATH}/${slug}/edit`, query);
}

/** The delete-confirmation route for one category, preserving the query. */
export function categoryDeleteHref(slug: string, query: string): string {
  return withCategorySearchQuery(`${CATEGORY_LIST_PATH}/${slug}/delete`, query);
}
