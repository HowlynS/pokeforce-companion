// Relation, cascade, missing-record, and transaction tests against the REAL
// isolated Supabase test database.
//
// Actual schema behavior, confirmed in the applied migration SQL:
//   Item.categoryId      -> Category    ON DELETE SET NULL  (app pre-check blocks)
//   Recipe.professionId  -> Profession  ON DELETE SET NULL  (app pre-check blocks)
//   Recipe.resultingItemId -> Item      ON DELETE RESTRICT  (real P2003)
//   RecipeIngredient.itemId -> Item     ON DELETE RESTRICT  (real P2003)
//   RecipeIngredient.recipeId -> Recipe ON DELETE CASCADE
//
// Category and Profession deletions are therefore blocked by the admin
// actions' _count pre-checks (the database would silently SET NULL, which
// the application rule forbids), so those groups test the app's real
// blocker query and safe workflow. Item deletions are blocked by the
// database itself, so those groups assert genuine P2003 errors.
//
// Every row created here uses the test-relations- slug prefix and is
// removed by the shared prefix-scoped, foreign-key-safe cleanup. Seeded
// fixtures are read but never modified.

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import {
  isForeignKeyError,
  isMissingRecordError,
  isUniqueConstraintError,
} from "@/lib/prisma-errors";
import {
  GAME_VERSION_TEST_NAME_PREFIX,
  INTEGRATION_TEST_SLUG_PREFIX,
  RELATIONS_TEST_SLUG_PREFIX,
  deleteGameVersionTestRecords,
  deleteRelationsTestRecords,
  disconnectTestPrisma,
  getVerifiedTestPrisma,
} from "./integration-database";

// Deterministic fixtures from prisma/seed.ts (verified by the foundation
// suite; re-checked here after write-heavy tests).
const SEEDED_COUNTS = {
  categories: 5,
  professions: 10,
  items: 16,
  recipes: 8,
  recipeIngredients: 15,
} as const;

// A syntactically valid String id that is never created anywhere, so
// operations targeting it deterministically hit the missing-record path.
// (Real ids are generated cuids and must never be hard-coded.)
const NONEXISTENT_ID = `${RELATIONS_TEST_SLUG_PREFIX}nonexistent-id`;

const P = RELATIONS_TEST_SLUG_PREFIX;

