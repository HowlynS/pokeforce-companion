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
// Slice 9D.2 (General editor conversion) added `professionEditorTabs`,
// mirroring the Recipe workspace's Slice 9C.2 shape exactly: General is
// the only real tab so far — Recipes (a relationship tab, later slice)
// and Metadata (not yet implemented) render as disabled placeholders.

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

/** Structurally compatible with the shared `EditorTab` type
    (`src/components/admin/editor-tabs.tsx`) without importing a
    component into this pure, React-free module. */
export type ProfessionEditorTab = {
  label: string;
  href: string;
  active: boolean;
  disabled?: boolean;
};

/**
 * The Profession edit route's tab strip (Slice 9D.2): General is the only
 * real destination this slice — Recipes (a relationship tab, later
 * slice) and Metadata (not yet implemented) render as disabled
 * placeholders, never links to empty pages. The create page shows only
 * General with no placeholders at all (mirroring the Item/Recipe
 * workspaces' create-page precedent), so this helper is deliberately
 * edit-only.
 */
export function professionEditorTabs(
  slug: string,
  query: string
): ProfessionEditorTab[] {
  return [
    {
      label: "General",
      href: professionEditHref(slug, query),
      active: true,
    },
    { label: "Recipes", href: "", active: false, disabled: true },
    { label: "Metadata", href: "", active: false, disabled: true },
  ];
}
