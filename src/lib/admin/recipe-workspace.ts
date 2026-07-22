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
// was the only real tab — Ingredients (still embedded in General) and
// Metadata (not yet implemented) rendered as disabled placeholders.
//
// Slice 9C.3 (Ingredients tab) made Ingredients a real, independent
// destination too: `recipeEditorTabs` now takes an `active` key (General
// or Ingredients) exactly like the Item workspace's `itemEditorTabs`.
// Metadata remains the only disabled placeholder.
//
// Slice 9C.4 (Metadata tab) made Metadata a real destination too —
// `recipeEditorTabs` now takes a third `active` key and every Recipe
// tab is a real link, mirroring the Item workspace's Slice 9B.8
// completion exactly. No Recipe tab renders as a disabled placeholder
// any more.

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

/** The Ingredients tab route for one recipe, preserving the query (Slice
    9C.3) — the recipe's ingredient rows, edited independently of its
    other fields. */
export function recipeIngredientsHref(slug: string, query: string): string {
  return withRecipeSearchQuery(`${RECIPE_LIST_PATH}/${slug}/ingredients`, query);
}

/** Structurally compatible with the shared `EditorTab` type
    (`src/components/admin/editor-tabs.tsx`) without importing a
    component into this pure, React-free module. */
export type RecipeEditorTab = {
  label: string;
  href: string;
  active: boolean;
  disabled?: boolean;
  count?: number;
};

/** Relationship-count badge for the Recipe tab strip (Phase B
    sub-slice): the number of RecipeIngredient rows, exactly what the
    Ingredients tab itself lists. */
export type RecipeEditorTabCounts = {
  ingredients?: number;
};

/** Which Recipe editor tab is active — General (Slice 9C.2) or
    Ingredients (Slice 9C.3). The former Metadata tab (Slice 9C.4) was
    removed in the Visual Pass (sub-slice 4): every fact it showed was
    already duplicated by General's own aside (Verification/Timestamps)
    or the resulting item/profession/level fields on General itself, so
    /admin/recipes/[slug]/metadata now redirects to General instead of
    rendering a third tab. */
export type RecipeEditorTabKey = "general" | "ingredients";

/**
 * The Recipe edit/ingredients routes' shared tab strip: one function so
 * every tab's href/active state can never drift out of sync between the
 * two pages, exactly like the Item workspace's `itemEditorTabs`. The
 * create page shows only General (mirroring the Item workspace's
 * create-page precedent), so this helper is deliberately edit-only.
 */
export function recipeEditorTabs(
  slug: string,
  query: string,
  active: RecipeEditorTabKey,
  counts?: RecipeEditorTabCounts
): RecipeEditorTab[] {
  return [
    {
      label: "General",
      href: recipeEditHref(slug, query),
      active: active === "general",
    },
    {
      label: "Ingredients",
      href: recipeIngredientsHref(slug, query),
      active: active === "ingredients",
      count: counts?.ingredients,
    },
  ];
}
