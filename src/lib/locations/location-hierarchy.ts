// Cycle guard for the Location self-relation. Like the other shared data
// modules, the only Prisma reference here is type-level — callers pass
// their own client — so importing this file never creates a database
// connection (safe for unit tests, guard-first for integration tests).

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
