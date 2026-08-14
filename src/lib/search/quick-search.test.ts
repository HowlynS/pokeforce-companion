import { describe, expect, it } from "vitest";
import { emptySearchResults, type GlobalSearchResults } from "@/lib/search/global-search";
import {
  QUICK_SEARCH_GROUP_LIMIT,
  QUICK_SEARCH_TOTAL_LIMIT,
  buildQuickSearchGroups,
  flattenQuickSearchGroups,
  isQuickSearchQuery,
  rankQuickResult,
} from "@/lib/search/quick-search";

function entry(name: string, context: string | null = null) {
  return {
    name,
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    description: null,
    context,
  };
}

function results(partial: Partial<GlobalSearchResults>): GlobalSearchResults {
  return { ...emptySearchResults(), ...partial };
}

describe("isQuickSearchQuery", () => {
  it("requires two characters before suggesting anything", () => {
    expect(isQuickSearchQuery("c")).toBe(false);
    expect(isQuickSearchQuery(" c ")).toBe(false);
    expect(isQuickSearchQuery("co")).toBe(true);
  });
});

describe("rankQuickResult", () => {
  it("ranks exact, prefix, and substring matches in that order", () => {
    expect(rankQuickResult("Copper", "copper")).toBe(0);
    expect(rankQuickResult("Copper Ore", "copper")).toBe(1);
    expect(rankQuickResult("Refined Copper", "copper")).toBe(2);
    // No name match at all: the record matched through other searchable text.
    expect(rankQuickResult("Iron Sword", "copper")).toBe(3);
  });

  it("ignores case and surrounding whitespace", () => {
    expect(rankQuickResult("  COPPER  ", " Copper ")).toBe(0);
  });
});

describe("buildQuickSearchGroups", () => {
  it("orders a group by relevance, then name", () => {
    const groups = buildQuickSearchGroups(
      results({
        items: [entry("Refined Copper"), entry("Copper"), entry("Copper Ore")],
      }),
      "copper",
    );

    expect(groups.map((group) => group.key)).toEqual(["items"]);
    expect(groups[0].results.map((result) => result.name)).toEqual([
      "Copper",
      "Copper Ore",
      "Refined Copper",
    ]);
  });

  it("caps each resource so one cannot fill the panel", () => {
    const groups = buildQuickSearchGroups(
      results({
        items: [
          entry("Copper A"),
          entry("Copper B"),
          entry("Copper C"),
          entry("Copper D"),
        ],
      }),
      "copper",
    );

    expect(groups[0].results).toHaveLength(QUICK_SEARCH_GROUP_LIMIT);
  });

  it("keeps the whole panel within its total budget", () => {
    const many = [entry("Copper A"), entry("Copper B"), entry("Copper C")];
    const groups = buildQuickSearchGroups(
      results({
        items: many,
        recipes: many,
        professions: many,
        locations: many,
      }),
      "copper",
    );

    expect(flattenQuickSearchGroups(groups)).toHaveLength(QUICK_SEARCH_TOTAL_LIMIT);
  });

  it("gives the budget to the stronger matches rather than splitting it evenly", () => {
    const groups = buildQuickSearchGroups(
      results({
        // Six strong matches (exact/prefix) across two resources…
        items: [entry("Copper"), entry("Copper Ore"), entry("Copper Ingot")],
        recipes: [
          entry("Copper Dagger"),
          entry("Copper Plate"),
          entry("Copper Nail"),
        ],
        // …against Shops that only matched through a relation.
        shops: [
          entry("Alder Emporium", "Location: Copper Ridge"),
          entry("Bell Bazaar", "Location: Copper Ridge"),
          entry("Cinder Stall", "Location: Copper Ridge"),
        ],
      }),
      "copper",
    );

    const items = groups.find((group) => group.key === "items");
    const recipes = groups.find((group) => group.key === "recipes");
    const shops = groups.find((group) => group.key === "shops");
    expect(items?.results).toHaveLength(3);
    expect(recipes?.results).toHaveLength(3);
    // The weakest group yields the space, instead of every group being padded
    // to an equal share of the budget.
    expect(shops?.results).toHaveLength(1);
  });

  it("names the groups the public labels, and omits empty ones", () => {
    const groups = buildQuickSearchGroups(
      results({ playerClasses: [entry("Rancher")], recipes: [entry("Ranch Stew")] }),
      "ran",
    );

    expect(groups.map((group) => group.label)).toEqual(["Recipes", "Classes"]);
  });

  it("never offers a resource the dropdown does not support", () => {
    // Categories exist in the full search results but are not a quick-search
    // destination; nothing else (there are no NPCs) may appear either.
    const groups = buildQuickSearchGroups(
      results({ categories: [entry("Copper Goods")] }),
      "copper",
    );

    expect(groups).toEqual([]);
  });

  it("builds each result's canonical public href", () => {
    const groups = buildQuickSearchGroups(
      results({
        items: [entry("Copper Ore")],
        playerClasses: [entry("Copper Ranger")],
        shops: [entry("Copper Stall")],
      }),
      "copper",
    );

    expect(flattenQuickSearchGroups(groups).map((result) => result.href)).toEqual([
      "/items/copper-ore",
      "/classes/copper-ranger",
      "/shops/copper-stall",
    ]);
  });

  it("keeps the existing relational context line", () => {
    const groups = buildQuickSearchGroups(
      results({ recipes: [entry("Bronze Blade", "Ingredient: Copper Ore")] }),
      "copper",
    );

    expect(groups[0].results[0].context).toBe("Ingredient: Copper Ore");
  });

  it("returns nothing for empty results", () => {
    expect(buildQuickSearchGroups(emptySearchResults(), "copper")).toEqual([]);
  });
});
