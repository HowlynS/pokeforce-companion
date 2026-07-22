import { describe, expect, it } from "vitest";
import {
  buildSyncedListUrl,
  filterRecordRows,
  formatRecordCount,
  matchesRecordFilter,
  normalizeRecordFilterQuery,
  withUpdatedSearchParam,
} from "@/lib/admin/record-list-filter";

describe("normalizeRecordFilterQuery", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeRecordFilterQuery("  iron  ")).toBe("iron");
  });

  it("treats non-string input as no query", () => {
    expect(normalizeRecordFilterQuery(undefined)).toBe("");
    expect(normalizeRecordFilterQuery(null)).toBe("");
    expect(normalizeRecordFilterQuery(42)).toBe("");
  });
});

describe("matchesRecordFilter", () => {
  const row = { primary: "Iron Sword", slug: "iron-sword" };

  it("matches case-insensitively against the name", () => {
    expect(matchesRecordFilter(row, "IRON")).toBe(true);
    expect(matchesRecordFilter(row, "sword")).toBe(true);
  });

  it("matches case-insensitively against the slug", () => {
    expect(matchesRecordFilter(row, "IRON-SWORD")).toBe(true);
  });

  it("trims the query before matching", () => {
    expect(matchesRecordFilter(row, "  iron  ")).toBe(true);
  });

  it("does not match unrelated text", () => {
    expect(matchesRecordFilter(row, "shield")).toBe(false);
  });

  it("a blank query matches every row", () => {
    expect(matchesRecordFilter(row, "")).toBe(true);
    expect(matchesRecordFilter(row, "   ")).toBe(true);
  });
});

describe("matchesRecordFilter with optional searchTerms", () => {
  const locationLikeRow = {
    primary: "Sunken Cave",
    slug: "sunken-cave",
    searchTerms: ["Dungeon"],
  };

  it("matches a value found only in searchTerms, case-insensitively", () => {
    expect(matchesRecordFilter(locationLikeRow, "dungeon")).toBe(true);
    expect(matchesRecordFilter(locationLikeRow, "DUNGEON")).toBe(true);
  });

  it("still matches name and slug when searchTerms is present", () => {
    expect(matchesRecordFilter(locationLikeRow, "sunken")).toBe(true);
    expect(matchesRecordFilter(locationLikeRow, "sunken-cave")).toBe(true);
  });

  it("does not match unrelated text even with searchTerms present", () => {
    expect(matchesRecordFilter(locationLikeRow, "town")).toBe(false);
  });

  it("ignores an absent searchTerms cleanly (no error, no accidental match)", () => {
    const plainRow = { primary: "Iron Sword", slug: "iron-sword" };
    expect(matchesRecordFilter(plainRow, "iron")).toBe(true);
    expect(matchesRecordFilter(plainRow, "dungeon")).toBe(false);
  });

  it("ignores an empty searchTerms array cleanly", () => {
    const rowWithEmptyTerms = {
      primary: "Iron Sword",
      slug: "iron-sword",
      searchTerms: [],
    };
    expect(matchesRecordFilter(rowWithEmptyTerms, "iron")).toBe(true);
    expect(matchesRecordFilter(rowWithEmptyTerms, "dungeon")).toBe(false);
  });

  it("matches against any one of several searchTerms", () => {
    const rowWithMultipleTerms = {
      primary: "Sunken Cave",
      slug: "sunken-cave",
      searchTerms: ["Dungeon", "Region North"],
    };
    expect(matchesRecordFilter(rowWithMultipleTerms, "region north")).toBe(
      true
    );
  });
});

