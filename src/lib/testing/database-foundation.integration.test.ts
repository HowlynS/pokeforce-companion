// Foundation integration tests against the REAL isolated Supabase test
// database. Every database access goes through getVerifiedTestPrisma(), so
// the fail-closed environment guard runs before the Prisma client is
// created. All rows written here use the approved slug prefix and are
// removed again by prefix-scoped cleanup — seeded fixtures are read but
// never modified.
//
// Only vitest.integration.config.ts collects this file; the unit config
// excludes **/*.integration.test.ts, so `pnpm test:unit` never loads it.

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import {
  isMissingRecordError,
  isUniqueConstraintError,
} from "@/lib/prisma-errors";
import {
  INTEGRATION_TEST_SLUG_PREFIX,
  deleteIntegrationTestCategories,
  disconnectTestPrisma,
  getVerifiedTestPrisma,
} from "./integration-database";

// Deterministic fixtures from prisma/seed.ts. Slugs are stable; cuid IDs
// are generated per database and must never be hard-coded.
const SEEDED_COUNTS = {
  categories: 5,
  professions: 10,
  items: 16,
  recipes: 8,
  recipeIngredients: 15,
} as const;

const SEEDED_CATEGORY_SLUGS = [
  "materials",
  "components",
  "consumables",
  "tools",
  "gear",
] as const;

const SEEDED_ITEM_SLUG = "iron-ore";
const SEEDED_RECIPE_SLUG = "iron-ingot";

// Slice 8B: the full deterministic profession set. "Blacksmithing" was
// renamed to "Smithing" in place by migration 20260716152420 — the row
// keeps its original id and every Recipe.professionId relation that
// pointed at it, so it is never re-listed under its old slug.
const SEEDED_PROFESSION_SLUGS = [
  "alchemy",
  "archaeology",
  "construction",
  "cooking",
  "crafting",
  "farming",
  "fishing",
  "foraging",
  "mining",
  "smithing",
] as const;

// The five Recipes assigned to Smithing since prisma/seed.ts was first
// written (as "Blacksmithing"); the rename must never have detached them.
const SMITHING_RECIPE_SLUGS = [
  "copper-dagger",
  "copper-ingot",
  "iron-ingot",
  "iron-sword",
  "reinforced-shield",
] as const;

// Test-created rows. All slugs carry the approved prefix so prefix-scoped
// cleanup always catches them, even after an interrupted run.
const CYCLE_SLUG = `${INTEGRATION_TEST_SLUG_PREFIX}category`;
const NO_DESCRIPTION_SLUG = `${INTEGRATION_TEST_SLUG_PREFIX}category-no-description`;
const DUPLICATE_SLUG = `${INTEGRATION_TEST_SLUG_PREFIX}duplicate-slug`;

