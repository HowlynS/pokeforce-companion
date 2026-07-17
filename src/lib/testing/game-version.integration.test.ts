// Guarded integration tests for the Slice 9A Game Version foundation
// against the REAL isolated Supabase test database: name uniqueness, the
// single-current invariant, first-version bootstrap, safe current
// switching, deletion blocking while referenced, relational verification
// stamps on every verifiable model (Item, Location, AcquisitionSource,
// Recipe, Profession), Category's deliberate lack of verification, and
// rejection of tampered Game Version ids.
//
// Every verifiable row created here uses the test-gameversion- slug prefix
// and every GameVersion the test-gv-int- NAME prefix (GameVersion has no
// slug); both are removed by deleteGameVersionTestRecords. Cleanup is
// strictly suite-scoped: the browser tests' versions and the E2E fixture
// version ("test-gv-current") are never deleted here.
//
// Every test that needs a controlled current-version state arranges it
// itself and puts the flag back exactly as found (see
// captureCurrentVersionId / restoreCurrentVersionId): a foreign current
// version — typically the persistent browser fixture, which E2E runs
// leave current — may be demoted for the duration of one test, but is
// always re-promoted in that test's own finally block. No test depends on
// another test having run first, on file order, or on the GameVersion
// table being empty — except the first-version bootstrap test, which is
// only observable on an empty table and skips (with the reason inline)
// when any version exists.
//
// Only vitest.integration.config.ts collects this file; the unit config
// excludes **/*.integration.test.ts, so `pnpm test:unit` never loads it.

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { isForeignKeyError, isUniqueConstraintError } from "@/lib/prisma-errors";
import { isGameVersionNameTaken } from "@/lib/admin/record-name";
import {
  countVerificationReferences,
  createGameVersion,
  deleteGameVersion,
  getCurrentGameVersion,
  resolveVerificationStamp,
  setCurrentGameVersion,
  updateGameVersion,
} from "@/lib/game-versions";
import {
  GAME_VERSION_ROWS_SLUG_PREFIX,
  GAME_VERSION_TEST_NAME_PREFIX,
  deleteGameVersionTestRecords,
  disconnectTestPrisma,
  getVerifiedTestPrisma,
} from "./integration-database";

const P = GAME_VERSION_ROWS_SLUG_PREFIX;
const N = GAME_VERSION_TEST_NAME_PREFIX;

// A syntactically valid String id that is never created anywhere, so
// operations targeting it deterministically hit the missing/tampered path.
const NONEXISTENT_ID = `${P}nonexistent-id`;

function formDataFrom(entries: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }
  return formData;
}

type TestPrisma = Awaited<ReturnType<typeof getVerifiedTestPrisma>>;

/**
 * Records which version is current before a test rearranges the current
 * flag, so the test's finally block can put the flag back exactly as
 * found. Integration tests must never permanently demote a foreign row —
 * in particular the persistent browser fixture ("test-gv-current"), which
 * E2E runs leave current in the shared test database.
 */
async function captureCurrentVersionId(
  prisma: TestPrisma
): Promise<string | null> {
  return (await getCurrentGameVersion(prisma))?.id ?? null;
}

/**
 * Restores the state captured by captureCurrentVersionId. A foreign
 * version that was current is re-promoted through the same locked service
 * transaction the application uses; when nothing was current, only
 * integration-owned rows (test-gv-int- names) are demoted — a foreign row
 * is never demoted during restore.
 */
async function restoreCurrentVersionId(
  prisma: TestPrisma,
  previousCurrentId: string | null
): Promise<void> {
  if (previousCurrentId) {
    const stillExists = await prisma.gameVersion.findUnique({
      where: { id: previousCurrentId },
    });
    if (stillExists) {
      await setCurrentGameVersion(prisma, previousCurrentId);
      return;
    }
  }

  await prisma.gameVersion.updateMany({
    where: { isCurrent: true, name: { startsWith: N } },
    data: { isCurrent: false },
  });
}

