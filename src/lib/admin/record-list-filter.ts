// Pure, resource-agnostic helpers behind the shared client-side record-list
// filter (Phase B1, System A). RecordList itself (a "use client" component)
// calls these; keeping the matching/count/URL rules here as plain functions
// makes them unit-testable without React or next/navigation, and reusable
// identically across all five converted resources (Items, Recipes,
// Professions, Categories, Locations) — no per-resource filtering logic.

/** The fields every record row is matched against: name and Page address
    always; `searchTerms` is an optional escape hatch for a resource's own
    existing, genuinely useful, already-displayed short metadata (e.g.
    Location's type label) — never descriptions, never a new heavyweight
    fetch, and never resource-specific logic inside the matcher itself
    (the CALLER decides what belongs in the list; the matcher only knows
    how to search a flat list of strings). */
export type RecordListFilterable = {
  primary: string;
  slug: string;
  searchTerms?: readonly string[];
};

const OBSOLETE_LIST_PARAMS = ["page", "pageSize"];

/** Trims a raw filter query the same way every other admin query input is
    normalized. Non-string input becomes "". */
export function normalizeRecordFilterQuery(raw: unknown): string {
  return typeof raw === "string" ? raw.trim() : "";
}

/** Case-insensitive, trimmed match against a row's name (primary), its
    Page address (slug), and any optional `searchTerms` the caller supplied
    — never descriptions or other heavyweight fields, and never a
    resource-specific branch here: a resource either has extra searchable
    terms or it doesn't, and this function treats both cases identically. */
export function matchesRecordFilter(
  row: RecordListFilterable,
  query: string
): boolean {
  const trimmed = normalizeRecordFilterQuery(query);

  if (trimmed === "") {
    return true;
  }

  const needle = trimmed.toLowerCase();
  return (
    row.primary.toLowerCase().includes(needle) ||
    row.slug.toLowerCase().includes(needle) ||
    (row.searchTerms?.some((term) => term.toLowerCase().includes(needle)) ??
      false)
  );
}

/** Filters a full row list against one query — a blank query returns every
    row (a new array, never the same reference, so callers can rely on a
    fresh array each time). */
export function filterRecordRows<T extends RecordListFilterable>(
  rows: readonly T[],
  query: string
): T[] {
  const trimmed = normalizeRecordFilterQuery(query);

  if (trimmed === "") {
    return rows.slice();
  }

  return rows.filter((row) => matchesRecordFilter(row, trimmed));
}

export type RecordListNoun = {
  singular: string;
  plural: string;
};

/**
 * Total-vs-filtered count wording, e.g. "16 items" with no active filter,
 * "4 of 16 items" while filtering, correctly singular in both forms ("1
 * item", "1 of 16 items"). Pluralization always follows the TOTAL count —
 * "of 1 item" never "of 1 items" — matching ordinary English regardless of
 * how many currently match.
 */
export function formatRecordCount(
  totalCount: number,
  filteredCount: number,
  hasQuery: boolean,
  noun: RecordListNoun
): string {
  const word = totalCount === 1 ? noun.singular : noun.plural;

  if (!hasQuery) {
    return `${totalCount} ${word}`;
  }

  return `${filteredCount} of ${totalCount} ${word}`;
}

/**
 * Rewrites (or removes) one query parameter on an already-built href/URL
 * string, preserving every other parameter and any hash — pure string
 * manipulation with no `window`/`URL` base-URL requirement, so it works
 * identically for a bare path ("/admin/items/foo/edit?q=old") in both
 * server-rendered and client-rendered contexts. An empty value removes the
 * parameter entirely rather than writing `param=`.
 */
export function withUpdatedSearchParam(
  href: string,
  paramName: string,
  value: string
): string {
  const hashIndex = href.indexOf("#");
  const hash = hashIndex === -1 ? "" : href.slice(hashIndex);
  const withoutHash = hashIndex === -1 ? href : href.slice(0, hashIndex);

  const queryIndex = withoutHash.indexOf("?");
  const path = queryIndex === -1 ? withoutHash : withoutHash.slice(0, queryIndex);
  const queryString = queryIndex === -1 ? "" : withoutHash.slice(queryIndex + 1);

  const params = new URLSearchParams(queryString);

  if (value === "") {
    params.delete(paramName);
  } else {
    params.set(paramName, value);
  }

  const nextQuery = params.toString();
  return path + (nextQuery ? `?${nextQuery}` : "") + hash;
}

/**
 * Builds the address-bar URL for the list's own page as the filter changes:
 * preserves the pathname, any existing hash fragment, and every unrelated
 * existing parameter; sets or removes the filter parameter; and always
 * strips the now-obsolete pagination parameters (`page`, `pageSize`) if a
 * stale deep link happens to carry either — pagination no longer exists,
 * so those parameters are never round-tripped back into a replaced URL.
 * `hash` defaults to "" (no admin list route currently uses one), matching
 * withUpdatedSearchParam's own hash-preserving contract for row/create
 * hrefs so the two URL helpers stay consistent.
 */
export function buildSyncedListUrl(
  pathname: string,
  currentParams: URLSearchParams,
  paramName: string,
  value: string,
  hash = ""
): string {
  const params = new URLSearchParams(currentParams);

  for (const obsolete of OBSOLETE_LIST_PARAMS) {
    params.delete(obsolete);
  }

  if (value === "") {
    params.delete(paramName);
  } else {
    params.set(paramName, value);
  }

  const query = params.toString();
  return pathname + (query ? `?${query}` : "") + hash;
}
