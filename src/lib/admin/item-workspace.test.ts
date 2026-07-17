import { describe, expect, it } from "vitest";
import {
  ITEM_CREATE_PATH,
  ITEM_LIST_PATH,
  itemDeleteHref,
  itemEditHref,
  normalizeItemSearchQuery,
  withItemSearchQuery,
} from "@/lib/admin/item-workspace";

describe("normalizeItemSearchQuery", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeItemSearchQuery("  iron ore  ")).toBe("iron ore");
  });

  it("treats absent, blank, and non-string values as no query", () => {
    expect(normalizeItemSearchQuery(undefined)).toBe("");
    expect(normalizeItemSearchQuery("   ")).toBe("");
    expect(normalizeItemSearchQuery(["iron", "ore"])).toBe("");
    expect(normalizeItemSearchQuery(42)).toBe("");
  });
});

describe("withItemSearchQuery", () => {
  it("appends the encoded query as the q parameter", () => {
    expect(withItemSearchQuery(ITEM_LIST_PATH, "iron ore")).toBe(
      "/admin/items?q=iron%20ore"
    );
  });

  it("leaves the path untouched when no query is active", () => {
    expect(withItemSearchQuery(ITEM_LIST_PATH, "")).toBe("/admin/items");
    expect(withItemSearchQuery(ITEM_CREATE_PATH, "")).toBe("/admin/items/new");
  });

  it("encodes characters that would corrupt the URL", () => {
    expect(withItemSearchQuery(ITEM_LIST_PATH, "a&b=c")).toBe(
      "/admin/items?q=a%26b%3Dc"
    );
  });
});

describe("item workspace hrefs", () => {
  it("builds slug-based edit and delete routes", () => {
    expect(itemEditHref("iron-ore", "")).toBe("/admin/items/iron-ore/edit");
    expect(itemDeleteHref("iron-ore", "")).toBe("/admin/items/iron-ore/delete");
  });

  it("preserves the active query for quick switching and deletion", () => {
    expect(itemEditHref("iron-ore", "iron")).toBe(
      "/admin/items/iron-ore/edit?q=iron"
    );
    expect(itemDeleteHref("iron-ore", "iron")).toBe(
      "/admin/items/iron-ore/delete?q=iron"
    );
  });
});
