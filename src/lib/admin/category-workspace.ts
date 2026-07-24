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
// This started as a narrow navigation-foundation pass, mirroring the
// Profession workspace's own Slice 9D.1 exactly (no tabs). Slice 9E.2
// (General editor conversion) added `categoryEditorTabs`, mirroring the
// Profession workspace's own Slice 9D.2 shape exactly: General is the
// only real tab so far — Items (a relationship tab, later slice) and
// Metadata (not yet implemented) render as disabled placeholders.
//
// Slice 9E.3 (Items relationship tab) made Items a real destination too,
// mirroring the Profession workspace's own Slice 9D.3 shape exactly:
// `categoryEditorTabs` now takes an `active` key (General or Items)
// exactly like `professionEditorTabs` does. Metadata remains the only
// disabled placeholder.
//
// Slice 9E.4 (Metadata tab) made Metadata a real destination too,
// completing the Category workspace: every Category tab is now a real
// link — none renders as a disabled placeholder, matching the Item
// (Slice 9B.8), Recipe (Slice 9C.4), and Profession (Slice 9D.4)
// workspaces' finished shape.

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

/** The Items tab route for one category, preserving the query (Slice
    9E.3) — read-only item relationship content, mirroring
    `professionRecipesHref`. */
export function categoryItemsHref(slug: string, query: string): string {
  return withCategorySearchQuery(`${CATEGORY_LIST_PATH}/${slug}/items`, query);
}

/** Which Category editor tab is active — General (the record's own
    fields) or Items (Slice 9E.3). The former Metadata tab (Slice 9E.4)
    was removed in the Visual Pass (sub-slice 4): its one fact (Item
    count) is already shown by the Items tab's own count, and Timestamps
    duplicates General's aside, so /admin/categories/[slug]/metadata now
    redirects to General instead of rendering a third tab. */
export type CategoryEditorTabKey = "general" | "items";

/** Structurally compatible with the shared `EditorTab` type
    (`src/components/admin/editor-tabs.tsx`) without importing a
    component into this pure, React-free module. */
export type CategoryEditorTab = {
  label: string;
  href: string;
  active: boolean;
  disabled?: boolean;
  count?: number;
};

/** Relationship-count badge for the Category tab strip (Phase B
    sub-slice): the number of linked Items, exactly what the Items tab
    itself lists. */
export type CategoryEditorTabCounts = {
  items?: number;
};

/**
 * The Category editor's tab strip, shared by every route inside the
 * Category workspace that renders tabs (General edit and Items) — one
 * function so every tab's href/active state can never drift out of sync
 * between pages. The create page shows only General with no
 * placeholders at all (mirroring the Item/Recipe/Profession workspaces'
 * create-page precedent), so this helper stays edit-only.
 */
export function categoryEditorTabs(
  slug: string,
  query: string,
  active: CategoryEditorTabKey,
  counts?: CategoryEditorTabCounts
): CategoryEditorTab[] {
  return [
    {
      label: "General",
      href: categoryEditHref(slug, query),
      active: active === "general",
    },
    {
      label: "Items",
      href: categoryItemsHref(slug, query),
      active: active === "items",
      count: counts?.items,
    },
  ];
}

/**
 * The Category delete-blocking rule, shared by the dedicated /delete
 * route AND the in-editor delete dialog (Admin Polish Pass 1, Part 5) —
 * one function so the two surfaces can never drift apart. A Category
 * cannot be deleted while any Item still references it.
 */
export function categoryCanDelete(itemCount: number): boolean {
  return itemCount === 0;
}

/** The human-readable reason a Category is blocked from deletion — shared
    by both surfaces for the same reason as categoryCanDelete above. */
export function describeLinkedItems(count: number): string {
  return count === 1 ? "1 item" : `${count} items`;
}
