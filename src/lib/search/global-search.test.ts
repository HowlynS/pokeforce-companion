// Service-free unit tests for the pure global-search helpers. The module's
// only Prisma reference is type-level, so importing it here creates no
// database client — searchGameData itself is exercised by the guarded
// integration suite, not here.

import { describe, expect, it } from "vitest";
import {
  SEARCH_RESULTS_PER_TYPE,
  buildMatchContext,
  buildSearchSummary,
  countSearchResults,
  emptySearchResults,
  normalizeSearchQuery,
  type GlobalSearchResults,
} from "./global-search";

describe("normalizeSearchQuery", () => {
  it("returns a plain query unchanged", () => {
    expect(normalizeSearchQuery("iron")).toBe("iron");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeSearchQuery("  iron  ")).toBe("iron");
  });

  it("preserves inner whitespace and case", () => {
    expect(normalizeSearchQuery(" Iron Ore ")).toBe("Iron Ore");
  });

  it("treats an empty string as no query", () => {
    expect(normalizeSearchQuery("")).toBe("");
  });

  it("treats a whitespace-only string as no query", () => {
    expect(normalizeSearchQuery("   \t  ")).toBe("");
  });

  it("treats a missing value as no query", () => {
    expect(normalizeSearchQuery(undefined)).toBe("");
    expect(normalizeSearchQuery(null)).toBe("");
  });

  it("uses the first value of a repeated parameter", () => {
    expect(normalizeSearchQuery([" iron ", "copper"])).toBe("iron");
  });

  it("treats an empty repeated parameter as no query", () => {
    expect(normalizeSearchQuery([])).toBe("");
  });

  it("treats a non-string value as no query", () => {
    expect(normalizeSearchQuery(42)).toBe("");
    expect(normalizeSearchQuery({ q: "iron" })).toBe("");
  });
});

describe("emptySearchResults", () => {
  it("holds an empty group for every resource type", () => {
    expect(emptySearchResults()).toEqual({
      items: [],
      recipes: [],
      professions: [],
      categories: [],
      locations: [],
    });
  });

  it("returns a fresh object each call so callers cannot share state", () => {
    const first = emptySearchResults();
    const second = emptySearchResults();
    expect(first).not.toBe(second);
    expect(first.items).not.toBe(second.items);
  });
});

describe("buildMatchContext", () => {
  const relations = [
    { label: "Result", value: "Iron Ingot" },
    { label: "Profession", value: "Blacksmithing" },
    { label: "Ingredient", value: "Iron Ore" },
  ];

  it("returns null for a direct match — no explanation needed", () => {
    expect(buildMatchContext("sword", ["Iron Sword"], relations)).toBeNull();
  });

  it("checks direct fields case-insensitively", () => {
    expect(buildMatchContext("SWORD", ["Iron Sword"], relations)).toBeNull();
  });

  it("labels the matching relation for a purely relational match", () => {
    expect(buildMatchContext("blacksmith", ["Charcoal"], relations)).toBe(
      "Profession: Blacksmithing"
    );
  });

  it("matches relations case-insensitively", () => {
    expect(buildMatchContext("BLACKSMITH", ["Charcoal"], relations)).toBe(
      "Profession: Blacksmithing"
    );
  });

  it("picks the first matching relation as the deterministic priority", () => {
    // "iron" occurs in both the result and an ingredient; the earlier
    // candidate wins.
    expect(buildMatchContext("iron", ["Charcoal"], relations)).toBe(
      "Result: Iron Ingot"
    );
  });

  it("skips null and undefined fields and relation values", () => {
    expect(
      buildMatchContext(
        "materials",
        ["Iron Ore", null, undefined],
        [
          { label: "Profession", value: undefined },
          { label: "Category", value: "Materials" },
        ]
      )
    ).toBe("Category: Materials");
  });

  it("returns null when nothing matches", () => {
    expect(buildMatchContext("zzz", ["Charcoal"], relations)).toBeNull();
  });

  it("returns null for a blank query", () => {
    expect(buildMatchContext("   ", ["Charcoal"], relations)).toBeNull();
  });

  it("trims the query before comparing", () => {
    expect(buildMatchContext("  blacksmith  ", ["Charcoal"], relations)).toBe(
      "Profession: Blacksmithing"
    );
  });
});

describe("countSearchResults", () => {
  const entry = { slug: "x", name: "X", description: null, context: null };

  it("counts zero for empty results", () => {
    expect(countSearchResults(emptySearchResults())).toBe(0);
  });

  it("sums hits across every group", () => {
    const results: GlobalSearchResults = {
      items: [entry, entry],
      recipes: [entry],
      professions: [entry],
      categories: [entry, entry, entry],
      locations: [entry],
    };
    expect(countSearchResults(results)).toBe(8);
  });
});

describe("buildSearchSummary", () => {
  const entry = { slug: "x", name: "X", description: null, context: null };

  it("counts displayed results and non-empty groups with plural wording", () => {
    const results: GlobalSearchResults = {
      items: [entry, entry, entry],
      recipes: [entry, entry, entry],
      professions: [],
      categories: [],
      locations: [],
    };
    expect(buildSearchSummary(results)).toBe(
      "Showing 6 results across 2 resource types."
    );
  });

  it("uses singular wording for one result in one group", () => {
    const results: GlobalSearchResults = {
      items: [],
      recipes: [entry],
      professions: [],
      categories: [],
      locations: [],
    };
    expect(buildSearchSummary(results)).toBe(
      "Showing 1 result across 1 resource type."
    );
  });

  it("counts a group only when it holds results", () => {
    const results: GlobalSearchResults = {
      items: [entry],
      recipes: [],
      professions: [entry],
      categories: [entry],
      locations: [],
    };
    expect(buildSearchSummary(results)).toBe(
      "Showing 3 results across 3 resource types."
    );
  });

  it("says 'Showing' so a capped group is never presented as the full match count", () => {
    expect(buildSearchSummary(emptySearchResults())).toMatch(/^Showing /);
  });
});

describe("SEARCH_RESULTS_PER_TYPE", () => {
  it("is a small positive per-resource bound", () => {
    expect(SEARCH_RESULTS_PER_TYPE).toBe(10);
  });
});
