// Shared, pure primitives for LIVE (client-side, keystroke-by-keystroke)
// filtering of an already-loaded public catalogue.
//
// This is deliberately a different thing from src/lib/search/global-search.ts:
// that module defines what a match means for a DATABASE query across every
// resource; this one defines what a match means for a set of records the page
// has already rendered. Both use the same rule — case-insensitive substring
// over the record's own searchable text — so a visitor never sees one surface
// disagree with the other about whether "copper" matches "Copper Ingot".
//
// Nothing here touches React, Prisma, or the DOM, so every rule below is unit
// testable on plain values.

/** One already-rendered catalogue record, reduced to what filtering needs. */
export type LiveFilterEntry = {
  /** Stable React key — the record's own id or slug. */
  key: string;
  /** Everything this record can be matched against, already concatenated. */
  text: string;
};

/**
 * Normalizes a raw input value into the form every comparison uses: trimmed
 * and lowercased. A repeated URL parameter (`?q=a&q=b`) collapses to its first
 * value, matching readCatalogueQueryValue's own rule, and anything blank or
 * non-string becomes "" — which callers treat as "no filter".
 */
export function normalizeLiveQuery(raw: unknown): string {
  const single = Array.isArray(raw) ? raw[0] : raw;
  return typeof single === "string" ? single.trim().toLocaleLowerCase() : "";
}

/** True when this record's searchable text contains the normalized query. */
export function matchesLiveQuery(text: string, normalizedQuery: string): boolean {
  if (normalizedQuery === "") return true;
  return text.toLocaleLowerCase().includes(normalizedQuery);
}

/**
 * The matching subset, in the caller's own (already deterministic, server-side)
 * order. A blank query returns every entry — the same array contents the page
 * rendered — so clearing the field restores the full catalogue with no
 * re-query.
 */
export function filterLiveEntries<T extends LiveFilterEntry>(
  entries: readonly T[],
  normalizedQuery: string,
): T[] {
  if (normalizedQuery === "") return [...entries];
  return entries.filter((entry) => matchesLiveQuery(entry.text, normalizedQuery));
}

/**
 * Joins a record's searchable fields into one text blob. Blank and missing
 * fields are dropped, so a record with no description never matches a query
 * through empty string.
 */
export function buildLiveSearchText(
  ...fields: (string | null | undefined)[]
): string {
  return fields
    .map((field) => (typeof field === "string" ? field.trim() : ""))
    .filter((field) => field !== "")
    .join(" ");
}

export type LivePageWindow = {
  currentPage: number;
  pageCount: number;
  start: number;
  end: number;
};

/**
 * Clamps a requested page against a result count that changes on every
 * keystroke. This is what keeps live filtering from stranding the visitor on
 * page 4 of a result set that now has one page: the page index is always
 * re-derived from the CURRENT match count, never trusted from before the
 * filter changed.
 */
export function resolveLivePageWindow(
  requestedPage: number,
  totalCount: number,
  pageSize: number,
): LivePageWindow {
  // An unpaginated catalogue passes an infinite page size; arithmetic on it
  // would produce 0 * Infinity = NaN and slice away every result, so that case
  // is answered directly: one page holding everything.
  if (!Number.isFinite(pageSize) || pageSize <= 0) {
    return { currentPage: 1, pageCount: 1, start: 0, end: totalCount };
  }

  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(
    Number.isFinite(requestedPage) && requestedPage > 0
      ? Math.floor(requestedPage)
      : 1,
    pageCount,
  );
  const start = (currentPage - 1) * pageSize;

  return { currentPage, pageCount, start, end: start + pageSize };
}

/**
 * Whether a query change should send the visitor back to the first page.
 *
 * Any real change to the search term does: the previous page index describes a
 * result set that no longer exists. Changes that normalize away (trailing
 * whitespace, letter case) deliberately do not, so a stray space never throws
 * away the visitor's place in a long catalogue.
 */
export function shouldResetLivePage(
  previousQuery: string,
  nextQuery: string,
): boolean {
  return normalizeLiveQuery(previousQuery) !== normalizeLiveQuery(nextQuery);
}

/** One filterable group in a hierarchical directory (Locations, Shops). */
export type LiveFilterGroup<T extends LiveFilterEntry = LiveFilterEntry> = {
  key: string;
  /** The group heading's own searchable text, when the heading is itself a
      record that can match (a Locations root region). Undefined for a group
      that is pure structure (a Shops type band). */
  headingText?: string;
  subGroups: {
    key: string;
    entries: T[];
  }[];
};

export type LiveFilteredGroup<T extends LiveFilterEntry = LiveFilterEntry> = {
  key: string;
  /** Matching records in this group, plus its own heading when that matched —
      the count the fold displays. */
  matchCount: number;
  subGroups: { key: string; entries: T[] }[];
};

/**
 * Filters a hierarchical directory the way the server already did: a subgroup
 * with no surviving record disappears, and a group survives when its own
 * heading matches or any of its records do. A group whose heading alone
 * matches survives with an empty body and a count of one — preserving the
 * existing server behavior exactly, rather than quietly changing it.
 */
export function filterLiveGroups<T extends LiveFilterEntry>(
  groups: readonly LiveFilterGroup<T>[],
  normalizedQuery: string,
): LiveFilteredGroup<T>[] {
  return groups
    .map((group) => {
      const headingMatches =
        typeof group.headingText === "string" &&
        matchesLiveQuery(group.headingText, normalizedQuery);

      const subGroups = group.subGroups
        .map((subGroup) => ({
          key: subGroup.key,
          entries: filterLiveEntries(subGroup.entries, normalizedQuery),
        }))
        .filter((subGroup) => subGroup.entries.length > 0);

      const entryCount = subGroups.reduce(
        (total, subGroup) => total + subGroup.entries.length,
        0,
      );

      return {
        key: group.key,
        matchCount: entryCount + (headingMatches ? 1 : 0),
        subGroups,
      };
    })
    .filter((group) => group.matchCount > 0);
}
