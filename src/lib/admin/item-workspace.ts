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

/** The Acquisition Sources tab route for one item, preserving the query
    (Slice 9B.6) — the tab landing page (list + create). */
export function itemSourcesHref(slug: string, query: string): string {
  return withItemSearchQuery(`${ITEM_LIST_PATH}/${slug}/sources`, query);
}

/** The edit route for one acquisition source, preserving the query. */
export function itemSourceEditHref(
  slug: string,
  sourceId: string,
  query: string
): string {
  return withItemSearchQuery(
    `${ITEM_LIST_PATH}/${slug}/sources/${sourceId}/edit`,
    query
  );
}

/** The delete-confirmation route for one acquisition source, preserving
    the query. */
export function itemSourceDeleteHref(
  slug: string,
  sourceId: string,
  query: string
): string {
  return withItemSearchQuery(
    `${ITEM_LIST_PATH}/${slug}/sources/${sourceId}/delete`,
    query
  );
}

/** Which Item editor tab is active — General (the record's own fields)
    or Acquisition Sources (Slice 9B.6). Used in Recipes and Metadata
    have no content yet, so `itemEditorTabs` always renders them as inert
    placeholders regardless of this value. */
export type ItemEditorTabKey = "general" | "sources";

/** Structurally compatible with the shared `EditorTab` type
    (`src/components/admin/editor-tabs.tsx`) without importing a
    component into this pure, React-free module. */
export type ItemEditorTab = {
  label: string;
  href: string;
  active: boolean;
  disabled?: boolean;
};

/**
 * The Item editor's tab strip, shared by every route inside the Item
 * workspace that renders tabs (General edit/create, and every
 * Acquisition Sources route) — one function so General's and Acquisition
 * Sources' hrefs/active state can never drift out of sync between pages.
 * Used in Recipes and Metadata have no destination yet, so they render
 * as disabled placeholders — never fake links to empty pages.
 */
export function itemEditorTabs(
  slug: string,
  query: string,
  active: ItemEditorTabKey
): ItemEditorTab[] {
  return [
    {
      label: "General",
      href: itemEditHref(slug, query),
      active: active === "general",
    },
    {
      label: "Acquisition Sources",
      href: itemSourcesHref(slug, query),
      active: active === "sources",
    },
    { label: "Used in Recipes", href: "", active: false, disabled: true },
    { label: "Metadata", href: "", active: false, disabled: true },
  ];
}
