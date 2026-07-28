// Pure URL and search-normalization rules for the Player Class workspace
// This independent module owns Class workspace URLs without implying any
// Recipe relationship. No React or database access lives here.
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

/** The independent Class editor exposes only its own General fields. */
export type PlayerClassEditorTabKey = "general";

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

/**
 * The Class editor's single General tab. Create continues to render its
 * existing local General tab before a record exists.
 */
export function playerClassEditorTabs(
  slug: string,
  query: string,
  active: PlayerClassEditorTabKey
): PlayerClassEditorTab[] {
  return [
    {
      label: "General",
      href: playerClassEditHref(slug, query),
      active: active === "general",
    },
  ];
}
