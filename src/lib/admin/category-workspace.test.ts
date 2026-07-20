import { describe, expect, it } from "vitest";
import {
  CATEGORY_CREATE_PATH,
  CATEGORY_LIST_PATH,
  categoryDeleteHref,
  categoryEditHref,
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
});
