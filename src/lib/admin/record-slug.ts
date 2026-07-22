// The ONE definition per resource of "this Page address is already taken":
// mirrors src/lib/admin/record-name.ts exactly, but keyed on `slug`
// instead of `name`, and always an EXACT (never `contains`) match — a
// Page address is either this value or it is not. All five resources'
// availability checks (a brand-new feature; there was no live slug check
// before Phase B1) live in one shared module rather than diverging five
// ways, since — unlike Name, whose Item variant predates this shared
// module and stayed split for backward compatibility — nothing here has
// any existing call site to preserve.
//
// Like record-name.ts, the only Prisma reference is type-level — callers
// pass their own client — so importing this file never creates a database
// connection (safe for unit tests, guard-first for integration tests).

import { normalizeSlug } from "@/lib/slug";

type GameDataClient = (typeof import("@/lib/db"))["prisma"];

// The live check can only ever say one of these three words about a
// candidate — no IDs, counts, or other record data leave the server.
export type RecordSlugAvailability = "available" | "taken" | "unchecked";

// Comfortably above any real Page address while keeping the query input
// bounded — mirrors MAX_RECORD_NAME_LENGTH's own rationale.
export const MAX_RECORD_SLUG_LENGTH = 200;

/**
 * Normalizes a raw candidate the same way every parseXInput does before
 * its own uniqueness check: the exact src/lib/slug.ts rule the server
 * parser applies to a submitted slug (or a blank one derived from Name).
 * Non-string input becomes "".
 */
export function normalizeRecordSlugCandidate(raw: unknown): string {
  return typeof raw === "string" ? normalizeSlug(raw) : "";
}

/** True when another Item already uses this Page address. `excludeId`
    skips one record so an Item being edited never conflicts with itself. */
export async function isItemSlugTaken(
  db: GameDataClient,
  rawSlug: string,
  excludeId?: string
): Promise<boolean> {
  const slug = normalizeRecordSlugCandidate(rawSlug);

  if (slug === "") {
    return false;
  }

  const existing = await db.item.findFirst({
    where: { slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    select: { id: true },
  });

  return existing !== null;
}

/** Recipe twin of isItemSlugTaken — identical rule and guarantees. */
export async function isRecipeSlugTaken(
  db: GameDataClient,
  rawSlug: string,
  excludeId?: string
): Promise<boolean> {
  const slug = normalizeRecordSlugCandidate(rawSlug);

  if (slug === "") {
    return false;
  }

  const existing = await db.recipe.findFirst({
    where: { slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    select: { id: true },
  });

  return existing !== null;
}

/** Profession twin of isItemSlugTaken — identical rule and guarantees. */
export async function isProfessionSlugTaken(
  db: GameDataClient,
  rawSlug: string,
  excludeId?: string
): Promise<boolean> {
  const slug = normalizeRecordSlugCandidate(rawSlug);

  if (slug === "") {
    return false;
  }

  const existing = await db.profession.findFirst({
    where: { slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    select: { id: true },
  });

  return existing !== null;
}

/** Category twin of isItemSlugTaken — identical rule and guarantees. */
export async function isCategorySlugTaken(
  db: GameDataClient,
  rawSlug: string,
  excludeId?: string
): Promise<boolean> {
  const slug = normalizeRecordSlugCandidate(rawSlug);

  if (slug === "") {
    return false;
  }

  const existing = await db.category.findFirst({
    where: { slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    select: { id: true },
  });

  return existing !== null;
}

/** Location twin of isItemSlugTaken — identical rule and guarantees. */
export async function isLocationSlugTaken(
  db: GameDataClient,
  rawSlug: string,
  excludeId?: string
): Promise<boolean> {
  const slug = normalizeRecordSlugCandidate(rawSlug);

  if (slug === "") {
    return false;
  }

  const existing = await db.location.findFirst({
    where: { slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    select: { id: true },
  });

  return existing !== null;
}
