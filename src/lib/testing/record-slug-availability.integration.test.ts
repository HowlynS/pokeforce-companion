// Guarded integration tests for the shared Item/Recipe/Profession/
// Category/Location Page-address (slug) availability helpers against the
// REAL isolated Supabase test database (Phase B1, System B) — a brand-new
// feature, so unlike record-name-availability.integration.test.ts there is
// no split-by-legacy-precedent between Item and the other four resources;
// all five live in one table-driven suite. Item/Recipe/Profession/Category
// checks are entirely READ-ONLY against the deterministic seed from
// prisma/seed.ts; Location has no seeded fixture at all, so its own rows
// are created and torn down here via the existing guard-first
// deleteLocationsTestRecords/LOCATIONS_TEST_SLUG_PREFIX helpers, exactly
// like location.integration.test.ts's own established pattern.
//
// Only vitest.integration.config.ts collects this file; the unit config
// excludes **/*.integration.test.ts, so `pnpm test:unit` never loads it.

import { afterAll, afterEach, describe, expect, it } from "vitest";
import {
  isCategorySlugTaken,
  isItemSlugTaken,
  isLocationSlugTaken,
  isProfessionSlugTaken,
  isRecipeSlugTaken,
} from "@/lib/admin/record-slug";
import {
  LOCATIONS_TEST_SLUG_PREFIX,
  deleteLocationsTestRecords,
  disconnectTestPrisma,
  getVerifiedTestPrisma,
} from "./integration-database";

type GameDataClient = Awaited<ReturnType<typeof getVerifiedTestPrisma>>;

// One row per seeded resource: its helper, a stable seeded slug, and a
// DIFFERENT seeded record's slug for the edit-conflict case. cuid IDs are
// looked up per run, never hard-coded.
const SEEDED_RESOURCES = [
  {
    label: "Category",
    isTaken: isCategorySlugTaken,
    seededSlug: "materials",
    otherSeededSlug: "tools",
    findId: async (db: GameDataClient, slug: string) =>
      db.category.findUnique({ where: { slug }, select: { id: true } }),
  },
  {
    label: "Profession",
    isTaken: isProfessionSlugTaken,
    seededSlug: "smithing",
    otherSeededSlug: "alchemy",
    findId: async (db: GameDataClient, slug: string) =>
      db.profession.findUnique({ where: { slug }, select: { id: true } }),
  },
  {
    label: "Recipe",
    isTaken: isRecipeSlugTaken,
    seededSlug: "iron-sword",
    otherSeededSlug: "charcoal",
    findId: async (db: GameDataClient, slug: string) =>
      db.recipe.findUnique({ where: { slug }, select: { id: true } }),
  },
  {
    label: "Item",
    isTaken: isItemSlugTaken,
    seededSlug: "iron-ore",
    otherSeededSlug: "copper-ore",
    findId: async (db: GameDataClient, slug: string) =>
      db.item.findUnique({ where: { slug }, select: { id: true } }),
  },
] as const;

describe("record slug availability (integration)", () => {
  afterAll(async () => {
    await deleteLocationsTestRecords();
    await disconnectTestPrisma();
  });

  describe.each(SEEDED_RESOURCES)(
    "$label (read-only against seeded data)",
    (resource) => {
      it("reports the exact seeded slug as taken", async () => {
        const prisma = await getVerifiedTestPrisma();
        expect(await resource.isTaken(prisma, resource.seededSlug)).toBe(true);
      });

      it("reports a casing/whitespace variant as taken (normalized before checking)", async () => {
        const prisma = await getVerifiedTestPrisma();
        expect(
          await resource.isTaken(prisma, resource.seededSlug.toUpperCase())
        ).toBe(true);
        expect(
          await resource.isTaken(prisma, `  ${resource.seededSlug}  `)
        ).toBe(true);
      });

      it("reports an unused slug as available, and blank as never taken", async () => {
        const prisma = await getVerifiedTestPrisma();
        expect(
          await resource.isTaken(prisma, "test-integration-unused-slug")
        ).toBe(false);
        expect(await resource.isTaken(prisma, "")).toBe(false);
        expect(await resource.isTaken(prisma, "   ")).toBe(false);
      });

      it("excludes the current record during editing so its own slug is never taken", async () => {
        const prisma = await getVerifiedTestPrisma();
        const record = await resource.findId(prisma, resource.seededSlug);
        expect(record).not.toBeNull();

        expect(
          await resource.isTaken(prisma, resource.seededSlug, record!.id)
        ).toBe(false);
      });

      it("still reports a DIFFERENT record's slug as taken during editing", async () => {
        const prisma = await getVerifiedTestPrisma();
        const record = await resource.findId(prisma, resource.seededSlug);
        expect(record).not.toBeNull();

        expect(
          await resource.isTaken(prisma, resource.otherSeededSlug, record!.id)
        ).toBe(true);
      });
    }
  );

  describe("Location (no seeded fixture — created and torn down here)", () => {
    afterEach(async () => {
      await deleteLocationsTestRecords();
    });

    it("reports an existing Location's slug as taken, an unused one as available, and excludes the current record while editing", async () => {
      const prisma = await getVerifiedTestPrisma();
      const slugA = `${LOCATIONS_TEST_SLUG_PREFIX}a`;
      const slugB = `${LOCATIONS_TEST_SLUG_PREFIX}b`;

      const locationA = await prisma.location.create({
        data: { name: "Test Integration Location Slug A", slug: slugA, type: "REGION" },
      });
      await prisma.location.create({
        data: { name: "Test Integration Location Slug B", slug: slugB, type: "TOWN" },
      });

      expect(await isLocationSlugTaken(prisma, slugA)).toBe(true);
      expect(
        await isLocationSlugTaken(prisma, "test-integration-unused-location-slug")
      ).toBe(false);
      expect(await isLocationSlugTaken(prisma, "")).toBe(false);

      // Excludes itself...
      expect(await isLocationSlugTaken(prisma, slugA, locationA.id)).toBe(false);
      // ...but still reports a different Location's slug as taken.
      expect(await isLocationSlugTaken(prisma, slugB, locationA.id)).toBe(true);
    });
  });
});