describe("game versions (integration)", () => {
  beforeAll(async () => {
    // First database contact of the run: the guard inside
    // getVerifiedTestPrisma() throws here if the environment is not the
    // verified test project. Also removes any prefix-scoped leftovers an
    // interrupted earlier run may have stranded.
    await deleteGameVersionTestRecords();
  });

  // Backstop cleanup after every test: even a failing write test cannot
  // leave a prefixed row behind. Verifiable rows first, then GameVersions —
  // every verifiedGameVersionId relation is ON DELETE RESTRICT.
  afterEach(async () => {
    await deleteGameVersionTestRecords();
  });

  afterAll(async () => {
    const remaining = await deleteGameVersionTestRecords();
    await disconnectTestPrisma();
    // Fail loudly if cleanup was still needed at the very end — afterEach
    // should already have removed everything.
    expect(remaining).toBe(0);
  });

  describe("creation and the single-current invariant", () => {
    it("makes the very first version current automatically, and only that one", async (ctx) => {
      const prisma = await getVerifiedTestPrisma();

      // The first-version bootstrap is only observable on an EMPTY
      // GameVersion table, and this suite only ever deletes its own
      // prefixed versions. The persistent browser fixture
      // ("test-gv-current") is never deleted by any automated cleanup, so
      // once an E2E run has created it this test skips rather than failing
      // or reaching beyond its prefix — run it against a freshly reset
      // test database to exercise the bootstrap path.
      if ((await prisma.gameVersion.count()) > 0) {
        ctx.skip();
      }

      const first = await createGameVersion(prisma, {
        name: `${N}first`,
        releaseDate: null,
      });
      expect(first.ok).toBe(true);
      if (first.ok) {
        expect(first.madeCurrent).toBe(true);
        expect(first.version.isCurrent).toBe(true);
      }

      // A later version never bootstraps itself to current.
      const second = await createGameVersion(prisma, {
        name: `${N}second`,
        releaseDate: new Date("2026-07-01T00:00:00.000Z"),
      });
      expect(second.ok).toBe(true);
      if (second.ok) {
        expect(second.madeCurrent).toBe(false);
        expect(second.version.isCurrent).toBe(false);
        expect(second.version.releaseDate?.toISOString()).toBe(
          "2026-07-01T00:00:00.000Z"
        );
      }

      expect(await prisma.gameVersion.count({ where: { isCurrent: true } })).toBe(1);
    });

    it("rejects duplicate names through the service and the database constraint", async () => {
      const prisma = await getVerifiedTestPrisma();

      const created = await createGameVersion(prisma, {
        name: `${N}unique`,
        releaseDate: null,
      });
      expect(created.ok).toBe(true);

      // Service-level duplicate rule: trimmed and case-insensitive, the
      // same rule every other resource uses.
      const exactDuplicate = await createGameVersion(prisma, {
        name: `${N}unique`,
        releaseDate: null,
      });
      expect(exactDuplicate).toEqual({ ok: false, error: "duplicate_name" });

      const caseDuplicate = await createGameVersion(prisma, {
        name: `${N}UNIQUE`,
        releaseDate: null,
      });
      expect(caseDuplicate).toEqual({ ok: false, error: "duplicate_name" });

      expect(await isGameVersionNameTaken(prisma, `  ${N}unique  `)).toBe(true);

      // The database's own unique constraint backs the service rule up: a
      // raw create that bypasses the service fails with a genuine P2002.
      let caught: unknown = null;
      try {
        await prisma.gameVersion.create({ data: { name: `${N}unique` } });
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
      expect(isUniqueConstraintError(caught)).toBe(true);
    });

    it("edits name and release date without touching the current flag, and rejects duplicates", async () => {
      const prisma = await getVerifiedTestPrisma();
      const previousCurrentId = await captureCurrentVersionId(prisma);

      try {
        const a = await prisma.gameVersion.create({ data: { name: `${N}edit-a` } });
        const b = await prisma.gameVersion.create({ data: { name: `${N}edit-b` } });
        // Arranged through the locked service call, so exactly one version
        // is current while this test runs.
        await setCurrentGameVersion(prisma, b.id);

        const renamed = await updateGameVersion(prisma, a.id, {
          name: `${N}edit-a-renamed`,
          releaseDate: new Date("2026-01-15T00:00:00.000Z"),
        });
        expect(renamed.ok).toBe(true);
        if (renamed.ok) {
          expect(renamed.version.name).toBe(`${N}edit-a-renamed`);
          expect(renamed.version.releaseDate?.toISOString()).toBe(
            "2026-01-15T00:00:00.000Z"
          );
          expect(renamed.version.isCurrent).toBe(false);
        }

        // Editing never moves the current flag.
        const bReloaded = await prisma.gameVersion.findUnique({ where: { id: b.id } });
        expect(bReloaded?.isCurrent).toBe(true);

        const duplicate = await updateGameVersion(prisma, a.id, {
          name: `${N}EDIT-B`,
          releaseDate: null,
        });
        expect(duplicate).toEqual({ ok: false, error: "duplicate_name" });

        const missing = await updateGameVersion(prisma, NONEXISTENT_ID, {
          name: `${N}edit-never`,
          releaseDate: null,
        });
        expect(missing).toEqual({ ok: false, error: "missing_version" });
      } finally {
        await restoreCurrentVersionId(prisma, previousCurrentId);
      }
    });
  });

  describe("switching the current version", () => {
    it("marks a version current and safely unsets the previous one in the same transaction", async () => {
      const prisma = await getVerifiedTestPrisma();
      const previousCurrentId = await captureCurrentVersionId(prisma);

      try {
        const previous = await prisma.gameVersion.create({
          data: { name: `${N}switch-previous` },
        });
        const next = await prisma.gameVersion.create({
          data: { name: `${N}switch-next` },
        });
        await setCurrentGameVersion(prisma, previous.id);

        const result = await setCurrentGameVersion(prisma, next.id);
        expect(result.ok).toBe(true);

        // The previous version remains available as history — demoted,
        // never deleted or renamed.
        const previousReloaded = await prisma.gameVersion.findUnique({
          where: { id: previous.id },
        });
        expect(previousReloaded?.isCurrent).toBe(false);
        expect(previousReloaded?.name).toBe(`${N}switch-previous`);

        const current = await getCurrentGameVersion(prisma);
        expect(current?.id).toBe(next.id);
        expect(
          await prisma.gameVersion.count({ where: { isCurrent: true } })
        ).toBe(1);

        // Re-marking the already-current version is a harmless no-op.
        const again = await setCurrentGameVersion(prisma, next.id);
        expect(again.ok).toBe(true);
        expect(
          await prisma.gameVersion.count({ where: { isCurrent: true } })
        ).toBe(1);
      } finally {
        await restoreCurrentVersionId(prisma, previousCurrentId);
      }
    });

    it("rejects a tampered or nonexistent id without changing the current version", async () => {
      const prisma = await getVerifiedTestPrisma();
      const previousCurrentId = await captureCurrentVersionId(prisma);

      try {
        const current = await prisma.gameVersion.create({
          data: { name: `${N}tamper-current` },
        });
        await setCurrentGameVersion(prisma, current.id);

        const result = await setCurrentGameVersion(prisma, NONEXISTENT_ID);
        expect(result).toEqual({ ok: false, error: "missing_version" });

        const reloaded = await prisma.gameVersion.findUnique({
          where: { id: current.id },
        });
        expect(reloaded?.isCurrent).toBe(true);
      } finally {
        await restoreCurrentVersionId(prisma, previousCurrentId);
      }
    });

    it("keeps at most one current version when two mark-current calls overlap", async () => {
      const prisma = await getVerifiedTestPrisma();
      const previousCurrentId = await captureCurrentVersionId(prisma);

      try {
        const a = await prisma.gameVersion.create({
          data: { name: `${N}race-a` },
        });
        const b = await prisma.gameVersion.create({
          data: { name: `${N}race-b` },
        });

        // Both transactions start before either resolves — the exact
        // overlap the pg_advisory_xact_lock in setCurrentGameVersion
        // serializes. Without the lock, each transaction's unset step
        // could miss the other's not-yet-committed current row and both
        // versions could commit as current.
        const [resultA, resultB] = await Promise.all([
          setCurrentGameVersion(prisma, a.id),
          setCurrentGameVersion(prisma, b.id),
        ]);
        expect(resultA.ok).toBe(true);
        expect(resultB.ok).toBe(true);

        // Either version may win the race, but only one may remain
        // current — and no other row (foreign rows included) may be
        // current alongside the winner.
        const currents = await prisma.gameVersion.findMany({
          where: { isCurrent: true },
        });
        expect(currents).toHaveLength(1);
        expect([a.id, b.id]).toContain(currents[0].id);
      } finally {
        await restoreCurrentVersionId(prisma, previousCurrentId);
      }
    });
  });

  describe("verification stamping", () => {
    it("falls back to the current version when the form supplies no selection", async () => {
      const prisma = await getVerifiedTestPrisma();
      const previousCurrentId = await captureCurrentVersionId(prisma);

      try {
        const current = await prisma.gameVersion.create({
          data: { name: `${N}stamp-current` },
        });
        // Arranged through the locked service call, so this test's own
        // version is THE single current one regardless of what any other
        // test or browser run left behind.
        await setCurrentGameVersion(prisma, current.id);

        // An unchecked box never stamps.
        const unchecked = await resolveVerificationStamp(prisma, formDataFrom({}));
        expect(unchecked).toEqual({ stamp: null, failed: false });

        // No verifiedGameVersionId in the form (the compatibility-form
        // shape): the documented fallback stamps the row marked current.
        const checked = await resolveVerificationStamp(
          prisma,
          formDataFrom({ markVerified: "on" })
        );
        expect(checked.failed).toBe(false);
        expect(checked.stamp?.verifiedGameVersionId).toBe(current.id);
        expect(checked.stamp?.verifiedAt).toBeInstanceOf(Date);

        // A blank submitted value means the same as an absent field.
        const blank = await resolveVerificationStamp(
          prisma,
          formDataFrom({ markVerified: "on", verifiedGameVersionId: "   " })
        );
        expect(blank.failed).toBe(false);
        expect(blank.stamp?.verifiedGameVersionId).toBe(current.id);
      } finally {
        await restoreCurrentVersionId(prisma, previousCurrentId);
      }
    });

    it("stamps an explicitly selected version, current or historical", async () => {
      const prisma = await getVerifiedTestPrisma();
      const previousCurrentId = await captureCurrentVersionId(prisma);

      try {
        const current = await prisma.gameVersion.create({
          data: { name: `${N}select-current` },
        });
        await setCurrentGameVersion(prisma, current.id);
        const historical = await prisma.gameVersion.create({
          data: { name: `${N}select-historical` },
        });

        // A historical (non-current) version is a fully valid selection —
        // the milestone allows verifying a record against past versions.
        const selectedHistorical = await resolveVerificationStamp(
          prisma,
          formDataFrom({ markVerified: "on", verifiedGameVersionId: historical.id })
        );
        expect(selectedHistorical.failed).toBe(false);
        expect(selectedHistorical.stamp?.verifiedGameVersionId).toBe(historical.id);
        expect(selectedHistorical.stamp?.verifiedAt).toBeInstanceOf(Date);

        // Explicitly selecting the current version works the same way.
        const selectedCurrent = await resolveVerificationStamp(
          prisma,
          formDataFrom({ markVerified: "on", verifiedGameVersionId: current.id })
        );
        expect(selectedCurrent.failed).toBe(false);
        expect(selectedCurrent.stamp?.verifiedGameVersionId).toBe(current.id);
      } finally {
        await restoreCurrentVersionId(prisma, previousCurrentId);
      }
    });

    it("rejects a nonexistent or tampered selected id instead of substituting another version", async () => {
      const prisma = await getVerifiedTestPrisma();
      const previousCurrentId = await captureCurrentVersionId(prisma);

      try {
        // A current version EXISTS, so a silent fallback would succeed —
        // the rejection below proves the tampered id fails the submission
        // rather than being swapped for the current version.
        const fallback = await prisma.gameVersion.create({
          data: { name: `${N}tamper-fallback` },
        });
        await setCurrentGameVersion(prisma, fallback.id);

        const result = await resolveVerificationStamp(
          prisma,
          formDataFrom({ markVerified: "on", verifiedGameVersionId: NONEXISTENT_ID })
        );
        expect(result).toEqual({
          stamp: null,
          failed: true,
          error: "invalid_game_version",
        });
      } finally {
        await restoreCurrentVersionId(prisma, previousCurrentId);
      }
    });

    it("fails closed when no version is current and none was selected", async () => {
      const prisma = await getVerifiedTestPrisma();
      const previousCurrentId = await captureCurrentVersionId(prisma);

      try {
        // The post-migration state: versions exist but none is current.
        // Any foreign current version is demoted only for the duration of
        // this test — the finally block re-promotes it exactly as found.
        await prisma.gameVersion.updateMany({
          where: { isCurrent: true },
          data: { isCurrent: false },
        });
        await prisma.gameVersion.create({ data: { name: `${N}stamp-none` } });

        const result = await resolveVerificationStamp(
          prisma,
          formDataFrom({ markVerified: "on" })
        );
        expect(result).toEqual({
          stamp: null,
          failed: true,
          error: "no_current_version",
        });
      } finally {
        await restoreCurrentVersionId(prisma, previousCurrentId);
      }
    });

    it("stamps every verifiable model relationally and counts the references", async () => {
      const prisma = await getVerifiedTestPrisma();

      const version = await prisma.gameVersion.create({
        data: { name: `${N}stamp-all` },
      });
      const stamp = { verifiedAt: new Date(), verifiedGameVersionId: version.id };

      const item = await prisma.item.create({
        data: { name: "Test GameVersion Item", slug: `${P}item`, ...stamp },
      });
      const location = await prisma.location.create({
        data: {
          name: "Test GameVersion Location",
          slug: `${P}location`,
          type: "REGION",
          ...stamp,
        },
      });
      const source = await prisma.acquisitionSource.create({
        data: { itemId: item.id, type: "FORAGING", ...stamp },
      });
      const profession = await prisma.profession.create({
        data: {
          name: "Test GameVersion Profession",
          slug: `${P}profession`,
          ...stamp,
        },
      });
      const recipe = await prisma.recipe.create({
        data: {
          name: "Test GameVersion Recipe",
          slug: `${P}recipe`,
          resultingItemId: item.id,
          ...stamp,
        },
      });

      // Each stamp resolves to the real related version record.
      const reloadedRecipe = await prisma.recipe.findUnique({
        where: { id: recipe.id },
        include: { verifiedGameVersion: true },
      });
      expect(reloadedRecipe?.verifiedGameVersion?.name).toBe(`${N}stamp-all`);

      const reloadedProfession = await prisma.profession.findUnique({
        where: { id: profession.id },
        include: { verifiedGameVersion: true },
      });
      expect(reloadedProfession?.verifiedGameVersion?.id).toBe(version.id);

      expect(source.verifiedGameVersionId).toBe(version.id);
      expect(location.verifiedGameVersionId).toBe(version.id);
      expect(item.verifiedGameVersionId).toBe(version.id);

      expect(await countVerificationReferences(prisma, version.id)).toBe(5);
    });

    it("preserves Recipe and Profession verification through a normal edit", async () => {
      const prisma = await getVerifiedTestPrisma();

      const version = await prisma.gameVersion.create({
        data: { name: `${N}stamp-preserve` },
      });
      const stampedAt = new Date();
      const stamp = { verifiedAt: stampedAt, verifiedGameVersionId: version.id };

      const item = await prisma.item.create({
        data: { name: "Test GameVersion Preserve Item", slug: `${P}preserve-item` },
      });
      const recipe = await prisma.recipe.create({
        data: {
          name: "Test GameVersion Preserve Recipe",
          slug: `${P}preserve-recipe`,
          resultingItemId: item.id,
          ...stamp,
        },
      });
      const profession = await prisma.profession.create({
        data: {
          name: "Test GameVersion Preserve Profession",
          slug: `${P}preserve-profession`,
          ...stamp,
        },
      });

      // The exact write shape of a NORMAL edit: verification fields are
      // omitted entirely, so Prisma must leave them untouched.
      const editedRecipe = await prisma.recipe.update({
        where: { id: recipe.id },
        data: { requiredLevel: 5 },
      });
      expect(editedRecipe.verifiedAt?.getTime()).toBe(stampedAt.getTime());
      expect(editedRecipe.verifiedGameVersionId).toBe(version.id);

      const editedProfession = await prisma.profession.update({
        where: { id: profession.id },
        data: { description: "Edited without touching verification." },
      });
      expect(editedProfession.verifiedAt?.getTime()).toBe(stampedAt.getTime());
      expect(editedProfession.verifiedGameVersionId).toBe(version.id);
    });

    it("rejects a stamp pointing at a nonexistent Game Version with a genuine P2003", async () => {
      const prisma = await getVerifiedTestPrisma();

      let caught: unknown = null;
      try {
        await prisma.item.create({
          data: {
            name: "Test GameVersion Bogus Stamp Item",
            slug: `${P}bogus-stamp`,
            verifiedAt: new Date(),
            verifiedGameVersionId: NONEXISTENT_ID,
          },
        });
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
      expect(isForeignKeyError(caught)).toBe(true);
    });

    it("keeps Category without any verification columns", async () => {
      const prisma = await getVerifiedTestPrisma();

      // Checked at the database level, not just in TypeScript: the actual
      // Category table must carry no verification columns.
      const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'Category'
      `;
      const names = columns.map((column) => column.column_name);

      expect(names).not.toContain("verifiedAt");
      expect(names).not.toContain("verifiedGameVersionId");
      expect(names).not.toContain("verifiedBuildId");
    });
  });

  describe("deletion", () => {
    it("deletes an unused version, including an unreferenced current one", async () => {
      const prisma = await getVerifiedTestPrisma();
      const previousCurrentId = await captureCurrentVersionId(prisma);

      try {
        const historical = await prisma.gameVersion.create({
          data: { name: `${N}delete-unused` },
        });
        const current = await prisma.gameVersion.create({
          data: { name: `${N}delete-current` },
        });
        // Arranged through the locked service call, so this test's own
        // version is THE single current one before the deletions below.
        await setCurrentGameVersion(prisma, current.id);

        expect(await deleteGameVersion(prisma, historical.id)).toEqual({ ok: true });

        // Deleting the unreferenced current version is allowed; the
        // application then simply has no current version until an admin
        // promotes another one. Promoting `current` above demoted every
        // other row, so after this delete nothing is current — asserted
        // globally, then restored in the finally block.
        expect(await deleteGameVersion(prisma, current.id)).toEqual({ ok: true });
        expect(await getCurrentGameVersion(prisma)).toBeNull();

        expect(await deleteGameVersion(prisma, NONEXISTENT_ID)).toEqual({
          ok: false,
          error: "missing_version",
        });
      } finally {
        await restoreCurrentVersionId(prisma, previousCurrentId);
      }
    });

    it("blocks deletion while any verification stamp references the version", async () => {
      const prisma = await getVerifiedTestPrisma();

      const version = await prisma.gameVersion.create({
        data: { name: `${N}delete-referenced` },
      });
      const item = await prisma.item.create({
        data: {
          name: "Test GameVersion Referencing Item",
          slug: `${P}referencing-item`,
          verifiedAt: new Date(),
          verifiedGameVersionId: version.id,
        },
      });

      // The service refuses with the reference count...
      const blocked = await deleteGameVersion(prisma, version.id);
      expect(blocked).toEqual({
        ok: false,
        error: "referenced",
        referenceCount: 1,
      });

      // ...and the database's own ON DELETE RESTRICT backs it up even when
      // the service pre-check is bypassed entirely.
      let caught: unknown = null;
      try {
        await prisma.gameVersion.delete({ where: { id: version.id } });
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
      expect(isForeignKeyError(caught)).toBe(true);

      // The version survives, still referenced.
      expect(
        await prisma.gameVersion.findUnique({ where: { id: version.id } })
      ).not.toBeNull();

      // Once the referencing row is gone, deletion succeeds.
      await prisma.item.delete({ where: { id: item.id } });
      expect(await deleteGameVersion(prisma, version.id)).toEqual({ ok: true });
    });
  });
});
