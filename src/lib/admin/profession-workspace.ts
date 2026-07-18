// Pure URL and search-normalization rules for the Profession workspace
// (Slice 9D.1) — the THIRD production adoption of the shared admin
// workspace, following the Item (Slice 9B.4) and Recipe (Slice 9C.1)
// workspaces' precedent exactly. No React, no database: the
// ProfessionWorkspace component applies these, and the unit tests pin
// them.
//
// The Profession's URL identifier remains the SLUG, exactly as
// everywhere else in the application (public pages, the existing
// edit/delete routes): the workspace links to
// /admin/professions/[slug]/edit. Database ids never appear in URLs.
//
// This is a narrow navigation-foundation pass, mirroring Slice 9C.1
// exactly: Professions have no tabs yet (the General editor conversion
// is deferred), so this module only exports the list/create/edit/delete
// hrefs a plain record list and its two nested routes need.

export const PROFESSION_LIST_PATH = "/admin/professions";
export const PROFESSION_CREATE_PATH = "/admin/professions/new";

/** The URL parameter the Profession list's search submits as. */
export const PROFESSION_SEARCH_PARAM = "q";

/**
 * Normalizes a raw ?q= value the same way the server filters: trimmed;
 * anything non-string (absent, array-shaped, tampered) becomes "" — an
 * unfiltered list, never an error.
 */
export function normalizeProfessionSearchQuery(raw: unknown): string {
  return typeof raw === "string" ? raw.trim() : "";
}

/**
 * Appends the active search query to a workspace path, so quick
 * switching, the create page, and back/cancel links all keep the
 * admin's filter. A blank query appends nothing — clean URLs stay clean.
 */
export function withProfessionSearchQuery(path: string, query: string): string {
  if (!query) {
    return path;
  }

  return `${path}?${PROFESSION_SEARCH_PARAM}=${encodeURIComponent(query)}`;
}

/** The edit route for one profession, preserving the active search query. */
export function professionEditHref(slug: string, query: string): string {
  return withProfessionSearchQuery(
    `${PROFESSION_LIST_PATH}/${slug}/edit`,
    query
  );
}

/** The delete-confirmation route for one profession, preserving the query. */
export function professionDeleteHref(slug: string, query: string): string {
  return withProfessionSearchQuery(
    `${PROFESSION_LIST_PATH}/${slug}/delete`,
    query
  );
}
