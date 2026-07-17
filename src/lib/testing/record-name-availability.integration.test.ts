// Guarded integration tests for the shared Category/Profession/Recipe
// duplicate-name helpers against the REAL isolated Supabase test database.
// Entirely READ-ONLY: every check runs against the deterministic seed from
// prisma/seed.ts — nothing is created, updated, or deleted, so no cleanup
// hooks are needed. The Prisma client is obtained through
// getVerifiedTestPrisma(), so the fail-closed environment guard runs before
// any connection exists; the helper module itself never creates a client
// (its Prisma reference is type-level only).
//
// Only vitest.integration.config.ts collects this file; the unit config
// excludes **/*.integration.test.ts, so `pnpm test:unit` never loads it.

import { afterAll, describe, expect, it } from "vitest";
import {
  isCategoryNameTaken,
  isProfessionNameTaken,
  isRecipeNameTaken,
} from "@/lib/admin/record-name";
import {
  disconnectTestPrisma,
  getVerifiedTestPrisma,
} from "./integration-database";

type GameDataClient = Awaited<ReturnType<typeof getVerifiedTestPrisma>>;

// One row per resource: its helper, a stable seeded record (slug + exact
// name), and a DIFFERENT seeded record's name for the edit-conflict case.
// cuid IDs are looked up per run, never hard-coded.
const RESOURCES = [
  {
    label: "Category",
    isTaken: isCategoryNameTaken,
    seededSlug: "materials",
    seededName: "Materials",
    otherSeededName: "Tools",
    findId: async (db: GameDataClient, slug: string) =>
      db.category.findUnique({ where: { slug }, select: { id: true } }),
  },
  {
    label: "Profession",
    isTaken: isProfessionNameTaken,
    seededSlug: "smithing",
    seededName: "Smithing",
    otherSeededName: "Alchemy",
    findId: async (db: GameDataClient, slug: string) =>
      db.profession.findUnique({ where: { slug }, select: { id: true } }),
  },
  {
    label: "Recipe",
    isTaken: isRecipeNameTaken,
    seededSlug: "iron-sword",
    seededName: "Iron Sword",
    otherSeededName: "Charcoal",
    findId: async (db: GameDataClient, slug: string) =>
      db.recipe.findUnique({ where: { slug }, select: { id: true } }),
  },
] as const;

describe("record name availability (integration, read-only)", () => {
  afterAll(async () => {
    await disconnectTestPrisma();
  });

  for (const resource of RESOURCES) {
    describe(resource.label, () => {
      it("reports the exact seeded name as taken", async () => {
        const prisma = await getVerifiedTestPrisma();
        expect(await resource.isTaken(prisma, resource.seededName)).toBe(true);
      });

      it("reports casing variants as taken", async () => {
        const prisma = await getVerifiedTestPrisma();
        expect(
          await resource.isTaken(prisma, resource.seededName.toUpperCase())
        ).toBe(true);
        expect(
          await resource.isTaken(prisma, resource.seededName.toLowerCase())
        ).toBe(true);
      });

      it("reports a surrounding-whitespace variant as taken", async () => {
        const prisma = await getVerifiedTestPrisma();
        expect(
          await resource.isTaken(prisma, `  ${resource.seededName}  `)
        ).toBe(true);
      });

      it("reports an unused name as available and blank as never taken", async () => {
        const prisma = await getVerifiedTestPrisma();
        expect(
          await resource.isTaken(prisma, "Test Integration Unused Record Name")
        ).toBe(false);
        expect(await resource.isTaken(prisma, "")).toBe(false);
        expect(await resource.isTaken(prisma, "   ")).toBe(false);
      });

      it("excludes the current record during editing so it cannot conflict with itself", async () => {
        const prisma = await getVerifiedTestPrisma();
        const record = await resource.findId(prisma, resource.seededSlug);
        expect(record).not.toBeNull();

        expect(
          await resource.isTaken(prisma, resource.seededName, record!.id)
        ).toBe(false);
        // Casing/whitespace variants of the own name are excluded the same
        // way.
        expect(
          await resource.isTaken(
            prisma,
            `  ${resource.seededName.toUpperCase()} `,
            record!.id
          )
        ).toBe(false);
      });

      it("still reports a DIFFERENT record's name as taken during editing", async () => {
        const prisma = await getVerifiedTestPrisma();
        const record = await resource.findId(prisma, resource.seededSlug);
        expect(record).not.toBeNull();

        expect(
          await resource.isTaken(prisma, resource.otherSeededName, record!.id)
        ).toBe(true);
      });
    });
  }
});
