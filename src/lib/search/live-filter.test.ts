import { describe, expect, it } from "vitest";
import {
  buildLiveSearchText,
  filterLiveEntries,
  filterLiveGroups,
  matchesLiveQuery,
  normalizeLiveQuery,
  resolveLivePageWindow,
  shouldResetLivePage,
} from "@/lib/search/live-filter";

const ENTRIES = [
  { key: "1", text: "Copper Ore" },
  { key: "2", text: "Copper Ingot" },
  { key: "3", text: "Iron Ore" },
];

describe("normalizeLiveQuery", () => {
  it("trims and lowercases", () => {
    expect(normalizeLiveQuery("  Copper  ")).toBe("copper");
  });

  it("treats blank, missing, and non-string values as no filter", () => {
    expect(normalizeLiveQuery("   ")).toBe("");
    expect(normalizeLiveQuery(undefined)).toBe("");
    expect(normalizeLiveQuery(42)).toBe("");
  });

  it("collapses a repeated URL parameter to its first value", () => {
    expect(normalizeLiveQuery(["Copper", "Iron"])).toBe("copper");
  });
});

describe("matchesLiveQuery", () => {
  it("matches case-insensitively anywhere in the text", () => {
    expect(matchesLiveQuery("Copper Ingot", "ingot")).toBe(true);
    expect(matchesLiveQuery("Copper Ingot", "COPPER".toLowerCase())).toBe(true);
    expect(matchesLiveQuery("Copper Ingot", "steel")).toBe(false);
  });

  it("matches everything when there is no query", () => {
    expect(matchesLiveQuery("anything", "")).toBe(true);
  });
});

describe("filterLiveEntries", () => {
  it("keeps the caller's own order", () => {
    expect(filterLiveEntries(ENTRIES, "ore").map((entry) => entry.key)).toEqual([
      "1",
      "3",
    ]);
  });

  it("returns every entry for a blank query", () => {
    expect(filterLiveEntries(ENTRIES, "")).toHaveLength(3);
  });

  it("returns nothing when no record matches", () => {
    expect(filterLiveEntries(ENTRIES, "mithril")).toEqual([]);
  });
});

describe("buildLiveSearchText", () => {
  it("joins the populated fields only", () => {
    expect(buildLiveSearchText("Alder Emporium", null, "Goldenrod City")).toBe(
      "Alder Emporium Goldenrod City",
    );
  });

  it("never lets a blank field become a match surface", () => {
    expect(buildLiveSearchText("  ", undefined)).toBe("");
    expect(matchesLiveQuery(buildLiveSearchText(null), "a")).toBe(false);
  });
});

describe("resolveLivePageWindow", () => {
  it("windows a page of results", () => {
    expect(resolveLivePageWindow(2, 50, 24)).toEqual({
      currentPage: 2,
      pageCount: 3,
      start: 24,
      end: 48,
    });
  });

  it("clamps a page index that the current match count no longer has", () => {
    // The exact live-filtering hazard: page 4 of a result set that shrank to
    // one page must not render an empty catalogue.
    expect(resolveLivePageWindow(4, 3, 24)).toMatchObject({
      currentPage: 1,
      pageCount: 1,
      start: 0,
    });
  });

  it("treats zero matches as a single empty page", () => {
    expect(resolveLivePageWindow(1, 0, 24)).toMatchObject({
      currentPage: 1,
      pageCount: 1,
    });
  });

  it("puts an unpaginated catalogue on one page holding everything", () => {
    // 0 * Infinity is NaN, which would slice every record away.
    expect(
      resolveLivePageWindow(1, 5, Number.POSITIVE_INFINITY),
    ).toEqual({ currentPage: 1, pageCount: 1, start: 0, end: 5 });
  });

  it("ignores a nonsense page value", () => {
    expect(resolveLivePageWindow(Number.NaN, 50, 24).currentPage).toBe(1);
    expect(resolveLivePageWindow(-3, 50, 24).currentPage).toBe(1);
  });
});

describe("shouldResetLivePage", () => {
  it("resets when the term really changed", () => {
    expect(shouldResetLivePage("cop", "copp")).toBe(true);
    expect(shouldResetLivePage("copper", "")).toBe(true);
  });

  it("does not reset for a change that normalizes away", () => {
    expect(shouldResetLivePage("copper", "Copper ")).toBe(false);
  });
});

describe("filterLiveGroups", () => {
  const groups = [
    {
      key: "johto",
      headingText: "Johto",
      subGroups: [
        {
          key: "TOWN",
          entries: [
            { key: "goldenrod", text: "Goldenrod City" },
            { key: "azalea", text: "Azalea Town" },
          ],
        },
        { key: "ROUTE", entries: [{ key: "r34", text: "Route 34" }] },
      ],
    },
    {
      key: "kanto",
      headingText: "Kanto",
      subGroups: [{ key: "TOWN", entries: [{ key: "pewter", text: "Pewter City" }] }],
    },
  ];

  it("drops an emptied subgroup and an unmatched group", () => {
    const result = filterLiveGroups(groups, "goldenrod");

    expect(result).toHaveLength(1);
    expect(result[0].key).toBe("johto");
    expect(result[0].subGroups.map((group) => group.key)).toEqual(["TOWN"]);
    expect(result[0].matchCount).toBe(1);
  });

  it("keeps a group whose own heading matches, counting the heading itself", () => {
    const result = filterLiveGroups(groups, "kanto");

    expect(result).toHaveLength(1);
    expect(result[0].subGroups).toEqual([]);
    expect(result[0].matchCount).toBe(1);
  });

  it("counts a matching heading alongside its matching records", () => {
    const result = filterLiveGroups(
      [{ key: "city", headingText: "Copper City", subGroups: [{ key: "a", entries: [{ key: "1", text: "Copper Mine" }] }] }],
      "copper",
    );

    expect(result[0].matchCount).toBe(2);
  });

  it("returns every group for a blank query", () => {
    expect(filterLiveGroups(groups, "")).toHaveLength(2);
  });
});
