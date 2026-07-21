// Global public search across the five game-data resources, through Prisma
// only. This module never creates a database client itself: the Prisma
// client is passed in by the caller (the /search page passes the shared
// client from src/lib/db.ts; integration tests pass the guard-verified test
// client), and the only Prisma reference here is type-level. That keeps the
// module safe to import from service-free unit tests and preserves the
// guard-first order for test database access.
//
// Matching is deliberately simple: case-insensitive substring matching on
// each resource's own text fields (name, and description where the field
// exists), plus relational NAME matching through Prisma
// relation filters — an Item matches through its Category name, and a
// Recipe matches through its resulting Item name, its Profession name, or
// any of its ingredient Item names. Relation descriptions are deliberately
// not searched. Slugs are internal/editable identifiers, not user-facing
// search terms, so they are not searched. Queries never log, never mutate,
// and never expose database IDs.

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
  // One concise line explaining a purely relational match (for example
  // "Ingredient: Iron Ore"); null when the record matched directly through
  // its own fields and needs no explanation.
  context: string | null;
};

// A relation that may explain why a record matched, in priority order.
type RelationCandidate = {
  label: string;
  value: string | null | undefined;
};

/**
 * Picks the one context line for a result. Direct matches (the query occurs
 * in one of the record's own fields) need no explanation and return null.
 * Otherwise the FIRST relation candidate containing the query wins, so the
 * caller's candidate order is the deterministic priority. Substring checks
 * use simple lowercase comparison — this decides display text only, never
 * which records match (Prisma already decided that), so a rare collation
 * difference degrades to "no context line", not to a wrong result.
 */
export function buildMatchContext(
  rawQuery: unknown,
  directFields: (string | null | undefined)[],
  relations: RelationCandidate[]
): string | null {
  const query = normalizeSearchQuery(rawQuery).toLowerCase();

  if (query === "") {
    return null;
  }

  const matchedDirectly = directFields.some(
    (field) => typeof field === "string" && field.toLowerCase().includes(query)
  );
  if (matchedDirectly) {
    return null;
  }

  const relation = relations.find(
    (candidate) =>
      typeof candidate.value === "string" &&
      candidate.value.toLowerCase().includes(query)
  );

  return relation ? `${relation.label}: ${relation.value}` : null;
}

export type GlobalSearchResults = {
  items: SearchResultEntry[];
  recipes: SearchResultEntry[];
  professions: SearchResultEntry[];
  categories: SearchResultEntry[];
  // Slice 10E: Locations searched the same restrained way as Professions
  // and Categories — direct name/description matching only, no relational
  // matching (there is no "find a Location by the Items obtainable there"
  // path here, matching the existing scope of every other resource).
  locations: SearchResultEntry[];
};

export function emptySearchResults(): GlobalSearchResults {
  return {
    items: [],
    recipes: [],
    professions: [],
    categories: [],
    locations: [],
  };
}

/**
 * Runs the five bounded, deterministic (name then slug, ascending) resource
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

  const [items, recipes, professions, categories, locations] = await Promise.all([
    // Direct fields plus the Category relation by NAME. Relation names
    // selected here are internal input for the context line only and are
    // stripped from the returned entries below.
    db.item.findMany({
      where: {
        OR: [
          { name: contains },
          { description: contains },
          { category: { name: contains } },
        ],
      },
      select: {
        slug: true,
        name: true,
        description: true,
        category: { select: { name: true } },
      },
      orderBy: ordering,
      take: SEARCH_RESULTS_PER_TYPE,
    }),
    // Recipe has no description field in the schema; its own searchable
    // text field is name. Relational matching covers the resulting Item,
    // the Profession, and every ingredient Item — all by name. One OR over
    // one findMany returns each Recipe at most once, however many of these
    // relations match.
    db.recipe.findMany({
      where: {
        OR: [
          { name: contains },
          { resultingItem: { name: contains } },
          { profession: { name: contains } },
          { ingredients: { some: { item: { name: contains } } } },
        ],
      },
      select: {
        slug: true,
        name: true,
        resultingItem: { select: { name: true } },
        profession: { select: { name: true } },
        // Ordered so "first matching ingredient" is deterministic.
        ingredients: {
          select: { item: { select: { name: true } } },
          orderBy: { item: { name: "asc" } },
        },
      },
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
    // Same restrained shape as Profession/Category: direct name/description
    // matching only, no relational matching (never Item-by-Location).
    db.location.findMany({
      where: { OR: [{ name: contains }, { description: contains }] },
      select: { slug: true, name: true, description: true },
      orderBy: ordering,
      take: SEARCH_RESULTS_PER_TYPE,
    }),
  ]);

  return {
    items: items.map((item) => ({
      slug: item.slug,
      name: item.name,
      description: item.description,
      context: buildMatchContext(
        query,
        [item.name, item.description],
        [{ label: "Category", value: item.category?.name }]
      ),
    })),
    recipes: recipes.map((recipe) => ({
      slug: recipe.slug,
      name: recipe.name,
      description: null,
      // Priority when several relations match: result, then profession,
      // then the alphabetically first matching ingredient.
      context: buildMatchContext(
        query,
        [recipe.name],
        [
          { label: "Result", value: recipe.resultingItem.name },
          { label: "Profession", value: recipe.profession?.name },
          ...recipe.ingredients.map((ingredient) => ({
            label: "Ingredient",
            value: ingredient.item.name,
          })),
        ]
      ),
    })),
    professions: professions.map((profession) => ({
      ...profession,
      context: null,
    })),
    categories: categories.map((category) => ({ ...category, context: null })),
    locations: locations.map((location) => ({ ...location, context: null })),
  };
}

/** Total hits across every group, for the no-results decision. */
export function countSearchResults(results: GlobalSearchResults): number {
  return (
    results.items.length +
    results.recipes.length +
    results.professions.length +
    results.categories.length +
    results.locations.length
  );
}

/**
 * One-line summary of what the results page is showing, e.g.
 * "Showing 6 results across 2 resource types." — phrased as DISPLAYED
 * results ("Showing"), because each group is capped at
 * SEARCH_RESULTS_PER_TYPE and the true match count may be larger. Pure
 * counting/formatting only; callers with zero results render the
 * no-results state instead.
 */
export function buildSearchSummary(results: GlobalSearchResults): string {
  const total = countSearchResults(results);
  const groups = [
    results.items,
    results.recipes,
    results.professions,
    results.categories,
    results.locations,
  ].filter((group) => group.length > 0).length;

  const resultWord = total === 1 ? "result" : "results";
  const typeWord = groups === 1 ? "resource type" : "resource types";

  return `Showing ${total} ${resultWord} across ${groups} ${typeWord}.`;
}
