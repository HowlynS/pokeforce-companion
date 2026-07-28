// Pure URL and search-normalization rules for the Player Class workspace
// (Player Classes + Recipe EXP milestone) — mirrors
// src/lib/admin/profession-workspace.ts's shape exactly (the closest
// existing analog: image, verification stamp, and a Recipes relationship
// tab), but is deliberately its own independent module, not a shared
// cross-resource framework. No React, no database: the PlayerClassWorkspace
// component applies these, and the unit tests pin them.
//
// The internal/schema/domain name is PlayerClass; the admin URL segment and
// every user-facing label read "Class"/"Classes" instead, matching the
// public `/classes` route this same milestone introduces.

export const PLAYER_CLASS_LIST_PATH = "/admin/classes";
export const PLAYER_CLASS_CREATE_PATH = "/admin/classes/new";

/** The URL parameter the Player Class list's search submits as. */
export const PLAYER_CLASS_SEARCH_PARAM = "q";

/**
 * Normalizes a raw ?q= value the same way the server filters: trimmed;
 * anything non-string (absent, array-shaped, tampered) becomes "" — an
 * unfiltered list, never an error.
 */
export function normalizePlayerClassSearchQuery(raw: unknown): string {
  return typeof raw === "string" ? raw.trim() : "";
}

/**
 * Appends the active search query to a workspace path, so quick
 * switching, the create page, and back/cancel links all keep the
 * admin's filter. A blank query appends nothing — clean URLs stay clean.
 */
export function withPlayerClassSearchQuery(path: string, query: string): string {
  if (!query) {
    return path;
  }

  return `${path}?${PLAYER_CLASS_SEARCH_PARAM}=${encodeURIComponent(query)}`;
}

/** The edit route for one Player Class, preserving the active search query. */
export function playerClassEditHref(slug: string, query: string): string {
  return withPlayerClassSearchQuery(
    `${PLAYER_CLASS_LIST_PATH}/${slug}/edit`,
    query
  );
}

/** The delete-confirmation route for one Player Class, preserving the
    query. */
export function playerClassDeleteHref(slug: string, query: string): string {
  return withPlayerClassSearchQuery(
    `${PLAYER_CLASS_LIST_PATH}/${slug}/delete`,
    query
  );
}

/** The Recipes tab route for one Player Class, preserving the query —
    read-only Recipe relationship content, mirroring
    professionRecipesHref. */
export function playerClassRecipesHref(slug: string, query: string): string {
  return withPlayerClassSearchQuery(
    `${PLAYER_CLASS_LIST_PATH}/${slug}/recipes`,
    query
  );
}

/** Which Player Class editor tab is active — General (the record's own
    fields) or Recipes (the Recipes requiring this Class). */
export type PlayerClassEditorTabKey = "general" | "recipes";

/** Structurally compatible with the shared `EditorTab` type
    (`src/components/admin/editor-tabs.tsx`) without importing a
    component into this pure, React-free module. */
export type PlayerClassEditorTab = {
  label: string;
  href: string;
  active: boolean;
  disabled?: boolean;
  count?: number;
};

/** Relationship-count badge for the Player Class tab strip: the number of
    Recipes requiring this Class, exactly what the Recipes tab itself
    lists. */
export type PlayerClassEditorTabCounts = {
  recipes?: number;
};

/**
 * The Player Class editor's tab strip, shared by every route inside the
 * Player Class workspace that renders tabs (General edit and Recipes) —
 * one function so every tab's href/active state can never drift out of
 * sync between pages. The create page shows only General with no
 * placeholders at all (mirroring the Profession workspace's create-page
 * precedent), so this helper stays edit-only.
 */
export function playerClassEditorTabs(
  slug: string,
  query: string,
  active: PlayerClassEditorTabKey,
  counts?: PlayerClassEditorTabCounts
): PlayerClassEditorTab[] {
  return [
    {
      label: "General",
      href: playerClassEditHref(slug, query),
      active: active === "general",
    },
    {
      label: "Recipes",
      href: playerClassRecipesHref(slug, query),
      active: active === "recipes",
      count: counts?.recipes,
    },
  ];
}

/**
 * The Player Class delete-blocking rule, shared by the dedicated /delete
 * route AND the in-editor delete dialog — one function so the two
 * surfaces can never drift apart. A Player Class cannot be deleted while
 * any Recipe still requires it (Recipe.playerClassId is a required
 * relation, unlike Profession's optional one — so this rule can never be
 * bypassed by reassigning to "no Class").
 */
export function playerClassCanDelete(recipeCount: number): boolean {
  return recipeCount === 0;
}

/** The human-readable reason a Player Class is blocked from deletion —
    shared by both surfaces for the same reason as playerClassCanDelete
    above. */
export function describeLinkedRecipes(count: number): string {
  return count === 1 ? "1 recipe" : `${count} recipes`;
}
