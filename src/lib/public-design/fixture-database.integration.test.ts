import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  cleanupPublicDesignFixtures,
  readPublicDesignFixtureCounts,
  setupPublicDesignFixtures,
} from "@/lib/public-design/fixture-database";
import { PUBLIC_DESIGN_SLUG_PREFIX } from "@/lib/public-design/fixtures";
import { getVerifiedTestPrisma } from "@/lib/testing/integration-database";

const prisma = await getVerifiedTestPrisma();

describe("public design fixture database", () => {
  beforeAll(async () => {
    await cleanupPublicDesignFixtures(prisma);
  });

  afterAll(async () => {
    await cleanupPublicDesignFixtures(prisma);
    await prisma.$disconnect();
  });

  it("sets up an idempotent relational stress matrix", async () => {
    await setupPublicDesignFixtures(prisma);
    const first = await readPublicDesignFixtureCounts(prisma);
    await setupPublicDesignFixtures(prisma);
    const second = await readPublicDesignFixtureCounts(prisma);

    expect(second).toEqual(first);
    expect(second).toEqual({
      categories: 2,
      items: 18,
      recipes: 14,
      professions: 3,
      playerClasses: 2,
      locations: 7,
      shops: 2,
      currencies: 2,
      acquisitionSources: 5,
      shopListings: 13,
    });

    const denseRecipe = await prisma.recipe.findUnique({
      where: { slug: "design-review-recipe-many-ingredients" },
      include: { ingredients: true, profession: true },
    });
    expect(denseRecipe?.ingredients).toHaveLength(6);
    expect(denseRecipe?.profession?.slug).toBe("design-review-profession-dense");
  });

  it("cleans only prefixed records and leaves no fixture relations", async () => {
    const ordinaryBefore = await prisma.category.count({
      where: { slug: { not: { startsWith: PUBLIC_DESIGN_SLUG_PREFIX } } },
    });
    expect(await cleanupPublicDesignFixtures(prisma)).toBeGreaterThan(0);
    expect(await readPublicDesignFixtureCounts(prisma)).toEqual({
      categories: 0,
      items: 0,
      recipes: 0,
      professions: 0,
      playerClasses: 0,
      locations: 0,
      shops: 0,
      currencies: 0,
      acquisitionSources: 0,
      shopListings: 0,
    });
    expect(
      await prisma.category.count({
        where: { slug: { not: { startsWith: PUBLIC_DESIGN_SLUG_PREFIX } } },
      })
    ).toBe(ordinaryBefore);
  });
});
