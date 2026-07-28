import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Prisma } from "@/generated/prisma/client";
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
    data: { name: `${PLAYER_CLASS_TEST_VERSION_NAME_PREFIX}${crypto.randomUUID()}` },
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

  it("requires every Recipe to reference a real PlayerClass at the database level", async () => {
    const { prisma, resultItem } = await createFixture();

    // playerClassId is required in Prisma's generated types (already
    // enforced by TypeScript everywhere else) — this proves the database's
    // own NOT NULL constraint is the authoritative backstop, not just the
    // type layer, by bypassing it deliberately for this one call.
    const create = prisma.recipe.create as unknown as (args: {
      data: Record<string, unknown>;
    }) => Promise<unknown>;

    await expect(
      create({
        data: {
          name: "Player Class Test Recipe Missing Class",
          slug: `${P}recipe-missing-class`,
          resultingItemId: resultItem.id,
          experienceReward: 10,
        },
      })
    ).rejects.toThrow();
  });

  it("blocks Recipe with a nonexistent PlayerClass id (genuine P2003)", async () => {
    const { prisma, resultItem } = await createFixture();

    let caught: unknown = null;
    try {
      await prisma.recipe.create({
        data: {
          name: "Player Class Test Recipe Invalid Class",
          slug: `${P}recipe-invalid-class`,
          resultingItemId: resultItem.id,
          playerClassId: `${P}nonexistent-id`,
          experienceReward: 10,
        },
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect((caught as Prisma.PrismaClientKnownRequestError).code).toBe("P2003");
  });

  it("blocks PlayerClass deletion while a Recipe still requires it, then allows it once removed", async () => {
    const { prisma, version, resultItem, playerClass } = await createFixture();

    const recipe = await prisma.recipe.create({
      data: {
        name: "Player Class Test Dependent Recipe",
        slug: `${P}dependent-recipe`,
        resultingItemId: resultItem.id,
        playerClassId: playerClass.id,
        experienceReward: 25,
      },
    });

    let caught: unknown = null;
    try {
      await prisma.playerClass.delete({ where: { id: playerClass.id } });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect((caught as Prisma.PrismaClientKnownRequestError).code).toBe("P2003");

    // The database itself still holds the row — this is a real, effective
    // constraint, not just an application-level pre-check.
    expect(
      await prisma.playerClass.findUnique({ where: { id: playerClass.id } })
    ).not.toBeNull();

    // Removing the dependent Recipe (the application rule: reassign or
    // remove Recipes before a Class can be deleted) lifts the restriction.
    await prisma.recipe.delete({ where: { id: recipe.id } });
    await prisma.playerClass.delete({ where: { id: playerClass.id } });

    expect(
      await prisma.playerClass.findUnique({ where: { id: playerClass.id } })
    ).toBeNull();

    // With the Class's own verification stamp gone (the row itself is
    // deleted), the Game Version it referenced is no longer blocked; the
    // result Item was never referenced by anything and was always
    // independently deletable.
    await prisma.item.delete({ where: { id: resultItem.id } });
    await prisma.gameVersion.delete({ where: { id: version.id } });
  });
});
