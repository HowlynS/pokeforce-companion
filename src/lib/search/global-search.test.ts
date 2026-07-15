// Service-free unit tests for the pure global-search helpers. The module's
// only Prisma reference is type-level, so importing it here creates no
// database client — searchGameData itself is exercised by the guarded
// integration suite, not here.

import { describe, expect, it } from "vitest";
import {
  SEARCH_RESULTS_PER_TYPE,
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
    });
  });

  it("returns a fresh object each call so callers cannot share state", () => {
    const first = emptySearchResults();
    const second = emptySearchResults();
    expect(first).not.toBe(second);
    expect(first.items).not.toBe(second.items);
  });
});

describe("countSearchResults", () => {
  const entry = { slug: "x", name: "X", description: null };

  it("counts zero for empty results", () => {
    expect(countSearchResults(emptySearchResults())).toBe(0);
  });

  it("sums hits across every group", () => {
    const results: GlobalSearchResults = {
      items: [entry, entry],
      recipes: [entry],
      professions: [entry],
      categories: [entry, entry, entry],
    };
    expect(countSearchResults(results)).toBe(7);
  });
});

describe("SEARCH_RESULTS_PER_TYPE", () => {
  it("is a small positive per-resource bound", () => {
    expect(SEARCH_RESULTS_PER_TYPE).toBe(10);
  });
});
