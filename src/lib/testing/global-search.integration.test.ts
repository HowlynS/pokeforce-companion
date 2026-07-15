// Guarded integration tests for searchGameData against the REAL isolated
// Supabase test database. Entirely READ-ONLY: every check runs against the
// deterministic seed from prisma/seed.ts — nothing is created, updated, or
// deleted, so no cleanup hooks are needed. The Prisma client is obtained
// through getVerifiedTestPrisma(), so the fail-closed environment guard runs
// before any connection exists; the search module itself never creates a
// client (its Prisma reference is type-level only).
//
// Only vitest.integration.config.ts collects this file; the unit config
// excludes **/*.integration.test.ts, so `pnpm test:unit` never loads it.

import { afterAll, describe, expect, it } from "vitest";
import {
  SEARCH_RESULTS_PER_TYPE,
  searchGameData,
} from "@/lib/search/global-search";
import {
  disconnectTestPrisma,
  getVerifiedTestPrisma,
} from "./integration-database";

describe("global search (integration, read-only)", () => {
  afterAll(async () => {
    await disconnectTestPrisma();
  });

  it("matches partial item names case-insensitively", async () => {
    const prisma = await getVerifiedTestPrisma();

    const lower = await searchGameData(prisma, "iron");
    const upper = await searchGameData(prisma, "IRON");

    // Seeded: Iron Ore, Iron Ingot, Iron Sword (items); Iron Ingot and
    // Iron Sword (recipes). "iron" is a substring match, not a whole word.
    expect(lower.items.map((item) => item.slug)).toEqual([
      "iron-ingot",
      "iron-ore",
      "iron-sword",
    ]);
    expect(lower.recipes.map((recipe) => recipe.slug)).toEqual([
      "iron-ingot",
      "iron-sword",
    ]);
    expect(lower.professions).toEqual([]);
    expect(lower.categories).toEqual([]);

    // Case must not change the result set or its order.
    expect(upper).toEqual(lower);
  });

  it("matches inside a word, not only at the start", async () => {
    const prisma = await getVerifiedTestPrisma();

    const results = await searchGameData(prisma, "hetsto");

    // "Whetstone" is the only seeded record containing "hetsto".
    expect(results.items.map((item) => item.slug)).toEqual(["whetstone"]);
    expect(results.recipes).toEqual([]);
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
  });

  it("returns empty groups when nothing matches", async () => {
    const prisma = await getVerifiedTestPrisma();

    const results = await searchGameData(prisma, "zzz-no-such-record");

    expect(results).toEqual({
      items: [],
      recipes: [],
      professions: [],
      categories: [],
    });
  });

  it("returns empty groups for a blank or whitespace-only query", async () => {
    const prisma = await getVerifiedTestPrisma();

    expect(await searchGameData(prisma, "")).toEqual({
      items: [],
      recipes: [],
      professions: [],
      categories: [],
    });
    expect(await searchGameData(prisma, "   ")).toEqual({
      items: [],
      recipes: [],
      professions: [],
      categories: [],
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
    ]) {
      expect(Object.keys(entry).sort()).toEqual([
        "description",
        "name",
        "slug",
      ]);
    }
  });
});
