import { describe, expect, it } from "vitest";
import {
  CATEGORY_CREATE_PATH,
  CATEGORY_LIST_PATH,
  categoryDeleteHref,
  categoryEditHref,
  categoryEditorTabs,
  categoryItemsHref,
  normalizeCategorySearchQuery,
  withCategorySearchQuery,
} from "@/lib/admin/category-workspace";

describe("normalizeCategorySearchQuery", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeCategorySearchQuery("  materials  ")).toBe("materials");
  });

  it("treats absent, blank, and non-string values as no query", () => {
    expect(normalizeCategorySearchQuery(undefined)).toBe("");
    expect(normalizeCategorySearchQuery("   ")).toBe("");
    expect(normalizeCategorySearchQuery(["materials", "tools"])).toBe("");
    expect(normalizeCategorySearchQuery(42)).toBe("");
  });
});

describe("withCategorySearchQuery", () => {
  it("appends the encoded query as the q parameter", () => {
    expect(withCategorySearchQuery(CATEGORY_LIST_PATH, "crafting materials")).toBe(
      "/admin/categories?q=crafting%20materials"
    );
  });

  it("leaves the path untouched when no query is active", () => {
    expect(withCategorySearchQuery(CATEGORY_LIST_PATH, "")).toBe(
      "/admin/categories"
    );
    expect(withCategorySearchQuery(CATEGORY_CREATE_PATH, "")).toBe(
      "/admin/categories/new"
    );
  });

  it("encodes characters that would corrupt the URL", () => {
    expect(withCategorySearchQuery(CATEGORY_LIST_PATH, "a&b=c")).toBe(
      "/admin/categories?q=a%26b%3Dc"
    );
  });
});

describe("category workspace hrefs", () => {
  it("builds slug-based edit and delete routes", () => {
    expect(categoryEditHref("materials", "")).toBe(
      "/admin/categories/materials/edit"
    );
    expect(categoryDeleteHref("materials", "")).toBe(
      "/admin/categories/materials/delete"
    );
  });

  it("preserves the active query for quick switching and deletion", () => {
    expect(categoryEditHref("materials", "mat")).toBe(
      "/admin/categories/materials/edit?q=mat"
    );
    expect(categoryDeleteHref("materials", "mat")).toBe(
      "/admin/categories/materials/delete?q=mat"
    );
  });

  it("builds the Items tab route, preserving the query", () => {
    expect(categoryItemsHref("materials", "")).toBe(
      "/admin/categories/materials/items"
    );
    expect(categoryItemsHref("materials", "mat")).toBe(
      "/admin/categories/materials/items?q=mat"
    );
  });
});

describe("categoryEditorTabs", () => {
  it("marks General active and links every other tab as a real destination", () => {
    const tabs = categoryEditorTabs("materials", "", "general");

    expect(tabs).toEqual([
      {
        label: "General",
        href: "/admin/categories/materials/edit",
        active: true,
      },
      {
        label: "Items",
        href: "/admin/categories/materials/items",
        active: false,
      },
    ]);
  });

  it("marks Items active when that is the current tab", () => {
    const tabs = categoryEditorTabs("materials", "mat", "items");

    expect(tabs[0]).toEqual({
      label: "General",
      href: "/admin/categories/materials/edit?q=mat",
      active: false,
    });
    expect(tabs[1]).toEqual({
      label: "Items",
      href: "/admin/categories/materials/items?q=mat",
      active: true,
    });
  });

  it("preserves the query on every tab's own href", () => {
    const tabs = categoryEditorTabs("materials", "mat", "general");

    expect(tabs[0].href).toBe("/admin/categories/materials/edit?q=mat");
    expect(tabs[1].href).toBe("/admin/categories/materials/items?q=mat");
  });

  it("marks exactly one tab active for every valid key", () => {
    for (const active of ["general", "items"] as const) {
      const tabs = categoryEditorTabs("materials", "", active);
      expect(tabs.filter((tab) => tab.active)).toHaveLength(1);
    }
  });

  it("renders no disabled tabs — every Category tab is now a real destination", () => {
    for (const active of ["general", "items"] as const) {
      const tabs = categoryEditorTabs("materials", "", active);
      expect(tabs.every((tab) => !tab.disabled)).toBe(true);
      expect(tabs.every((tab) => tab.href !== "")).toBe(true);
    }
  });

  describe("relationship-count badges", () => {
    it("omits count entirely when no counts are supplied", () => {
      const tabs = categoryEditorTabs("materials", "", "general");

      expect(tabs[0].count).toBeUndefined();
      expect(tabs[1].count).toBeUndefined();
    });

    it("threads the item count onto the Items tab only, never General", () => {
      const tabs = categoryEditorTabs("materials", "", "general", {
        items: 12,
      });

      expect(tabs[0].count).toBeUndefined();
      expect(tabs[1].count).toBe(12);
    });

    it("preserves an explicit zero count rather than treating it as absent", () => {
      const tabs = categoryEditorTabs("materials", "", "items", { items: 0 });

      expect(tabs[1].count).toBe(0);
    });
  });
});
