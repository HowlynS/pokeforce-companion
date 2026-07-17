// The ONE definition per resource of "these two names are duplicates": a
// trimmed, case-insensitive match, excluding the record itself during
// editing. Category, Profession, and Recipe each get their own explicitly
// written Prisma query (no generic delegate indirection — the four models
// stay simple and readable); the equivalent Item helper lives unchanged in
// src/lib/items/item-name.ts. Both the authoritative create/edit server
// actions and the live availability checks call these helpers, so the
// while-typing feedback can never drift from what submission enforces.
//
// Like the other shared data modules, the only Prisma reference here is
// type-level — callers pass their own client — so importing this file never
// creates a database connection (safe for unit tests, guard-first for
// integration tests).

type GameDataClient = (typeof import("@/lib/db"))["prisma"];

// The live check can only ever say one of these three words about a name —
// no IDs, counts, or other record data leave the server.
export type RecordNameAvailability = "available" | "taken" | "unchecked";

// Upper bound for names accepted by the availability checks. The forms set
// no explicit maximum, so this only needs to be comfortably above any real
// name while keeping the query input bounded (same value as the Item bound).
export const MAX_RECORD_NAME_LENGTH = 200;

/**
 * Normalizes a raw name the same way the input parsers do before their
 * duplicate checks: trim surrounding whitespace; anything non-string
 * becomes "" (which callers treat as "nothing to check").
 */
export function normalizeRecordNameInput(raw: unknown): string {
  return typeof raw === "string" ? raw.trim() : "";
}

/**
 * True when two names are the same under the duplicate rule (trimmed,
 * case-insensitive). Used client-side only to recognize "still the current
 * name" during editing — the database comparison itself always runs through
 * the is*NameTaken helpers.
 */
export function recordNamesAreEquivalent(a: unknown, b: unknown): boolean {
  const left = normalizeRecordNameInput(a).toLowerCase();
  const right = normalizeRecordNameInput(b).toLowerCase();
  return left !== "" && left === right;
}

/**
 * True when another Category already uses this name (trimmed,
 * case-insensitive via Prisma's insensitive equals — the exact query the
 * server actions have always used). `excludeId` skips one record so a
 * Category being edited never conflicts with itself. Read-only; never
 * logs; a blank name is never "taken".
 */
export async function isCategoryNameTaken(
  db: GameDataClient,
  rawName: string,
  excludeId?: string
): Promise<boolean> {
  const name = normalizeRecordNameInput(rawName);

  if (name === "") {
    return false;
  }

  const existing = await db.category.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });

  return existing !== null;
}

/** Profession twin of isCategoryNameTaken — identical rule and guarantees. */
export async function isProfessionNameTaken(
  db: GameDataClient,
  rawName: string,
  excludeId?: string
): Promise<boolean> {
  const name = normalizeRecordNameInput(rawName);

  if (name === "") {
    return false;
  }

  const existing = await db.profession.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });

  return existing !== null;
}

/** Recipe twin of isCategoryNameTaken — identical rule and guarantees. */
export async function isRecipeNameTaken(
  db: GameDataClient,
  rawName: string,
  excludeId?: string
): Promise<boolean> {
  const name = normalizeRecordNameInput(rawName);

  if (name === "") {
    return false;
  }

  const existing = await db.recipe.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });

  return existing !== null;
}

/** Location twin of isCategoryNameTaken — identical rule and guarantees. */
export async function isLocationNameTaken(
  db: GameDataClient,
  rawName: string,
  excludeId?: string
): Promise<boolean> {
  const name = normalizeRecordNameInput(rawName);

  if (name === "") {
    return false;
  }

  const existing = await db.location.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });

  return existing !== null;
}
