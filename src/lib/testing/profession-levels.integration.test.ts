import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  PROFESSION_LEVEL_THRESHOLDS,
  withProfessionLevelDifferences,
} from "@/lib/professions/profession-levels";
import {
  disconnectTestPrisma,
  getVerifiedTestPrisma,
} from "@/lib/testing/integration-database";

describe("shared Profession progression reference data (integration)", () => {
  beforeAll(async () => {
    await getVerifiedTestPrisma();
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  it("stores exactly the supplied 100 continuous cumulative thresholds", async () => {
    const prisma = await getVerifiedTestPrisma();
    const stored = await prisma.professionLevel.findMany({
      orderBy: { level: "asc" },
    });

    expect(stored).toEqual([...PROFESSION_LEVEL_THRESHOLDS]);
    expect(stored).toHaveLength(100);
    expect(stored.map(({ level }) => level)).toEqual(
      Array.from({ length: 100 }, (_, index) => index + 1)
    );
  });

  it("strictly increases and computes every adjacent difference", async () => {
    const prisma = await getVerifiedTestPrisma();
    const stored = await prisma.professionLevel.findMany({
      orderBy: { level: "asc" },
    });
    const progression = withProfessionLevelDifferences(stored);

    for (let index = 1; index < progression.length; index += 1) {
      const difference =
        progression[index].experienceRequired -
        progression[index - 1].experienceRequired;

      expect(difference).toBeGreaterThan(0);
      expect(progression[index].experienceFromPrevious).toBe(difference);
      expect(progression[index - 1].experienceToNext).toBe(difference);
    }

    expect(progression[0].experienceFromPrevious).toBeNull();
    expect(progression[99].experienceToNext).toBeNull();
  });
});
