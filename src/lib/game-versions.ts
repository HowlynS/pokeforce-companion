// The ONE definition of the Game Version rules introduced in Slice 9A:
// which version is current, how the current version changes, how versions
// are created/edited/deleted, and how gameplay data gets its verification
// stamp. The database row marked isCurrent replaced the retired
// CURRENT_GAME_BUILD_ID environment variable as the single source of truth
// for "the current game version".
//
// Like the other shared data modules, the only Prisma reference here is
// type-level — callers pass their own client — so importing this file never
// creates a database connection (safe for unit tests, guard-first for
// integration tests).

import { isGameVersionNameTaken } from "@/lib/admin/record-name";
import { isForeignKeyError, isUniqueConstraintError } from "@/lib/prisma-errors";

type GameDataClient = (typeof import("@/lib/db"))["prisma"];

// The Prisma client type of an interactive-transaction callback parameter.
type GameDataTransaction = Parameters<
  Parameters<GameDataClient["$transaction"]>[0]
>[0];

/**
 * Serializes every writer of the isCurrent flag. Under READ COMMITTED a
 * plain "unset all currents, then set mine" transaction is NOT safe: a
 * concurrent transaction's freshly-set current row is invisible to this
 * transaction's updateMany snapshot, so two overlapping mark-current
 * calls (or two bootstrap creates racing on an empty table) could each
 * commit their own current row. pg_advisory_xact_lock makes the second
 * writer wait until the first commits, so its unset step always sees the
 * winner's row. Transaction-scoped (released automatically at
 * commit/rollback) and safe under pooled connections; no schema change —
 * Prisma cannot express the partial unique index that would otherwise
 * carry this invariant (see DECISIONS.md 2026-07-17).
 */
async function lockCurrentFlagWriters(tx: GameDataTransaction): Promise<void> {
  // $executeRaw, not $queryRaw: pg_advisory_xact_lock returns the
  // PostgreSQL `void` type, which $queryRaw cannot deserialize.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('pokeforce_game_version_current'))`;
}

