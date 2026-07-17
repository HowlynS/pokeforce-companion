import { describe, expect, it } from "vitest";
import {
  ITEM_CREATE_PATH,
  ITEM_LIST_PATH,
  itemDeleteHref,
  itemEditHref,
  itemEditorTabs,
  itemSourceDeleteHref,
  itemSourceEditHref,
  itemSourcesHref,
  itemUsedInRecipesHref,
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

  it("builds the Acquisition Sources tab route, preserving the query", () => {
    expect(itemSourcesHref("iron-ore", "")).toBe(
      "/admin/items/iron-ore/sources"
    );
    expect(itemSourcesHref("iron-ore", "iron")).toBe(
      "/admin/items/iron-ore/sources?q=iron"
    );
  });

  it("builds source edit/delete routes, preserving the query", () => {
    expect(itemSourceEditHref("iron-ore", "src-1", "")).toBe(
      "/admin/items/iron-ore/sources/src-1/edit"
    );
    expect(itemSourceEditHref("iron-ore", "src-1", "iron")).toBe(
      "/admin/items/iron-ore/sources/src-1/edit?q=iron"
    );
    expect(itemSourceDeleteHref("iron-ore", "src-1", "")).toBe(
      "/admin/items/iron-ore/sources/src-1/delete"
    );
    expect(itemSourceDeleteHref("iron-ore", "src-1", "iron")).toBe(
      "/admin/items/iron-ore/sources/src-1/delete?q=iron"
    );
  });

  it("builds the Used in Recipes tab route, preserving the query", () => {
    expect(itemUsedInRecipesHref("iron-ore", "")).toBe(
      "/admin/items/iron-ore/recipes"
    );
    expect(itemUsedInRecipesHref("iron-ore", "iron")).toBe(
      "/admin/items/iron-ore/recipes?q=iron"
    );
  });
});

describe("itemEditorTabs", () => {
  it("marks General active and links Acquisition Sources and Used in Recipes as real tabs", () => {
    const tabs = itemEditorTabs("iron-ore", "", "general");

    expect(tabs).toEqual([
      { label: "General", href: "/admin/items/iron-ore/edit", active: true },
      {
        label: "Acquisition Sources",
        href: "/admin/items/iron-ore/sources",
        active: false,
      },
      {
        label: "Used in Recipes",
        href: "/admin/items/iron-ore/recipes",
        active: false,
      },
      { label: "Metadata", href: "", active: false, disabled: true },
    ]);
  });

  it("marks Acquisition Sources active when that is the current tab", () => {
    const tabs = itemEditorTabs("iron-ore", "iron", "sources");

    expect(tabs[0]).toEqual({
      label: "General",
      href: "/admin/items/iron-ore/edit?q=iron",
      active: false,
    });
    expect(tabs[1]).toEqual({
      label: "Acquisition Sources",
      href: "/admin/items/iron-ore/sources?q=iron",
      active: true,
    });
  });

  it("marks Used in Recipes active when that is the current tab", () => {
    const tabs = itemEditorTabs("iron-ore", "iron", "recipes");

    expect(tabs[2]).toEqual({
      label: "Used in Recipes",
      href: "/admin/items/iron-ore/recipes?q=iron",
      active: true,
    });
    expect(tabs[0].active).toBe(false);
    expect(tabs[1].active).toBe(false);
  });

  it("always renders Metadata as a disabled placeholder", () => {
    for (const active of ["general", "sources", "recipes"] as const) {
      const tabs = itemEditorTabs("iron-ore", "", active);

      expect(tabs[3]).toEqual({
        label: "Metadata",
        href: "",
        active: false,
        disabled: true,
      });
    }
  });

  it("marks exactly one tab active for every valid key", () => {
    for (const active of ["general", "sources", "recipes"] as const) {
      const tabs = itemEditorTabs("iron-ore", "", active);
      expect(tabs.filter((tab) => tab.active)).toHaveLength(1);
    }
  });
});
