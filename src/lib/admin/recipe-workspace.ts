// Pure URL and search-normalization rules for the Recipe workspace
// (Slice 9C.1) — the SECOND production adoption of the shared admin
// workspace, following the Item workspace's precedent exactly. No React,
// no database: the RecipeWorkspace component applies these, and the unit
// tests pin them.
//
// The Recipe's URL identifier remains the SLUG, exactly as everywhere
// else in the application (public pages, the existing edit/delete
// routes): the workspace links to /admin/recipes/[slug]/edit. Database
// ids never appear in URLs.
//
// Slice 9C.2 (General editor conversion) added `recipeEditorTabs`: General
// is the only real tab so far — Ingredients (still embedded in General)
// and Metadata (not yet implemented) render as disabled placeholders.

export const RECIPE_LIST_PATH = "/admin/recipes";
export const RECIPE_CREATE_PATH = "/admin/recipes/new";

/** The URL parameter the Recipe list's search submits as. */
export const RECIPE_SEARCH_PARAM = "q";

/**
 * Normalizes a raw ?q= value the same way the server filters: trimmed;
 * anything non-string (absent, array-shaped, tampered) becomes "" — an
 * unfiltered list, never an error.
 */
export function normalizeRecipeSearchQuery(raw: unknown): string {
  return typeof raw === "string" ? raw.trim() : "";
}

/**
 * Appends the active search query to a workspace path, so quick
 * switching, the create page, and back/cancel links all keep the
 * admin's filter. A blank query appends nothing — clean URLs stay clean.
 */
export function withRecipeSearchQuery(path: string, query: string): string {
  if (!query) {
    return path;
  }

  return `${path}?${RECIPE_SEARCH_PARAM}=${encodeURIComponent(query)}`;
}

/** The edit route for one recipe, preserving the active search query. */
export function recipeEditHref(slug: string, query: string): string {
  return withRecipeSearchQuery(`${RECIPE_LIST_PATH}/${slug}/edit`, query);
}

/** The delete-confirmation route for one recipe, preserving the query. */
export function recipeDeleteHref(slug: string, query: string): string {
  return withRecipeSearchQuery(`${RECIPE_LIST_PATH}/${slug}/delete`, query);
}

/** Structurally compatible with the shared `EditorTab` type
    (`src/components/admin/editor-tabs.tsx`) without importing a
    component into this pure, React-free module. */
export type RecipeEditorTab = {
  label: string;
  href: string;
  active: boolean;
  disabled?: boolean;
};

/**
 * The Recipe edit route's tab strip (Slice 9C.2): General is the only
 * real destination this slice — Ingredients (still embedded in General;
 * a dedicated tab is a later slice) and Metadata (not yet implemented)
 * render as disabled placeholders, never links to empty pages. The
 * create page shows only General with no placeholders at all (mirroring
 * the Item workspace's create-page precedent), so this helper is
 * deliberately edit-only.
 */
export function recipeEditorTabs(slug: string, query: string): RecipeEditorTab[] {
  return [
    { label: "General", href: recipeEditHref(slug, query), active: true },
    { label: "Ingredients", href: "", active: false, disabled: true },
    { label: "Metadata", href: "", active: false, disabled: true },
  ];
}
