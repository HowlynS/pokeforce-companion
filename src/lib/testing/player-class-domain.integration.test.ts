import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { countVerificationReferences } from "@/lib/game-versions";
import {
  deletePlayerClassTestRecords,
  disconnectTestPrisma,
  getVerifiedTestPrisma,
  PLAYER_CLASS_TEST_SLUG_PREFIX,
  PLAYER_CLASS_TEST_VERSION_NAME_PREFIX,
} from "@/lib/testing/integration-database";

const P = PLAYER_CLASS_TEST_SLUG_PREFIX;

async function createFixture() {
  const prisma = await getVerifiedTestPrisma();
  const version = await prisma.gameVersion.create({
    data: {
      name: `${PLAYER_CLASS_TEST_VERSION_NAME_PREFIX}${crypto.randomUUID()}`,
    },
  });
  const resultItem = await prisma.item.create({
    data: { name: "Player Class Test Result Item", slug: `${P}result-item` },
  });
  const playerClass = await prisma.playerClass.create({
    data: {
      name: "Player Class Test Artisan",
      slug: `${P}artisan`,
      description: "Crafts and builds.",
      verifiedAt: new Date("2026-07-25T00:00:00.000Z"),
      verifiedGameVersionId: version.id,
    },
  });

  return { prisma, version, resultItem, playerClass };
}

describe("PlayerClass domain (integration)", () => {
  beforeEach(async () => {
    await deletePlayerClassTestRecords();
  });

  afterAll(async () => {
    await deletePlayerClassTestRecords();
    await disconnectTestPrisma();
  });

  it("applies the decoupling migration without removing seeded records", async () => {
    const prisma = await getVerifiedTestPrisma();
    const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'Recipe'
        and column_name = 'playerClassId'
    `;
    const obsoleteIndexes = await prisma.$queryRaw<
      Array<{ indexname: string }>
    >`
      select indexname
      from pg_indexes
      where schemaname = 'public'
        and tablename = 'Recipe'
        and indexname = 'Recipe_playerClassId_idx'
    `;
    const obsoleteConstraints = await prisma.$queryRaw<
      Array<{ constraint_name: string }>
    >`
      select constraint_name
      from information_schema.table_constraints
      where table_schema = 'public'
        and table_name = 'Recipe'
        and constraint_name = 'Recipe_playerClassId_fkey'
    `;

    expect(columns).toEqual([]);
    expect(obsoleteIndexes).toEqual([]);
    expect(obsoleteConstraints).toEqual([]);
    expect(await prisma.playerClass.count()).toBe(5);
    expect(await prisma.recipe.count()).toBe(8);
  });

  it("creates required and optional PlayerClass fields", async () => {
    const { playerClass } = await createFixture();
    expect(playerClass).toMatchObject({
      name: "Player Class Test Artisan",
      slug: `${P}artisan`,
      description: "Crafts and builds.",
      image: null,
    });
  });

  it("defaults description and image to null when omitted", async () => {
    const prisma = await getVerifiedTestPrisma();
    const playerClass = await prisma.playerClass.create({
      data: { name: "Player Class Test Ranger", slug: `${P}ranger` },
    });

    expect(playerClass.description).toBeNull();
    expect(playerClass.image).toBeNull();
    expect(playerClass.verifiedAt).toBeNull();
    expect(playerClass.verifiedGameVersionId).toBeNull();
  });

  it("enforces PlayerClass slug uniqueness", async () => {
    const { prisma } = await createFixture();
    await expect(
      prisma.playerClass.create({
        data: { name: "Duplicate Class", slug: `${P}artisan` },
      })
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("keeps verification independent and preserves it on a normal edit", async () => {
    const { prisma, version, playerClass } = await createFixture();
    await prisma.playerClass.update({
      where: { id: playerClass.id },
      data: { description: "Normal edit — verification untouched." },
    });

    const reloaded = await prisma.playerClass.findUnique({
      where: { id: playerClass.id },
    });

    expect(reloaded?.verifiedGameVersionId).toBe(version.id);
    expect(reloaded?.description).toBe("Normal edit — verification untouched.");
    expect(await countVerificationReferences(prisma, version.id)).toBe(1);
  });

  it("keeps Recipes and Player Classes independent through deletion", async () => {
    const { prisma, version, resultItem, playerClass } = await createFixture();
    const recipe = await prisma.recipe.create({
      data: {
        name: "Player Class Independent Recipe",
        slug: `${P}independent-recipe`,
        resultingItemId: resultItem.id,
        experienceReward: 25,
      },
    });

    await prisma.playerClass.delete({ where: { id: playerClass.id } });

    expect(
      await prisma.recipe.findUnique({ where: { id: recipe.id } })
    ).not.toBeNull();
    expect(
      await prisma.playerClass.findUnique({ where: { id: playerClass.id } })
    ).toBeNull();

    await prisma.recipe.delete({ where: { id: recipe.id } });
    await prisma.item.delete({ where: { id: resultItem.id } });
    await prisma.gameVersion.delete({ where: { id: version.id } });
  });
});
