// The header's global quick-search suggestions: ranking, grouping, and
// capping for the compact dropdown beneath the site search field.
//
// This module deliberately owns NO definition of what a match is. Matching
// stays with src/lib/search/global-search.ts, whose results this module
// re-shapes, so the dropdown and the /search page can never disagree about
// which records a query finds. What lives here is only presentation policy:
// which resources the dropdown shows, how many, and in what order.

import type { GlobalSearchResults, SearchResultEntry } from "@/lib/search/global-search";

/** Below this, the dropdown stays closed and no request is made. */
export const QUICK_SEARCH_MIN_QUERY_LENGTH = 2;
/** The whole dropdown's budget — a shortcut, not a results page. */
export const QUICK_SEARCH_TOTAL_LIMIT = 7;
/** No single resource may fill the dropdown on its own. */
export const QUICK_SEARCH_GROUP_LIMIT = 3;

/**
 * The resources the dropdown offers, in display order. Categories are
 * deliberately absent: they are a filter over Items rather than a destination
 * a visitor searches for, and /search still lists them in full. There is no
 * NPC resource in production, so none appears here.
 */
export const QUICK_SEARCH_GROUPS = [
  { key: "items", label: "Items", basePath: "/items" },
  { key: "recipes", label: "Recipes", basePath: "/recipes" },
  { key: "professions", label: "Professions", basePath: "/professions" },
  { key: "playerClasses", label: "Classes", basePath: "/classes" },
  { key: "locations", label: "Locations", basePath: "/locations" },
  { key: "shops", label: "Shops", basePath: "/shops" },
] as const;

export type QuickSearchGroupKey = (typeof QUICK_SEARCH_GROUPS)[number]["key"];

export type QuickSearchResult = {
  name: string;
  href: string;
  /** The existing relational explanation line, when the record matched
      through a relation rather than its own name. */
  context: string | null;
};

export type QuickSearchGroup = {
  key: QuickSearchGroupKey;
  label: string;
  results: QuickSearchResult[];
};

/**
 * Relevance, lowest number first:
 *   0 the name IS the query, 1 the name starts with it, 2 the name contains
 *   it, 3 it matched through some other searchable text.
 * Deliberately this and nothing more — no weighting, no scoring model.
 */
export function rankQuickResult(name: string, query: string): number {
  const target = name.trim().toLocaleLowerCase();
  const needle = query.trim().toLocaleLowerCase();

  if (needle === "") return 3;
  if (target === needle) return 0;
  if (target.startsWith(needle)) return 1;
  if (target.includes(needle)) return 2;
  return 3;
}

export function isQuickSearchQuery(query: string): boolean {
  return query.trim().length >= QUICK_SEARCH_MIN_QUERY_LENGTH;
}

/**
 * Turns full search results into the dropdown's compact grouped shape.
 *
 * Each resource is ranked and capped on its own, then the whole set competes
 * for one small total budget by relevance. A resource with much stronger
 * matches therefore takes more of the dropdown than a resource with weak ones,
 * rather than every group being padded to an equal size. Ties break by group
 * order and then by name, so the same query always produces the same panel.
 * Empty groups are dropped entirely.
 */
export function buildQuickSearchGroups(
  results: GlobalSearchResults,
  query: string,
): QuickSearchGroup[] {
  const ranked = QUICK_SEARCH_GROUPS.flatMap((group, groupIndex) => {
    const entries = results[group.key] as SearchResultEntry[];

    return entries
      .map((entry) => ({
        groupIndex,
        rank: rankQuickResult(entry.name, query),
        name: entry.name,
        href: `${group.basePath}/${entry.slug}`,
        context: entry.context,
      }))
      .sort(
        (left, right) =>
          left.rank - right.rank || left.name.localeCompare(right.name),
      )
      .slice(0, QUICK_SEARCH_GROUP_LIMIT);
  });

  const selected = ranked
    .sort(
      (left, right) =>
        left.rank - right.rank ||
        left.groupIndex - right.groupIndex ||
        left.name.localeCompare(right.name),
    )
    .slice(0, QUICK_SEARCH_TOTAL_LIMIT);

  return QUICK_SEARCH_GROUPS.map((group, groupIndex) => ({
    key: group.key,
    label: group.label,
    results: selected
      .filter((entry) => entry.groupIndex === groupIndex)
      .sort((left, right) => left.rank - right.rank || left.name.localeCompare(right.name))
      .map(({ name, href, context }) => ({ name, href, context })),
  })).filter((group) => group.results.length > 0);
}

/** Flat list of every suggestion, in panel order — the keyboard's own order. */
export function flattenQuickSearchGroups(
  groups: readonly QuickSearchGroup[],
): QuickSearchResult[] {
  return groups.flatMap((group) => group.results);
}