describe("database relations (integration)", () => {
  beforeAll(async () => {
    // First database contact of the run: the guard inside
    // getVerifiedTestPrisma() throws here if the environment is not the
    // verified test project. Also removes any prefix-scoped leftovers an
    // interrupted earlier run may have stranded.
    await deleteRelationsTestRecords();
  });

  // Backstop cleanup after every test: even a failing write test cannot
  // leave a prefixed row behind. Only prefix-scoped rows are deleted, in
  // foreign-key-safe order; rows go before test GameVersions because every
  // verifiedGameVersionId relation is ON DELETE RESTRICT.
  afterEach(async () => {
    await deleteRelationsTestRecords();
    await deleteGameVersionTestRecords();
  });

  afterAll(async () => {
    const remaining =
      (await deleteRelationsTestRecords()) +
      (await deleteGameVersionTestRecords());
    await disconnectTestPrisma();
    // Fail loudly if cleanup was still needed at the very end — afterEach
    // should already have removed everything.
    expect(remaining).toBe(0);
  });

  describe("missing-record behavior (P2025)", () => {
    it("rejects an update by a nonexistent id with a genuine P2025 error", async () => {
      const prisma = await getVerifiedTestPrisma();

      let caught: unknown = null;
      try {
        await prisma.category.update({
          where: { id: NONEXISTENT_ID },
          data: { name: "Relations Test Never Applied" },
        });
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
      expect((caught as Prisma.PrismaClientKnownRequestError).code).toBe(
        "P2025"
      );
      expect(isMissingRecordError(caught)).toBe(true);
      expect(isUniqueConstraintError(caught)).toBe(false);
      expect(isForeignKeyError(caught)).toBe(false);
    });

    it("rejects a delete by a nonexistent id with a genuine P2025 error", async () => {
      const prisma = await getVerifiedTestPrisma();

      let caught: unknown = null;
      try {
        await prisma.category.delete({ where: { id: NONEXISTENT_ID } });
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
      expect((caught as Prisma.PrismaClientKnownRequestError).code).toBe(
        "P2025"
      );
      expect(isMissingRecordError(caught)).toBe(true);
    });
  });

  describe("item gameplay fields (Slice 8A shape)", () => {
    it("defaults heldItem to false and leaves verification fields NULL on create", async () => {
      const prisma = await getVerifiedTestPrisma();

      const item = await prisma.item.create({
        data: { name: "Relations Test Plain Item", slug: `${P}plain-item` },
      });

      expect(item.heldItem).toBe(false);
      expect(item.verifiedAt).toBeNull();
      expect(item.verifiedGameVersionId).toBeNull();
    });

    it("stores explicit heldItem values on create and update", async () => {
      const prisma = await getVerifiedTestPrisma();

      const item = await prisma.item.create({
        data: {
          name: "Relations Test Held Item",
          slug: `${P}held-item`,
          heldItem: true,
        },
      });
      expect(item.heldItem).toBe(true);

      const updated = await prisma.item.update({
        where: { id: item.id },
        data: { heldItem: false },
      });
      expect(updated.heldItem).toBe(false);
    });

    it("preserves verification metadata through a normal edit and advances updatedAt", async () => {
      const prisma = await getVerifiedTestPrisma();

      const created = await prisma.item.create({
        data: { name: "Relations Test Verified Item", slug: `${P}verified-item` },
      });

      // The exact write shape updateItemAction uses when the opt-in
      // checkbox is checked: the timestamp plus a RELATIONAL Game Version
      // reference, stamped together.
      const version = await prisma.gameVersion.create({
        data: { name: `${GAME_VERSION_TEST_NAME_PREFIX}relations-001` },
      });
      const stampedAt = new Date();
      const stamped = await prisma.item.update({
        where: { id: created.id },
        data: { verifiedAt: stampedAt, verifiedGameVersionId: version.id },
      });
      expect(stamped.verifiedAt?.getTime()).toBe(stampedAt.getTime());
      expect(stamped.verifiedGameVersionId).toBe(version.id);

      // The exact write shape of a NORMAL edit: verification fields are
      // omitted entirely, so Prisma must leave them untouched while the
      // automatic updatedAt still advances.
      const edited = await prisma.item.update({
        where: { id: created.id },
        data: { name: "Relations Test Verified Item Renamed" },
      });
      expect(edited.verifiedAt?.getTime()).toBe(stampedAt.getTime());
      expect(edited.verifiedGameVersionId).toBe(version.id);
      expect(edited.updatedAt.getTime()).toBeGreaterThan(
        stamped.updatedAt.getTime()
      );
    });
  });

  describe("category relation blocker (application pre-check)", () => {
    it("blocks deletion via the linked-items count until the item is removed", async () => {
      const prisma = await getVerifiedTestPrisma();

      const category = await prisma.category.create({
        data: { name: "Relations Test Category", slug: `${P}category` },
      });
      const item = await prisma.item.create({
        data: {
          name: "Relations Test Linked Item",
          slug: `${P}linked-item`,
          categoryId: category.id,
        },
      });

      // The exact relation query deleteCategoryAction runs immediately
      // before deleting. Scoped to the temporary category's id, so seeded
      // records are not involved.
      const blocked = await prisma.category.findUnique({
        where: { id: category.id },
        include: { _count: { select: { items: true } } },
      });
      expect(blocked?._count.items).toBe(1);
      // With a nonzero count the action redirects with error=linked_items
      // and never reaches prisma.category.delete — the database itself
      // would SET NULL, which the application rule forbids.

      // The safe workflow: remove (here: delete) the linked item first.
      await prisma.item.delete({ where: { id: item.id } });

      const unblocked = await prisma.category.findUnique({
        where: { id: category.id },
        include: { _count: { select: { items: true } } },
      });
      expect(unblocked?._count.items).toBe(0);

      await prisma.category.delete({ where: { id: category.id } });
      expect(
        await prisma.category.findUnique({ where: { id: category.id } })
      ).toBeNull();
    });
  });

  describe("profession relation blocker (application pre-check)", () => {
    it("blocks deletion via the linked-recipes count until the recipe is detached", async () => {
      const prisma = await getVerifiedTestPrisma();

      const profession = await prisma.profession.create({
        data: { name: "Relations Test Profession", slug: `${P}profession` },
      });
      const resultItem = await prisma.item.create({
        data: { name: "Relations Test Result Item", slug: `${P}result-item` },
      });
      const recipe = await prisma.recipe.create({
        data: {
          name: "Relations Test Recipe",
          slug: `${P}recipe`,
          resultingItemId: resultItem.id,
          professionId: profession.id,
        },
      });

      // The exact relation query deleteProfessionAction runs immediately
      // before deleting.
      const blocked = await prisma.profession.findUnique({
        where: { id: profession.id },
        include: { _count: { select: { recipes: true } } },
      });
      expect(blocked?._count.recipes).toBe(1);
      // With a nonzero count the action redirects with error=linked_recipes
      // and never reaches prisma.profession.delete.

      // The safe workflow: detach the recipe first (the relation is
      // nullable by schema), then delete the profession.
      await prisma.recipe.update({
        where: { id: recipe.id },
        data: { professionId: null },
      });

      const unblocked = await prisma.profession.findUnique({
        where: { id: profession.id },
        include: { _count: { select: { recipes: true } } },
      });
      expect(unblocked?._count.recipes).toBe(0);

      await prisma.profession.delete({ where: { id: profession.id } });
      expect(
        await prisma.profession.findUnique({ where: { id: profession.id } })
      ).toBeNull();
    });
  });

  describe("item relation blockers (database RESTRICT)", () => {
    it("rejects deleting an item used as a recipe result with a genuine P2003", async () => {
      const prisma = await getVerifiedTestPrisma();

      const resultItem = await prisma.item.create({
        data: { name: "Relations Test Result Blocker", slug: `${P}result-blocker` },
      });
      const recipe = await prisma.recipe.create({
        data: {
          name: "Relations Test Result Blocker Recipe",
          slug: `${P}result-blocker-recipe`,
          resultingItemId: resultItem.id,
        },
      });

      let caught: unknown = null;
      try {
        await prisma.item.delete({ where: { id: resultItem.id } });
      } catch (error) {
        caught = error;
      }

      // Recipe.resultingItemId is ON DELETE RESTRICT — the database itself
      // raises the foreign-key violation the items action classifies.
      expect(caught).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
      expect((caught as Prisma.PrismaClientKnownRequestError).code).toBe(
        "P2003"
      );
      expect(isForeignKeyError(caught)).toBe(true);
      expect(isMissingRecordError(caught)).toBe(false);
      expect(isUniqueConstraintError(caught)).toBe(false);

      // Once the referencing recipe is gone, the deletion succeeds.
      await prisma.recipe.delete({ where: { id: recipe.id } });
      await prisma.item.delete({ where: { id: resultItem.id } });
      expect(
        await prisma.item.findUnique({ where: { id: resultItem.id } })
      ).toBeNull();
    });

    it("rejects deleting an item used as an ingredient with a genuine P2003", async () => {
      const prisma = await getVerifiedTestPrisma();

      const resultItem = await prisma.item.create({
        data: { name: "Relations Test Ingredient Result", slug: `${P}ingredient-result` },
      });
      const ingredientItem = await prisma.item.create({
        data: { name: "Relations Test Ingredient", slug: `${P}ingredient` },
      });
      // Nested create, mirroring createRecipeAction's atomic insert.
      const recipe = await prisma.recipe.create({
        data: {
          name: "Relations Test Ingredient Recipe",
          slug: `${P}ingredient-recipe`,
          resultingItemId: resultItem.id,
          ingredients: {
            create: [{ itemId: ingredientItem.id, quantity: 1 }],
          },
        },
      });

      let caught: unknown = null;
      try {
        await prisma.item.delete({ where: { id: ingredientItem.id } });
      } catch (error) {
        caught = error;
      }

      // RecipeIngredient.itemId is also ON DELETE RESTRICT.
      expect(caught).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
      expect((caught as Prisma.PrismaClientKnownRequestError).code).toBe(
        "P2003"
      );
      expect(isForeignKeyError(caught)).toBe(true);

      // Deleting the recipe cascades its ingredient rows away, unblocking
      // the item.
      await prisma.recipe.delete({ where: { id: recipe.id } });
      await prisma.item.delete({ where: { id: ingredientItem.id } });
      expect(
        await prisma.item.findUnique({ where: { id: ingredientItem.id } })
      ).toBeNull();
    });
  });

  describe("recipe ingredient cascade", () => {
    it("deletes ingredient rows automatically when their recipe is deleted", async () => {
      const prisma = await getVerifiedTestPrisma();

      const resultItem = await prisma.item.create({
        data: { name: "Relations Test Cascade Result", slug: `${P}cascade-result` },
      });
      const ingredientItem = await prisma.item.create({
        data: { name: "Relations Test Cascade Ingredient", slug: `${P}cascade-ingredient` },
      });
      const recipe = await prisma.recipe.create({
        data: {
          name: "Relations Test Cascade Recipe",
          slug: `${P}cascade-recipe`,
          resultingItemId: resultItem.id,
          ingredients: {
            create: [{ itemId: ingredientItem.id, quantity: 2 }],
          },
        },
      });

      expect(
        await prisma.recipeIngredient.count({ where: { recipeId: recipe.id } })
      ).toBe(1);

      // Deleted directly through Prisma, exactly like deleteRecipeAction.
      await prisma.recipe.delete({ where: { id: recipe.id } });

      // The schema's onDelete: Cascade removed the ingredient rows; the
      // items themselves are untouched.
      expect(
        await prisma.recipeIngredient.count({ where: { recipeId: recipe.id } })
      ).toBe(0);
      expect(
        await prisma.item.findUnique({ where: { id: resultItem.id } })
      ).not.toBeNull();
      expect(
        await prisma.item.findUnique({ where: { id: ingredientItem.id } })
      ).not.toBeNull();
    });
  });

  describe("recipe transaction atomicity", () => {
    it("updates the recipe and replaces its ingredient set in one transaction", async () => {
      const prisma = await getVerifiedTestPrisma();

      const resultItem = await prisma.item.create({
        data: { name: "Relations Test Txn Result", slug: `${P}txn-result` },
      });
      const oldIngredient = await prisma.item.create({
        data: { name: "Relations Test Txn Old Ingredient", slug: `${P}txn-old-ingredient` },
      });
      const newIngredient = await prisma.item.create({
        data: { name: "Relations Test Txn New Ingredient", slug: `${P}txn-new-ingredient` },
      });
      const recipe = await prisma.recipe.create({
        data: {
          name: "Relations Test Txn Recipe",
          slug: `${P}txn-recipe`,
          resultingItemId: resultItem.id,
          ingredients: {
            create: [{ itemId: oldIngredient.id, quantity: 1 }],
          },
        },
      });

      // The exact update-delete-recreate transaction updateRecipeAction
      // performs.
      await prisma.$transaction([
        prisma.recipe.update({
          where: { id: recipe.id },
          data: {
            name: "Relations Test Txn Recipe Updated",
            requiredLevel: 5,
          },
        }),
        prisma.recipeIngredient.deleteMany({ where: { recipeId: recipe.id } }),
        prisma.recipeIngredient.createMany({
          data: [{ recipeId: recipe.id, itemId: newIngredient.id, quantity: 3 }],
        }),
      ]);

      const updated = await prisma.recipe.findUnique({
        where: { id: recipe.id },
        include: { ingredients: true },
      });
      expect(updated?.name).toBe("Relations Test Txn Recipe Updated");
      expect(updated?.requiredLevel).toBe(5);
      expect(updated?.ingredients).toHaveLength(1);
      expect(updated?.ingredients[0]?.itemId).toBe(newIngredient.id);
      expect(updated?.ingredients[0]?.quantity).toBe(3);
    });

    it("rolls back the update and ingredient deletion when the recreate step fails", async () => {
      const prisma = await getVerifiedTestPrisma();

      const resultItem = await prisma.item.create({
        data: { name: "Relations Test Rollback Result", slug: `${P}rollback-result` },
      });
      const originalIngredient = await prisma.item.create({
        data: { name: "Relations Test Rollback Original", slug: `${P}rollback-original` },
      });
      const replacementIngredient = await prisma.item.create({
        data: { name: "Relations Test Rollback Replacement", slug: `${P}rollback-replacement` },
      });
      const recipe = await prisma.recipe.create({
        data: {
          name: "Relations Test Rollback Recipe",
          slug: `${P}rollback-recipe`,
          requiredLevel: 1,
          resultingItemId: resultItem.id,
          ingredients: {
            create: [{ itemId: originalIngredient.id, quantity: 4 }],
          },
        },
      });

      // Same transaction shape, but the createMany deliberately violates
      // the real @@unique([recipeId, itemId]) constraint by inserting the
      // same ingredient item twice — a deterministic, schema-backed
      // database failure, not a mock.
      let caught: unknown = null;
      try {
        await prisma.$transaction([
          prisma.recipe.update({
            where: { id: recipe.id },
            data: { name: "Relations Test Rollback NEVER APPLIED", requiredLevel: 99 },
          }),
          prisma.recipeIngredient.deleteMany({
            where: { recipeId: recipe.id },
          }),
          prisma.recipeIngredient.createMany({
            data: [
              { recipeId: recipe.id, itemId: replacementIngredient.id, quantity: 1 },
              { recipeId: recipe.id, itemId: replacementIngredient.id, quantity: 2 },
            ],
          }),
        ]);
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
      expect((caught as Prisma.PrismaClientKnownRequestError).code).toBe(
        "P2002"
      );
      expect(isUniqueConstraintError(caught)).toBe(true);

      // Every step rolled back: the recipe fields are untouched and the
      // original ingredient row survived the deleteMany.
      const preserved = await prisma.recipe.findUnique({
        where: { id: recipe.id },
        include: { ingredients: true },
      });
      expect(preserved?.name).toBe("Relations Test Rollback Recipe");
      expect(preserved?.requiredLevel).toBe(1);
      expect(preserved?.ingredients).toHaveLength(1);
      expect(preserved?.ingredients[0]?.itemId).toBe(originalIngredient.id);
      expect(preserved?.ingredients[0]?.quantity).toBe(4);
    });
  });

  describe("Item Used in Recipes relationship query (Slice 9B.7)", () => {
    it("loads ingredient usage with quantity, resulting item, profession, and required level", async () => {
      const prisma = await getVerifiedTestPrisma();

      const profession = await prisma.profession.create({
        data: {
          name: "Relations Test Recipes Tab Profession",
          slug: `${P}recipes-tab-profession`,
        },
      });
      const resultItem = await prisma.item.create({
        data: {
          name: "Relations Test Recipes Tab Result",
          slug: `${P}recipes-tab-result`,
        },
      });
      const ingredientItem = await prisma.item.create({
        data: {
          name: "Relations Test Recipes Tab Ingredient",
          slug: `${P}recipes-tab-ingredient`,
        },
      });
      const recipe = await prisma.recipe.create({
        data: {
          name: "Relations Test Recipes Tab Recipe",
          slug: `${P}recipes-tab-recipe`,
          resultingItemId: resultItem.id,
          professionId: profession.id,
          requiredLevel: 7,
          ingredients: { create: [{ itemId: ingredientItem.id, quantity: 3 }] },
        },
      });

      // The exact query shape the Used in Recipes tab page runs: one call,
      // both relationship directions, the fields each row needs already
      // included — no per-row follow-up query.
      const loaded = await prisma.item.findUnique({
        where: { id: ingredientItem.id },
        include: {
          recipesProduced: {
            include: { profession: true },
            orderBy: { name: "asc" },
          },
          recipeIngredients: {
            include: {
              recipe: { include: { profession: true, resultingItem: true } },
            },
            orderBy: { recipe: { name: "asc" } },
          },
        },
      });

      expect(loaded?.recipeIngredients).toHaveLength(1);
      const ingredient = loaded!.recipeIngredients[0]!;
      expect(ingredient.quantity).toBe(3);
      expect(ingredient.recipe.name).toBe(recipe.name);
      expect(ingredient.recipe.resultingItem.name).toBe(
        "Relations Test Recipes Tab Result"
      );
      expect(ingredient.recipe.profession?.name).toBe(
        "Relations Test Recipes Tab Profession"
      );
      expect(ingredient.recipe.requiredLevel).toBe(7);
      // This item is only an ingredient here, never a recipe's result.
      expect(loaded?.recipesProduced).toHaveLength(0);
    });

    it("handles absent profession and required level as null, never a query error", async () => {
      const prisma = await getVerifiedTestPrisma();

      const resultItem = await prisma.item.create({
        data: {
          name: "Relations Test Recipes Tab Sparse Result",
          slug: `${P}recipes-tab-sparse-result`,
        },
      });
      const ingredientItem = await prisma.item.create({
        data: {
          name: "Relations Test Recipes Tab Sparse Ingredient",
          slug: `${P}recipes-tab-sparse-ingredient`,
        },
      });
      await prisma.recipe.create({
        data: {
          name: "Relations Test Recipes Tab Sparse Recipe",
          slug: `${P}recipes-tab-sparse-recipe`,
          resultingItemId: resultItem.id,
          ingredients: { create: [{ itemId: ingredientItem.id, quantity: 1 }] },
        },
      });

      const loaded = await prisma.item.findUnique({
        where: { id: ingredientItem.id },
        include: {
          recipeIngredients: {
            include: {
              recipe: { include: { profession: true, resultingItem: true } },
            },
          },
        },
      });

      const ingredient = loaded!.recipeIngredients[0]!;
      expect(ingredient.recipe.profession).toBeNull();
      expect(ingredient.recipe.requiredLevel).toBeNull();
    });

    it("returns empty relationship arrays for an item used in no recipe", async () => {
      const prisma = await getVerifiedTestPrisma();

      const unused = await prisma.item.create({
        data: {
          name: "Relations Test Recipes Tab Unused",
          slug: `${P}recipes-tab-unused`,
        },
      });

      const loaded = await prisma.item.findUnique({
        where: { id: unused.id },
        include: { recipesProduced: true, recipeIngredients: true },
      });

      expect(loaded?.recipesProduced).toEqual([]);
      expect(loaded?.recipeIngredients).toEqual([]);
    });

    it("cannot produce duplicate ingredient rows for the same recipe/item pair (schema-enforced)", async () => {
      const prisma = await getVerifiedTestPrisma();

      const resultItem = await prisma.item.create({
        data: {
          name: "Relations Test Recipes Tab Dup Result",
          slug: `${P}recipes-tab-dup-result`,
        },
      });
      const ingredientItem = await prisma.item.create({
        data: {
          name: "Relations Test Recipes Tab Dup Ingredient",
          slug: `${P}recipes-tab-dup-ingredient`,
        },
      });
      const recipe = await prisma.recipe.create({
        data: {
          name: "Relations Test Recipes Tab Dup Recipe",
          slug: `${P}recipes-tab-dup-recipe`,
          resultingItemId: resultItem.id,
          ingredients: { create: [{ itemId: ingredientItem.id, quantity: 1 }] },
        },
      });

      // The same recipe/item pair can never be inserted twice —
      // @@unique([recipeId, itemId]) is exactly what makes the Used in
      // Recipes tab's query safe from ever needing to de-duplicate rows
      // itself.
      let caught: unknown = null;
      try {
        await prisma.recipeIngredient.create({
          data: { recipeId: recipe.id, itemId: ingredientItem.id, quantity: 2 },
        });
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
      expect(isUniqueConstraintError(caught)).toBe(true);

      const loaded = await prisma.item.findUnique({
        where: { id: ingredientItem.id },
        include: { recipeIngredients: true },
      });
      expect(loaded?.recipeIngredients).toHaveLength(1);
    });
  });

  describe("final preservation checks", () => {
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

    it("leaves no test-prefixed row behind in any model", async () => {
      const prisma = await getVerifiedTestPrisma();
      for (const prefix of [
        RELATIONS_TEST_SLUG_PREFIX,
        INTEGRATION_TEST_SLUG_PREFIX,
      ]) {
        const startsWithPrefix = { startsWith: prefix };
        expect(
          await prisma.category.count({ where: { slug: startsWithPrefix } })
        ).toBe(0);
        expect(
          await prisma.item.count({ where: { slug: startsWithPrefix } })
        ).toBe(0);
        expect(
          await prisma.profession.count({ where: { slug: startsWithPrefix } })
        ).toBe(0);
        expect(
          await prisma.recipe.count({ where: { slug: startsWithPrefix } })
        ).toBe(0);
      }
    });

    it("leaves no temporary recipe ingredient row behind", async () => {
      const prisma = await getVerifiedTestPrisma();
      const startsWithPrefix = { startsWith: RELATIONS_TEST_SLUG_PREFIX };
      expect(
        await prisma.recipeIngredient.count({
          where: {
            OR: [
              { recipe: { slug: startsWithPrefix } },
              { item: { slug: startsWithPrefix } },
            ],
          },
        })
      ).toBe(0);
    });
  });
});