export type GameVersionRecord = {
  id: string;
  name: string;
  releaseDate: Date | null;
  isCurrent: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * The version currently marked current, or null when none is. A null
 * result is a real state (for example immediately after the Slice 9A
 * migration, which deliberately promotes nothing): marking gameplay data
 * as verified fails with a clear message until an admin promotes a
 * version through the settings screen.
 */
export async function getCurrentGameVersion(
  db: GameDataClient
): Promise<GameVersionRecord | null> {
  return db.gameVersion.findFirst({ where: { isCurrent: true } });
}

export type VerificationStampError =
  | "no_current_version"
  | "invalid_game_version";

/**
 * The explicit opt-in verification action, shared by every verifiable
 * resource's create/update server actions. The checkbox only ever carries
 * intent ("on" or absent); the stamped timestamp always comes from the
 * server clock.
 *
 * Version selection: a form MAY submit a `verifiedGameVersionId` naming
 * the Game Version the admin verified against — any EXISTING version,
 * current or historical, is valid. The id is never trusted blindly: it
 * must resolve to a real GameVersion row, and a nonexistent or tampered
 * id fails the whole submission with `invalid_game_version` (it is never
 * silently swapped for another version).
 *
 * Temporary compatibility fallback (documented in DECISIONS.md
 * 2026-07-17): the existing admin forms predate version selection and
 * submit no `verifiedGameVersionId` at all. When the field is absent or
 * blank, the stamp falls back to the single database row marked current —
 * the same behavior those forms have always had — failing with
 * `no_current_version` when nothing is current. A later Milestone 9 slice
 * adds the picker UI; this fallback keeps the compatibility forms safe
 * until then and can outlive them harmlessly ("no selection" simply means
 * "the current version").
 *
 * Returns a null stamp when the box was unchecked; a normal edit without
 * the checkbox therefore never touches existing verification metadata.
 */
export async function resolveVerificationStamp(
  db: GameDataClient,
  formData: FormData
): Promise<
  | { stamp: { verifiedAt: Date; verifiedGameVersionId: string } | null; failed: false }
  | { stamp: null; failed: true; error: VerificationStampError }
> {
  if (formData.get("markVerified") !== "on") {
    return { stamp: null, failed: false };
  }

  const submittedId = String(formData.get("verifiedGameVersionId") ?? "").trim();

  if (submittedId) {
    const selected = await db.gameVersion.findUnique({
      where: { id: submittedId },
    });

    if (!selected) {
      return { stamp: null, failed: true, error: "invalid_game_version" };
    }

    return {
      stamp: { verifiedAt: new Date(), verifiedGameVersionId: selected.id },
      failed: false,
    };
  }

  const current = await getCurrentGameVersion(db);

  if (!current) {
    return { stamp: null, failed: true, error: "no_current_version" };
  }

  return {
    stamp: { verifiedAt: new Date(), verifiedGameVersionId: current.id },
    failed: false,
  };
}

export type CreateGameVersionResult =
  | { ok: true; version: GameVersionRecord; madeCurrent: boolean }
  | { ok: false; error: "duplicate_name" };

/**
 * Creates a Game Version. The very first version ever created becomes
 * current automatically (there is nothing else it could meaningfully sit
 * behind); every later version starts non-current and is promoted only by
 * the explicit mark-current action. Versions that already exist but are
 * not current — such as historical versions carried over by the Slice 9A
 * migration — deliberately do NOT trigger the automatic promotion: with
 * history present, choosing the current version is the admin's call.
 * The duplicate rule is the shared trimmed, case-insensitive one; the
 * database's unique constraint on name backs it up.
 */
export async function createGameVersion(
  db: GameDataClient,
  input: { name: string; releaseDate: Date | null }
): Promise<CreateGameVersionResult> {
  if (await isGameVersionNameTaken(db, input.name)) {
    return { ok: false, error: "duplicate_name" };
  }

  try {
    return await db.$transaction(async (tx) => {
      // Serialized with every other current-flag writer, so two bootstrap
      // creates racing on an empty table cannot both see count 0.
      await lockCurrentFlagWriters(tx);

      const existingCount = await tx.gameVersion.count();
      const madeCurrent = existingCount === 0;

      const version = await tx.gameVersion.create({
        data: {
          name: input.name,
          releaseDate: input.releaseDate,
          isCurrent: madeCurrent,
        },
      });

      return { ok: true as const, version, madeCurrent };
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { ok: false, error: "duplicate_name" };
    }
    throw error;
  }
}

export type UpdateGameVersionResult =
  | { ok: true; version: GameVersionRecord }
  | { ok: false; error: "missing_version" | "duplicate_name" };

/**
 * Edits a version's name and release date only. isCurrent is deliberately
 * not editable here — the current flag moves exclusively through
 * setCurrentGameVersion, so an edit can never accidentally create a second
 * current version or silently demote the current one. Verification stamps
 * referencing this version follow the rename automatically (they reference
 * the row, not the name).
 */
export async function updateGameVersion(
  db: GameDataClient,
  id: string,
  input: { name: string; releaseDate: Date | null }
): Promise<UpdateGameVersionResult> {
  const existing = await db.gameVersion.findUnique({ where: { id } });

  if (!existing) {
    return { ok: false, error: "missing_version" };
  }

  if (await isGameVersionNameTaken(db, input.name, id)) {
    return { ok: false, error: "duplicate_name" };
  }

  try {
    const version = await db.gameVersion.update({
      where: { id },
      data: { name: input.name, releaseDate: input.releaseDate },
    });
    return { ok: true, version };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { ok: false, error: "duplicate_name" };
    }
    throw error;
  }
}

export type SetCurrentGameVersionResult =
  | { ok: true; version: GameVersionRecord }
  | { ok: false; error: "missing_version" };

/**
 * Marks one version current, unsetting whichever version was current
 * before it inside the same transaction — so "at most one current" holds
 * at every commit point and the previous version safely becomes a
 * selectable historical version rather than being deleted or altered.
 * Marking the already-current version again is a harmless no-op.
 */
export async function setCurrentGameVersion(
  db: GameDataClient,
  id: string
): Promise<SetCurrentGameVersionResult> {
  return db.$transaction(async (tx) => {
    // Serialized with every other current-flag writer, so a concurrent
    // mark-current's freshly-set row can never be missed by the unset
    // step below.
    await lockCurrentFlagWriters(tx);

    const target = await tx.gameVersion.findUnique({ where: { id } });

    if (!target) {
      return { ok: false as const, error: "missing_version" as const };
    }

    await tx.gameVersion.updateMany({
      where: { isCurrent: true, NOT: { id } },
      data: { isCurrent: false },
    });

    const version = await tx.gameVersion.update({
      where: { id },
      data: { isCurrent: true },
    });

    return { ok: true as const, version };
  });
}

/**
 * How many verification stamps reference this version, across every
 * verifiable model (Item, Location, AcquisitionSource, Recipe,
 * Profession). Category is deliberately absent — it has no verification.
 */
export async function countVerificationReferences(
  db: GameDataClient,
  id: string
): Promise<number> {
  const [items, locations, sources, recipes, professions] = await Promise.all([
    db.item.count({ where: { verifiedGameVersionId: id } }),
    db.location.count({ where: { verifiedGameVersionId: id } }),
    db.acquisitionSource.count({ where: { verifiedGameVersionId: id } }),
    db.recipe.count({ where: { verifiedGameVersionId: id } }),
    db.profession.count({ where: { verifiedGameVersionId: id } }),
  ]);

  return items + locations + sources + recipes + professions;
}

export type DeleteGameVersionResult =
  | { ok: true }
  | { ok: false; error: "missing_version" | "referenced"; referenceCount?: number };

/**
 * Deletes a version only when no verification stamp references it. The
 * count pre-check exists to give a friendly message; the database-level
 * ON DELETE RESTRICT on every verifiedGameVersionId relation is the
 * authoritative protection, so a stamp added between the check and the
 * delete still blocks it. Deleting the current version is allowed when it
 * is unreferenced — the application then simply has no current version
 * until an admin promotes another, exactly like the post-migration state.
 */
export async function deleteGameVersion(
  db: GameDataClient,
  id: string
): Promise<DeleteGameVersionResult> {
  const existing = await db.gameVersion.findUnique({ where: { id } });

  if (!existing) {
    return { ok: false, error: "missing_version" };
  }

  const referenceCount = await countVerificationReferences(db, id);

  if (referenceCount > 0) {
    return { ok: false, error: "referenced", referenceCount };
  }

  try {
    await db.gameVersion.delete({ where: { id } });
    return { ok: true };
  } catch (error) {
    if (isForeignKeyError(error)) {
      // A stamp appeared between the count check and the delete call; the
      // database's RESTRICT held, so report the same blocked outcome.
      return { ok: false, error: "referenced" };
    }
    throw error;
  }
}
