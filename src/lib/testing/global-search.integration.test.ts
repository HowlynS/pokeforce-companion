// Guarded integration tests for searchGameData against the REAL isolated
// Supabase test database. Almost entirely READ-ONLY against the
// deterministic seed from prisma/seed.ts; the single exception is one
// prefixed Recipe fixture for the resulting-Item relation (every seeded
// recipe shares its result's name, so that path is invisible read-only),
// created and prefix-scope-deleted inside this file. The Prisma client is
// obtained through getVerifiedTestPrisma(), so the fail-closed environment
// guard runs before any connection exists; the search module itself never
// creates a client (its Prisma reference is type-level only).
//
// Only vitest.integration.config.ts collects this file; the unit config
// excludes **/*.integration.test.ts, so `pnpm test:unit` never loads it.

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  SEARCH_RESULTS_PER_TYPE,
  searchGameData,
} from "@/lib/search/global-search";
import {
  INTEGRATION_TEST_SLUG_PREFIX,
  disconnectTestPrisma,
  getVerifiedTestPrisma,
} from "./integration-database";

// The one write this file ever performs: a Recipe whose NAME does not
// contain "whetstone" but whose resulting Item (seeded Whetstone) does. It
// has no ingredients and no profession, so deleting it cascades nothing.
const RESULT_PROBE_SLUG = `${INTEGRATION_TEST_SLUG_PREFIX}search-result-probe`;

// The seed has zero Location fixtures at all (Slice 10E audit), so proving
// the Location search path needs its own prefixed fixture, cleaned up the
// same way as the Recipe probe above.
const LOCATION_PROBE_SLUG = `${INTEGRATION_TEST_SLUG_PREFIX}search-location-probe`;

// Prefix-scoped cleanup for this file's fixture Recipe. Deletes ONLY
// Recipes carrying the integration-test slug prefix; seeded recipes can
// never match.
async function deleteSearchFixtureRecipes(): Promise<number> {
  if (INTEGRATION_TEST_SLUG_PREFIX.length < 5) {
    throw new Error(
      "Refusing prefix-scoped cleanup: the integration-test slug prefix is suspiciously short."
    );
  }

  const prisma = await getVerifiedTestPrisma();
  const result = await prisma.recipe.deleteMany({
    where: { slug: { startsWith: INTEGRATION_TEST_SLUG_PREFIX } },
  });
  return result.count;
}

// Prefix-scoped cleanup for this file's fixture Location. Deletes ONLY
// Locations carrying the integration-test slug prefix; the seed has none.
async function deleteSearchFixtureLocations(): Promise<number> {
  if (INTEGRATION_TEST_SLUG_PREFIX.length < 5) {
    throw new Error(
      "Refusing prefix-scoped cleanup: the integration-test slug prefix is suspiciously short."
    );
  }

  const prisma = await getVerifiedTestPrisma();
  const result = await prisma.location.deleteMany({
    where: { slug: { startsWith: INTEGRATION_TEST_SLUG_PREFIX } },
  });
  return result.count;
}

