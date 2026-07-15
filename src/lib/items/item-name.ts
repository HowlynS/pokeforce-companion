// The ONE definition of "these two Item names are duplicates": a trimmed,
// case-insensitive match. Both the authoritative create/edit server actions
// and the live availability check call into this module, so the
// while-typing feedback can never drift from what submission actually
// enforces. Like the search module, the only Prisma reference here is
// type-level — callers pass their own client — so importing this file never
// creates a database connection (safe for unit tests, guard-first for
// integration tests).

type GameDataClient = (typeof import("@/lib/db"))["prisma"];

// Upper bound for names accepted by the availability check. The forms set
// no explicit maximum, so this only needs to be comfortably above any real
// item name while keeping the query input bounded.
export const MAX_ITEM_NAME_LENGTH = 200;

/**
 * Normalizes a raw name the same way parseItemInput does before its
 * duplicate check: trim surrounding whitespace; anything non-string becomes
 * "" (which callers treat as "nothing to check").
 */
export function normalizeItemNameInput(raw: unknown): string {
  return typeof raw === "string" ? raw.trim() : "";
}

/**
 * True when two names are the same under the duplicate rule (trimmed,
 * case-insensitive). Used client-side only to recognize "still the current
 * name" during editing — the database comparison itself always runs through
 * isItemNameTaken.
 */
export function itemNamesAreEquivalent(a: unknown, b: unknown): boolean {
  const left = normalizeItemNameInput(a).toLowerCase();
  const right = normalizeItemNameInput(b).toLowerCase();
  return left !== "" && left === right;
}

/**
 * True when another Item already uses this name (trimmed, case-insensitive
 * via Prisma's insensitive equals — the exact query the server actions have
 * always used). `excludeId` skips one record so an Item being edited never
 * conflicts with itself. Read-only; never logs; a blank name is never
 * "taken".
 */
export async function isItemNameTaken(
  db: GameDataClient,
  rawName: string,
  excludeId?: string
): Promise<boolean> {
  const name = normalizeItemNameInput(rawName);

  if (name === "") {
    return false;
  }

  const existing = await db.item.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });

  return existing !== null;
}
