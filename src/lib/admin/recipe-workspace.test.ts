import { describe, expect, it } from "vitest";
import {
  RECIPE_CREATE_PATH,
  RECIPE_LIST_PATH,
  normalizeRecipeSearchQuery,
  recipeDeleteHref,
  recipeEditHref,
  withRecipeSearchQuery,
} from "@/lib/admin/recipe-workspace";

describe("normalizeRecipeSearchQuery", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeRecipeSearchQuery("  iron sword  ")).toBe("iron sword");
  });

  it("treats absent, blank, and non-string values as no query", () => {
    expect(normalizeRecipeSearchQuery(undefined)).toBe("");
    expect(normalizeRecipeSearchQuery("   ")).toBe("");
    expect(normalizeRecipeSearchQuery(["iron", "sword"])).toBe("");
    expect(normalizeRecipeSearchQuery(42)).toBe("");
  });
});

describe("withRecipeSearchQuery", () => {
  it("appends the encoded query as the q parameter", () => {
    expect(withRecipeSearchQuery(RECIPE_LIST_PATH, "iron sword")).toBe(
      "/admin/recipes?q=iron%20sword"
    );
  });

  it("leaves the path untouched when no query is active", () => {
    expect(withRecipeSearchQuery(RECIPE_LIST_PATH, "")).toBe("/admin/recipes");
    expect(withRecipeSearchQuery(RECIPE_CREATE_PATH, "")).toBe(
      "/admin/recipes/new"
    );
  });

  it("encodes characters that would corrupt the URL", () => {
    expect(withRecipeSearchQuery(RECIPE_LIST_PATH, "a&b=c")).toBe(
      "/admin/recipes?q=a%26b%3Dc"
    );
  });
});

describe("recipe workspace hrefs", () => {
  it("builds slug-based edit and delete routes", () => {
    expect(recipeEditHref("iron-sword", "")).toBe(
      "/admin/recipes/iron-sword/edit"
    );
    expect(recipeDeleteHref("iron-sword", "")).toBe(
      "/admin/recipes/iron-sword/delete"
    );
  });

  it("preserves the active query for quick switching and deletion", () => {
    expect(recipeEditHref("iron-sword", "iron")).toBe(
      "/admin/recipes/iron-sword/edit?q=iron"
    );
    expect(recipeDeleteHref("iron-sword", "iron")).toBe(
      "/admin/recipes/iron-sword/delete?q=iron"
    );
  });
});
