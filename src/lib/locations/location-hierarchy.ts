// Hierarchy helpers for the Location self-relation: the admin cycle guard
// below, and (Slice 10C) the public breadcrumb's ancestor walk. Like the
// other shared data modules, the only Prisma reference here is type-level
// — callers pass their own client — so importing this file never creates
// a database connection (safe for unit tests, guard-first for
// integration tests).

type GameDataClient = (typeof import("@/lib/db"))["prisma"];

// Defensive upper bound on how many ancestors this walks before giving up.
// A hierarchy built exclusively through this same guard can never actually
// reach this depth — it exists so a corrupted or unexpectedly deep chain
// fails safely (rejected) instead of looping without end.
const MAX_ANCESTOR_STEPS = 200;

/**
 * True when assigning `candidateParentId` as the parent of `locationId`
 * would create a cycle: the candidate IS the location itself, or is one of
 * the location's own descendants (which would make the location its own
 * ancestor). Walks UP from the candidate through its chain of parents in
 * plain application code — deliberately not a database-specific recursive
 * query — stopping the moment it reaches `locationId` (a cycle) or runs out
 * of parents (safe, no cycle). A parent id that does not resolve to any row
 * is not this function's concern and is treated as safe; the caller's own
 * "does this parent exist" check handles that case.
 */
export async function wouldCreateLocationCycle(
  db: GameDataClient,
  locationId: string,
  candidateParentId: string
): Promise<boolean> {
  if (candidateParentId === locationId) {
    return true;
  }

  let currentId: string | null = candidateParentId;

  for (let step = 0; step < MAX_ANCESTOR_STEPS; step += 1) {
    // Explicit result type: TypeScript cannot otherwise infer the awaited
    // value's type inside this loop without circularity, because the
    // generated Location payload type (a self-referencing model) depends on
    // the very relation this function is walking.
    const current: { parentId: string | null } | null =
      await db.location.findUnique({
        where: { id: currentId },
        select: { parentId: true },
      });

    if (!current || current.parentId === null) {
      return false;
    }

    if (current.parentId === locationId) {
      return true;
    }

    currentId = current.parentId;
  }

  // Exceeded the bound without resolving: treat as unsafe rather than risk
  // an unbounded walk.
  return true;
}

export type LocationAncestor = { name: string; slug: string };

// Defensive upper bound on how many ancestors the public breadcrumb walks
// before giving up. Authored game locations are never anywhere near this
// deep (the examples in the brief top out around Region -> Town ->
// Building); this exists only so a corrupted or unexpectedly deep chain
// truncates safely instead of walking without end. Deliberately smaller
// than MAX_ANCESTOR_STEPS above: that constant guards a worst-case cycle
// check the admin action runs once per save, while this one runs on every
// public page view and only ever needs to cover plausible authored depth.
const MAX_BREADCRUMB_ANCESTORS = 10;

/**
 * Walks UP from `startParentId` through the chain of parents, returning
 * each ancestor's name and slug in ROOT-FIRST order (the order a
 * breadcrumb reads left to right) — never a database id, never
 * verification/Game Version fields. Plain application code, one small
 * restrained query per level (never a database-specific recursive
 * query), stopping the moment it runs out of parents, revisits an id
 * already seen (a defensive cycle guard — the admin's own
 * wouldCreateLocationCycle check should make this unreachable through
 * normal use), or reaches MAX_BREADCRUMB_ANCESTORS. A parent id that does
 * not resolve to any row simply ends the walk at that point.
 */
export async function loadLocationAncestors(
  db: GameDataClient,
  startParentId: string | null
): Promise<LocationAncestor[]> {
  const ancestors: LocationAncestor[] = [];
  const visited = new Set<string>();
  let currentId = startParentId;

  for (
    let step = 0;
    step < MAX_BREADCRUMB_ANCESTORS && currentId !== null;
    step += 1
  ) {
    if (visited.has(currentId)) {
      break;
    }
    visited.add(currentId);

    // Explicit result type: TypeScript cannot otherwise infer the awaited
    // value's type inside this loop without circularity, matching
    // wouldCreateLocationCycle's own reasoning above.
    const current: { name: string; slug: string; parentId: string | null } | null =
      await db.location.findUnique({
        where: { id: currentId },
        select: { name: true, slug: true, parentId: true },
      });

    if (!current) {
      break;
    }

    ancestors.push({ name: current.name, slug: current.slug });
    currentId = current.parentId;
  }

  return ancestors.reverse();
}