describe("filterRecordRows", () => {
  const rows = [
    { primary: "Iron Sword", slug: "iron-sword" },
    { primary: "Iron Shield", slug: "iron-shield" },
    { primary: "Wooden Bow", slug: "wooden-bow" },
  ];

  it("restores all records for a blank query", () => {
    expect(filterRecordRows(rows, "")).toEqual(rows);
    expect(filterRecordRows(rows, "   ")).toEqual(rows);
  });

  it("returns a new array even for a blank query", () => {
    expect(filterRecordRows(rows, "")).not.toBe(rows);
  });

  it("filters by name match", () => {
    expect(filterRecordRows(rows, "iron").map((r) => r.slug)).toEqual([
      "iron-sword",
      "iron-shield",
    ]);
  });

  it("filters by slug match", () => {
    expect(filterRecordRows(rows, "wooden-bow").map((r) => r.slug)).toEqual([
      "wooden-bow",
    ]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(filterRecordRows(rows, "does-not-exist")).toEqual([]);
  });
});

describe("filterRecordRows with optional searchTerms (Location-style rows)", () => {
  const locationRows = [
    { primary: "Sunken Cave", slug: "sunken-cave", searchTerms: ["Dungeon"] },
    { primary: "Millbrook", slug: "millbrook", searchTerms: ["Town"] },
    { primary: "The Long Road", slug: "the-long-road", searchTerms: ["Route"] },
  ];

  it("filters by type-label search term alone", () => {
    expect(
      filterRecordRows(locationRows, "dungeon").map((r) => r.slug)
    ).toEqual(["sunken-cave"]);
  });

  it("filtering by name still works identically alongside searchTerms", () => {
    expect(
      filterRecordRows(locationRows, "millbrook").map((r) => r.slug)
    ).toEqual(["millbrook"]);
  });

  it("a row set with no searchTerms at all behaves exactly as before (other resources)", () => {
    const itemRows = [
      { primary: "Iron Sword", slug: "iron-sword" },
      { primary: "Iron Shield", slug: "iron-shield" },
    ];
    expect(filterRecordRows(itemRows, "iron")).toHaveLength(2);
    expect(filterRecordRows(itemRows, "dungeon")).toHaveLength(0);
  });
});

describe("formatRecordCount", () => {
  const noun = { singular: "item", plural: "items" };

  it("shows only the total when no filter is active", () => {
    expect(formatRecordCount(16, 16, false, noun)).toBe("16 items");
  });

  it("uses singular wording for a total of exactly one, unfiltered", () => {
    expect(formatRecordCount(1, 1, false, noun)).toBe("1 item");
  });

  it("shows the filtered-of-total form while a filter is active", () => {
    expect(formatRecordCount(16, 4, true, noun)).toBe("4 of 16 items");
  });

  it("uses singular wording for a total of exactly one, filtered", () => {
    expect(formatRecordCount(1, 1, true, noun)).toBe("1 of 1 item");
    expect(formatRecordCount(1, 0, true, noun)).toBe("0 of 1 item");
  });

  it("handles a filtered count of zero against a larger total", () => {
    expect(formatRecordCount(16, 0, true, noun)).toBe("0 of 16 items");
  });
});

describe("withUpdatedSearchParam", () => {
  it("adds the parameter to a path with no existing query", () => {
    expect(withUpdatedSearchParam("/admin/items", "q", "iron")).toBe(
      "/admin/items?q=iron"
    );
  });

  it("replaces an existing value for the same parameter", () => {
    expect(withUpdatedSearchParam("/admin/items?q=old", "q", "new")).toBe(
      "/admin/items?q=new"
    );
  });

  it("removes the parameter entirely for a blank value", () => {
    expect(withUpdatedSearchParam("/admin/items?q=old", "q", "")).toBe(
      "/admin/items"
    );
  });

  it("preserves unrelated existing parameters", () => {
    expect(
      withUpdatedSearchParam("/admin/items?success=created&q=old", "q", "new")
    ).toBe("/admin/items?success=created&q=new");
  });

  it("encodes values that would otherwise corrupt the URL", () => {
    expect(withUpdatedSearchParam("/admin/items", "q", "a&b=c")).toBe(
      "/admin/items?q=a%26b%3Dc"
    );
  });

  it("preserves a hash fragment", () => {
    expect(withUpdatedSearchParam("/admin/items#top", "q", "iron")).toBe(
      "/admin/items?q=iron#top"
    );
  });
});

describe("buildSyncedListUrl", () => {
  it("appends the parameter for a non-blank value", () => {
    expect(
      buildSyncedListUrl("/admin/items", new URLSearchParams(""), "q", "iron")
    ).toBe("/admin/items?q=iron");
  });

  it("removes the parameter entirely for a blank value", () => {
    expect(
      buildSyncedListUrl(
        "/admin/items",
        new URLSearchParams("q=iron"),
        "q",
        ""
      )
    ).toBe("/admin/items");
  });

  it("preserves unrelated existing parameters", () => {
    expect(
      buildSyncedListUrl(
        "/admin/items",
        new URLSearchParams("success=created"),
        "q",
        "iron"
      )
    ).toBe("/admin/items?success=created&q=iron");
  });

  it("strips obsolete pagination parameters even when the value is blank", () => {
    expect(
      buildSyncedListUrl(
        "/admin/items",
        new URLSearchParams("page=2&pageSize=25"),
        "q",
        ""
      )
    ).toBe("/admin/items");
  });

  it("strips obsolete pagination parameters while still applying a new query", () => {
    expect(
      buildSyncedListUrl(
        "/admin/items",
        new URLSearchParams("page=2&pageSize=25&success=created"),
        "q",
        "iron"
      )
    ).toBe("/admin/items?success=created&q=iron");
  });

  it("returns the bare pathname when no parameters remain", () => {
    expect(
      buildSyncedListUrl("/admin/items", new URLSearchParams(""), "q", "")
    ).toBe("/admin/items");
  });

  it("defaults to no hash when none is supplied", () => {
    expect(
      buildSyncedListUrl("/admin/items", new URLSearchParams(""), "q", "iron")
    ).toBe("/admin/items?q=iron");
  });

  it("preserves a supplied hash fragment alongside a query change", () => {
    expect(
      buildSyncedListUrl(
        "/admin/items",
        new URLSearchParams(""),
        "q",
        "iron",
        "#top"
      )
    ).toBe("/admin/items?q=iron#top");
  });

  it("preserves a supplied hash fragment even when the query becomes blank", () => {
    expect(
      buildSyncedListUrl(
        "/admin/items",
        new URLSearchParams("q=iron"),
        "q",
        "",
        "#top"
      )
    ).toBe("/admin/items#top");
  });
});
