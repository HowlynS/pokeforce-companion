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
// This is a narrow navigation-foundation pass: unlike the Item workspace,
// Recipes have no tabs yet (General/Ingredients/Metadata conversion is
// deferred), so this module only exports the list/create/edit/delete
// hrefs a plain record list and its two nested routes need.

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
