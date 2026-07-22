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
//
// Slice 9D.3 (Recipes relationship tab) made Recipes a real destination
// too, mirroring the Item workspace's Used in Recipes tab (Slice 9B.7)
// shape: `professionEditorTabs` now takes an `active` key (General or
// Recipes) exactly like `itemEditorTabs`/`recipeEditorTabs` do. Metadata
// remains the only disabled placeholder.
//
// Slice 9D.4 (Metadata tab) made Metadata a real destination too,
// completing the Profession workspace: every Profession tab is now a
// real link — none renders as a disabled placeholder, matching the Item
// (Slice 9B.8) and Recipe (Slice 9C.4) workspaces' finished shape.

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

/** The Recipes tab route for one profession, preserving the query (Slice
    9D.3) — read-only recipe relationship content, mirroring
    `itemUsedInRecipesHref`. */
export function professionRecipesHref(slug: string, query: string): string {
  return withProfessionSearchQuery(
    `${PROFESSION_LIST_PATH}/${slug}/recipes`,
    query
  );
}

/** Which Profession editor tab is active — General (the record's own
    fields) or Recipes (Slice 9D.3). The former Metadata tab (Slice
    9D.4) was removed in the Visual Pass (sub-slice 4): its one fact
    (Recipe count) is already shown by the Recipes tab's own count, and
    Verification/Timestamps duplicate General's aside, so
    /admin/professions/[slug]/metadata now redirects to General instead
    of rendering a third tab. */
export type ProfessionEditorTabKey = "general" | "recipes";

/** Structurally compatible with the shared `EditorTab` type
    (`src/components/admin/editor-tabs.tsx`) without importing a
    component into this pure, React-free module. */
export type ProfessionEditorTab = {
  label: string;
  href: string;
  active: boolean;
  disabled?: boolean;
  count?: number;
};

/** Relationship-count badge for the Profession tab strip (Phase B
    sub-slice): the number of linked Recipes, exactly what the Recipes
    tab itself lists. */
export type ProfessionEditorTabCounts = {
  recipes?: number;
};

/**
 * The Profession editor's tab strip, shared by every route inside the
 * Profession workspace that renders tabs (General edit and Recipes) —
 * one function so every tab's href/active state can never drift out of
 * sync between pages. The create page shows only General with no
 * placeholders at all (mirroring the Item/Recipe workspaces' create-page
 * precedent), so this helper stays edit-only.
 */
export function professionEditorTabs(
  slug: string,
  query: string,
  active: ProfessionEditorTabKey,
  counts?: ProfessionEditorTabCounts
): ProfessionEditorTab[] {
  return [
    {
      label: "General",
      href: professionEditHref(slug, query),
      active: active === "general",
    },
    {
      label: "Recipes",
      href: professionRecipesHref(slug, query),
      active: active === "recipes",
      count: counts?.recipes,
    },
  ];
}