describe("database foundation (integration)", () => {
  beforeAll(async () => {
    // First database contact of the run: the guard inside
    // getVerifiedTestPrisma() throws here if the environment is not the
    // verified test project. Also removes any prefix-scoped leftovers an
    // interrupted earlier run may have stranded.
    await deleteIntegrationTestCategories();
  });

  // Backstop cleanup after every test: even a failing write test cannot
  // leave a prefixed row behind. Only prefix-scoped rows are deleted.
  afterEach(async () => {
    await deleteIntegrationTestCategories();
  });

  afterAll(async () => {
    const remaining = await deleteIntegrationTestCategories();
    await disconnectTestPrisma();
    // Fail loudly if cleanup was still needed at the very end — afterEach
    // should already have removed everything.
    expect(remaining).toBe(0);
  });

  describe("seeded fixture smoke checks", () => {
    it(`holds exactly ${SEEDED_COUNTS.categories} seeded categories`, async () => {
      const prisma = await getVerifiedTestPrisma();
      expect(await prisma.category.count()).toBe(SEEDED_COUNTS.categories);
    });

    it(`holds exactly ${SEEDED_COUNTS.professions} seeded professions`, async () => {
      const prisma = await getVerifiedTestPrisma();
      expect(await prisma.profession.count()).toBe(SEEDED_COUNTS.professions);
    });

    it(`holds exactly ${SEEDED_COUNTS.items} seeded items`, async () => {
      const prisma = await getVerifiedTestPrisma();
      expect(await prisma.item.count()).toBe(SEEDED_COUNTS.items);
    });

    it(`holds exactly ${SEEDED_COUNTS.recipes} seeded recipes`, async () => {
      const prisma = await getVerifiedTestPrisma();
      expect(await prisma.recipe.count()).toBe(SEEDED_COUNTS.recipes);
    });

    it(`holds exactly ${SEEDED_COUNTS.recipeIngredients} seeded recipe ingredients`, async () => {
      const prisma = await getVerifiedTestPrisma();
      expect(await prisma.recipeIngredient.count()).toBe(
        SEEDED_COUNTS.recipeIngredients
      );
    });

    it("finds the seeded category by its stable slug", async () => {
      const prisma = await getVerifiedTestPrisma();
      const category = await prisma.category.findUnique({
        where: { slug: SEEDED_CATEGORY_SLUGS[0] },
      });
      expect(category).not.toBeNull();
      expect(category?.name).toBe("Materials");
    });

    it("finds the seeded item by its stable slug", async () => {
      const prisma = await getVerifiedTestPrisma();
      const item = await prisma.item.findUnique({
        where: { slug: SEEDED_ITEM_SLUG },
      });
      expect(item).not.toBeNull();
      expect(item?.name).toBe("Iron Ore");
    });

    it("holds exactly the ten deterministic professions, by slug", async () => {
      const prisma = await getVerifiedTestPrisma();
      const professions = await prisma.profession.findMany({
        select: { slug: true },
        orderBy: { slug: "asc" },
      });
      expect(professions.map((profession) => profession.slug)).toEqual([
        ...SEEDED_PROFESSION_SLUGS,
      ]);
    });

    it("no longer has a profession under the retired 'blacksmithing' slug", async () => {
      const prisma = await getVerifiedTestPrisma();
      const blacksmithing = await prisma.profession.findUnique({
        where: { slug: "blacksmithing" },
      });
      expect(blacksmithing).toBeNull();
    });

    it("keeps every formerly-Blacksmithing recipe linked to the renamed Smithing profession", async () => {
      const prisma = await getVerifiedTestPrisma();
      const smithing = await prisma.profession.findUnique({
        where: { slug: "smithing" },
        include: { recipes: { select: { slug: true } } },
      });

      expect(smithing).not.toBeNull();
      expect(smithing?.name).toBe("Smithing");
      expect(
        (smithing?.recipes ?? []).map((recipe) => recipe.slug).sort()
      ).toEqual([...SMITHING_RECIPE_SLUGS]);
    });

    it("finds the seeded recipe by its stable slug", async () => {
      const prisma = await getVerifiedTestPrisma();
      const recipe = await prisma.recipe.findUnique({
        where: { slug: SEEDED_RECIPE_SLUG },
      });
      expect(recipe).not.toBeNull();
      expect(recipe?.name).toBe("Iron Ingot");
    });
  });

  describe("category create/read/delete cycle", () => {
    it("creates, reads back, and deletes a category with a description", async () => {
      const prisma = await getVerifiedTestPrisma();
      try {
        // No stale row may exist — beforeAll/afterEach cleanup ran.
        expect(
          await prisma.category.findUnique({ where: { slug: CYCLE_SLUG } })
        ).toBeNull();

        await prisma.category.create({
          data: {
            name: "Integration Test Category",
            slug: CYCLE_SLUG,
            description: "Temporary row created by an integration test.",
          },
        });

        const readBack = await prisma.category.findUnique({
          where: { slug: CYCLE_SLUG },
        });
        expect(readBack).not.toBeNull();
        expect(readBack?.name).toBe("Integration Test Category");
        expect(readBack?.slug).toBe(CYCLE_SLUG);
        expect(readBack?.description).toBe(
          "Temporary row created by an integration test."
        );

        await prisma.category.delete({ where: { slug: CYCLE_SLUG } });

        expect(
          await prisma.category.findUnique({ where: { slug: CYCLE_SLUG } })
        ).toBeNull();
      } finally {
        // Prefix-scoped: removes this test's row even if an expectation
        // above failed mid-cycle.
        await deleteIntegrationTestCategories();
      }
    });

    it("stores a missing optional description as null", async () => {
      const prisma = await getVerifiedTestPrisma();
      try {
        await prisma.category.create({
          data: {
            name: "Integration Test Category Without Description",
            slug: NO_DESCRIPTION_SLUG,
          },
        });

        const readBack = await prisma.category.findUnique({
          where: { slug: NO_DESCRIPTION_SLUG },
        });
        expect(readBack).not.toBeNull();
        expect(readBack?.description).toBeNull();
      } finally {
        await deleteIntegrationTestCategories();
      }
    });
  });

  describe("real unique constraint on Category.slug", () => {
    it("rejects a duplicate slug with a genuine P2002 error", async () => {
      const prisma = await getVerifiedTestPrisma();
      try {
        await prisma.category.create({
          data: { name: "Integration Test Category", slug: DUPLICATE_SLUG },
        });

        let caught: unknown = null;
        try {
          await prisma.category.create({
            data: {
              name: "Integration Test Category Duplicate",
              slug: DUPLICATE_SLUG,
            },
          });
        } catch (error) {
          caught = error;
        }

        // The real database raised the error — not a mock, not a forged
        // structural lookalike.
        expect(caught).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
        expect(
          (caught as Prisma.PrismaClientKnownRequestError).code
        ).toBe("P2002");
        expect(isUniqueConstraintError(caught)).toBe(true);
        expect(isMissingRecordError(caught)).toBe(false);
      } finally {
        await deleteIntegrationTestCategories();
      }
    });
  });

  describe("seed preservation after write tests", () => {
    it("keeps all seeded fixture counts unchanged", async () => {
      const prisma = await getVerifiedTestPrisma();
      expect(await prisma.category.count()).toBe(SEEDED_COUNTS.categories);
      expect(await prisma.profession.count()).toBe(SEEDED_COUNTS.professions);
      expect(await prisma.item.count()).toBe(SEEDED_COUNTS.items);
      expect(await prisma.recipe.count()).toBe(SEEDED_COUNTS.recipes);
      expect(await prisma.recipeIngredient.count()).toBe(
        SEEDED_COUNTS.recipeIngredients
      );
    });

    it("keeps every seeded category slug present", async () => {
      const prisma = await getVerifiedTestPrisma();
      for (const slug of SEEDED_CATEGORY_SLUGS) {
        const category = await prisma.category.findUnique({
          where: { slug },
        });
        expect(category, `seeded category "${slug}" must exist`).not.toBeNull();
      }
    });

    it("leaves no test-prefixed category behind", async () => {
      const prisma = await getVerifiedTestPrisma();
      const leftover = await prisma.category.count({
        where: { slug: { startsWith: INTEGRATION_TEST_SLUG_PREFIX } },
      });
      expect(leftover).toBe(0);
    });
  });
});
