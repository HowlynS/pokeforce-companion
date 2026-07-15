// Global public search across the four game-data resources, through Prisma
// only. This module never creates a database client itself: the Prisma
// client is passed in by the caller (the /search page passes the shared
// client from src/lib/db.ts; integration tests pass the guard-verified test
// client), and the only Prisma reference here is type-level. That keeps the
// module safe to import from service-free unit tests and preserves the
// guard-first order for test database access.
//
// Matching is deliberately simple for this first slice: case-insensitive
// substring matching on each resource's own text fields (name, description
// where the field exists, and Item.rarity). Slugs are internal/editable
// identifiers, not user-facing search terms, so they are not searched.
// Relational search (e.g. finding a Recipe by its ingredient's name) is
// deferred. Queries never log, never mutate, and never expose database IDs.

type GameDataClient = (typeof import("@/lib/db"))["prisma"];

// Upper bound per resource type. Ten keeps the grouped page scannable and
// every query bounded; a more specific query narrows the results naturally.
export const SEARCH_RESULTS_PER_TYPE = 10;

/**
 * Normalizes the raw `q` value from the URL into a clean query string:
 * surrounding whitespace is trimmed, a repeated parameter (`?q=a&q=b`)
 * collapses to its first value, and anything blank or non-string becomes ""
 * — which callers treat as "no query".
 */
export function normalizeSearchQuery(raw: unknown): string {
  const single = Array.isArray(raw) ? raw[0] : raw;
  return typeof single === "string" ? single.trim() : "";
}

/** One search hit, shaped for public display: no database IDs. */
export type SearchResultEntry = {
  slug: string;
  name: string;
  description: string | null;
};

export type GlobalSearchResults = {
  items: SearchResultEntry[];
  recipes: SearchResultEntry[];
  professions: SearchResultEntry[];
  categories: SearchResultEntry[];
};

export function emptySearchResults(): GlobalSearchResults {
  return { items: [], recipes: [], professions: [], categories: [] };
}

/**
 * Runs the four bounded, deterministic (name then slug, ascending) resource
 * queries for a normalized query string. A blank query short-circuits to
 * empty results without touching the database.
 */
export async function searchGameData(
  db: GameDataClient,
  rawQuery: string
): Promise<GlobalSearchResults> {
  const query = normalizeSearchQuery(rawQuery);

  if (query === "") {
    return emptySearchResults();
  }

  const contains = { contains: query, mode: "insensitive" as const };
  const ordering = [{ name: "asc" as const }, { slug: "asc" as const }];

  const [items, recipes, professions, categories] = await Promise.all([
    db.item.findMany({
      where: {
        OR: [
          { name: contains },
          { description: contains },
          { rarity: contains },
        ],
      },
      select: { slug: true, name: true, description: true },
      orderBy: ordering,
      take: SEARCH_RESULTS_PER_TYPE,
    }),
    // Recipe has no description field in the schema; its only searchable
    // text field is name.
    db.recipe.findMany({
      where: { name: contains },
      select: { slug: true, name: true },
      orderBy: ordering,
      take: SEARCH_RESULTS_PER_TYPE,
    }),
    db.profession.findMany({
      where: { OR: [{ name: contains }, { description: contains }] },
      select: { slug: true, name: true, description: true },
      orderBy: ordering,
      take: SEARCH_RESULTS_PER_TYPE,
    }),
    db.category.findMany({
      where: { OR: [{ name: contains }, { description: contains }] },
      select: { slug: true, name: true, description: true },
      orderBy: ordering,
      take: SEARCH_RESULTS_PER_TYPE,
    }),
  ]);

  return {
    items,
    recipes: recipes.map((recipe) => ({ ...recipe, description: null })),
    professions,
    categories,
  };
}

/** Total hits across every group, for the no-results decision. */
export function countSearchResults(results: GlobalSearchResults): number {
  return (
    results.items.length +
    results.recipes.length +
    results.professions.length +
    results.categories.length
  );
}
