import { describe, expect, it } from "vitest";
import {
  cataloguePageHref,
  readCatalogueQueryValue,
  resolveCataloguePage,
} from "@/lib/catalogue-query";

describe("public catalogue query state", () => {
  it("normalizes scalar and repeated query values", () => {
    expect(readCatalogueQueryValue(undefined)).toBeUndefined();
    expect(readCatalogueQueryValue("  tools ")).toBe("tools");
    expect(readCatalogueQueryValue(["smithing", "cooking"])).toBe("smithing");
  });

  it("clamps pagination against the active result count", () => {
    expect(resolveCataloguePage("3", 25, 12)).toEqual({
      currentPage: 3,
      pageCount: 3,
      skip: 24,
    });
    expect(resolveCataloguePage("-1", 25, 12)).toEqual({
      currentPage: 1,
      pageCount: 3,
      skip: 0,
    });
  });

  it("keeps page one canonical while retaining active filters", () => {
    expect(cataloguePageHref("/items", 1)).toBe("/items");
    expect(cataloguePageHref("/items", 1, { category: "tools" })).toBe(
      "/items?category=tools"
    );
    expect(cataloguePageHref("/items", 2, { category: "tools" })).toBe(
      "/items?category=tools&page=2"
    );
  });
});