describe("global search (integration)", () => {
  beforeAll(async () => {
    // First database contact of the file: the guard inside
    // getVerifiedTestPrisma() throws here if the environment is not the
    // verified test project. Also removes any prefixed leftovers an
    // interrupted earlier run may have stranded.
    await deleteSearchFixtureRecipes();
    await deleteSearchFixtureLocations();
  });

  afterEach(async () => {
    await deleteSearchFixtureRecipes();
    await deleteSearchFixtureLocations();
  });

  afterAll(async () => {
    const remainingRecipes = await deleteSearchFixtureRecipes();
    const remainingLocations = await deleteSearchFixtureLocations();
    await disconnectTestPrisma();
    expect(remainingRecipes).toBe(0);
    expect(remainingLocations).toBe(0);
  });

  it("matches partial item names case-insensitively", async () => {
    const prisma = await getVerifiedTestPrisma();

    const lower = await searchGameData(prisma, "iron");
    const upper = await searchGameData(prisma, "IRON");

    // Seeded: Iron Ore, Iron Ingot, Iron Sword (items). Recipes: Iron
    // Ingot and Iron Sword by name, plus Reinforced Shield relationally
    // through its Iron Ingot ingredient. "iron" is a substring match, not
    // a whole word.
    expect(lower.items.map((item) => item.slug)).toEqual([
      "iron-ingot",
      "iron-ore",
      "iron-sword",
    ]);
    expect(lower.recipes.map((recipe) => recipe.slug)).toEqual([
      "iron-ingot",
      "iron-sword",
      "reinforced-shield",
    ]);
    expect(lower.professions).toEqual([]);
    expect(lower.categories).toEqual([]);
    expect(lower.locations).toEqual([]);

    // Case must not change the result set or its order.
    expect(upper).toEqual(lower);
  });

  it("returns each recipe once with one context even when several relations match", async () => {
    const prisma = await getVerifiedTestPrisma();

    const results = await searchGameData(prisma, "iron");

    // No duplicates: one row per recipe regardless of how many relations
    // matched (Iron Ingot matches by name, result, AND ingredient).
    const slugs = results.recipes.map((recipe) => recipe.slug);
    expect(new Set(slugs).size).toBe(slugs.length);

    // Direct name matches carry no context; the purely relational match
    // explains itself with exactly one line.
    const byIngredient = results.recipes.find(
      (recipe) => recipe.slug === "reinforced-shield"
    );
    expect(byIngredient?.context).toBe("Ingredient: Iron Ingot");
    const byName = results.recipes.find(
      (recipe) => recipe.slug === "iron-sword"
    );
    expect(byName?.context).toBeNull();
  });

  it("finds items through their category name", async () => {
    const prisma = await getVerifiedTestPrisma();

    const results = await searchGameData(prisma, "gear");

    // No item name/description contains "gear"; the three Gear
    // items match relationally and say so. The category itself matches
    // directly with no context.
    expect(results.items.map((item) => item.slug)).toEqual([
      "copper-dagger",
      "iron-sword",
      "reinforced-shield",
    ]);
    for (const item of results.items) {
      expect(item.context).toBe("Category: Gear");
    }
    expect(results.categories.map((category) => category.slug)).toEqual([
      "gear",
    ]);
    expect(results.categories[0].context).toBeNull();
    expect(results.recipes).toEqual([]);
    expect(results.locations).toEqual([]);
  });

  it("finds recipes through an ingredient item name, case-insensitively", async () => {
    const prisma = await getVerifiedTestPrisma();

    const lower = await searchGameData(prisma, "leather");
    const upper = await searchGameData(prisma, "LEATHER");

    // Three seeded recipes consume Leather Strap; none carries "leather"
    // in its own name. The item itself matches directly.
    expect(lower.recipes.map((recipe) => recipe.slug)).toEqual([
      "copper-dagger",
      "iron-sword",
      "reinforced-shield",
    ]);
    for (const recipe of lower.recipes) {
      expect(recipe.context).toBe("Ingredient: Leather Strap");
    }
    expect(lower.items.map((item) => item.slug)).toEqual(["leather-strap"]);
    expect(lower.locations).toEqual([]);
    expect(upper).toEqual(lower);
  });

  it("finds recipes through their profession name", async () => {
    const prisma = await getVerifiedTestPrisma();

    const results = await searchGameData(prisma, "alchemy");

    // Both Alchemy recipes match relationally; the profession itself
    // matches directly.
    expect(results.recipes.map((recipe) => recipe.slug)).toEqual([
      "minor-healing-tonic",
      "stamina-brew",
    ]);
    for (const recipe of results.recipes) {
      expect(recipe.context).toBe("Profession: Alchemy");
    }
    expect(results.professions.map((profession) => profession.slug)).toEqual([
      "alchemy",
    ]);
    expect(results.items).toEqual([]);
    expect(results.locations).toEqual([]);
  });

  it("finds a recipe through its resulting item name", async () => {
    const prisma = await getVerifiedTestPrisma();

    // Every seeded recipe shares its result's name, so a prefixed fixture
    // whose name does NOT contain "whetstone" is needed to prove the
    // resulting-Item relation path. Whetstone (seeded) is produced by no
    // seeded recipe and consumed by none.
    const whetstone = await prisma.item.findUnique({
      where: { slug: "whetstone" },
      select: { id: true },
    });
    expect(whetstone).not.toBeNull();

    await prisma.recipe.create({
      data: {
        slug: RESULT_PROBE_SLUG,
        name: "Test Integration Search Result Probe",
        resultingItemId: whetstone!.id,
      },
    });

    const results = await searchGameData(prisma, "whetstone");

    expect(results.recipes.map((recipe) => recipe.slug)).toEqual([
      RESULT_PROBE_SLUG,
    ]);
    expect(results.recipes[0].context).toBe("Result: Whetstone");
    expect(results.items.map((item) => item.slug)).toEqual(["whetstone"]);
    expect(results.locations).toEqual([]);
  });

  it("matches inside a word, not only at the start", async () => {
    const prisma = await getVerifiedTestPrisma();

    const results = await searchGameData(prisma, "hetsto");

    // "Whetstone" is the only seeded record containing "hetsto".
    expect(results.items.map((item) => item.slug)).toEqual(["whetstone"]);
    expect(results.recipes).toEqual([]);
    expect(results.locations).toEqual([]);
  });

  it("matches descriptions where the field exists", async () => {
    const prisma = await getVerifiedTestPrisma();

    // "potions" appears only in the seeded Consumables category description
    // and the seeded Alchemy profession description — no name contains it.
    const results = await searchGameData(prisma, "potions");

    expect(results.categories.map((category) => category.slug)).toEqual([
      "consumables",
    ]);
    expect(results.professions.map((profession) => profession.slug)).toEqual([
      "alchemy",
    ]);
    expect(results.items).toEqual([]);
    expect(results.recipes).toEqual([]);
    expect(results.locations).toEqual([]);
  });

  it("finds a location through its own name, case-insensitively", async () => {
    const prisma = await getVerifiedTestPrisma();

    // The seed has zero Location fixtures, so this fixture proves the
    // Location search path end to end: direct name match, no relational
    // matching (Location has none), and no context line.
    await prisma.location.create({
      data: {
        slug: LOCATION_PROBE_SLUG,
        name: "Zzz Integration Search Location Probe",
        type: "REGION",
      },
    });

    const lower = await searchGameData(prisma, "zzz integration search location probe");
    const upper = await searchGameData(prisma, "ZZZ INTEGRATION SEARCH LOCATION PROBE");

    expect(lower.locations.map((location) => location.slug)).toEqual([
      LOCATION_PROBE_SLUG,
    ]);
    expect(lower.locations[0].context).toBeNull();
    expect(lower.items).toEqual([]);
    expect(lower.recipes).toEqual([]);
    expect(lower.professions).toEqual([]);
    expect(lower.categories).toEqual([]);
    expect(upper).toEqual(lower);
  });

  it("finds a location through its description", async () => {
    const prisma = await getVerifiedTestPrisma();

    await prisma.location.create({
      data: {
        slug: LOCATION_PROBE_SLUG,
        name: "Zzz Integration Search Location Probe",
        type: "REGION",
        description: "A remote testing-only outpost with nothing else nearby.",
      },
    });

    const results = await searchGameData(prisma, "testing-only outpost");

    expect(results.locations.map((location) => location.slug)).toEqual([
      LOCATION_PROBE_SLUG,
    ]);
    expect(results.locations[0].context).toBeNull();
  });

  it("returns empty groups when nothing matches", async () => {
    const prisma = await getVerifiedTestPrisma();

    const results = await searchGameData(prisma, "zzz-no-such-record");

    expect(results).toEqual({
      items: [],
      recipes: [],
      professions: [],
      categories: [],
      locations: [],
    });
  });

  it("returns empty groups for a blank or whitespace-only query", async () => {
    const prisma = await getVerifiedTestPrisma();

    expect(await searchGameData(prisma, "")).toEqual({
      items: [],
      recipes: [],
      professions: [],
      categories: [],
      locations: [],
    });
    expect(await searchGameData(prisma, "   ")).toEqual({
      items: [],
      recipes: [],
      professions: [],
      categories: [],
      locations: [],
    });
  });

  it("trims surrounding whitespace before matching", async () => {
    const prisma = await getVerifiedTestPrisma();

    const padded = await searchGameData(prisma, "  iron  ");
    const plain = await searchGameData(prisma, "iron");

    expect(padded).toEqual(plain);
  });

  it("orders each group deterministically by name and bounds it", async () => {
    const prisma = await getVerifiedTestPrisma();

    // "o" matches many seeded records; every group must stay within the
    // documented per-type bound and be sorted by name ascending.
    const results = await searchGameData(prisma, "o");

    for (const group of [
      results.items,
      results.recipes,
      results.professions,
      results.categories,
      results.locations,
    ]) {
      expect(group.length).toBeLessThanOrEqual(SEARCH_RESULTS_PER_TYPE);
      const names = group.map((entry) => entry.name);
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    }

    // Eleven seeded item names contain "o" (descriptions and rarities are
    // all null in the seed), so the item group must be capped at the bound.
    expect(results.items.length).toBe(SEARCH_RESULTS_PER_TYPE);
  });

  it("never exposes database IDs in results", async () => {
    const prisma = await getVerifiedTestPrisma();

    const results = await searchGameData(prisma, "iron");

    for (const entry of [
      ...results.items,
      ...results.recipes,
      ...results.professions,
      ...results.categories,
      ...results.locations,
    ]) {
      expect(Object.keys(entry).sort()).toEqual([
        "context",
        "description",
        "name",
        "slug",
      ]);
    }
  });
});
