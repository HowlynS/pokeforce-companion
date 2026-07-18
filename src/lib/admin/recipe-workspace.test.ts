import { describe, expect, it } from "vitest";
import {
  RECIPE_CREATE_PATH,
  RECIPE_LIST_PATH,
  normalizeRecipeSearchQuery,
  recipeDeleteHref,
  recipeEditHref,
  recipeEditorTabs,
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

describe("recipeEditorTabs", () => {
  it("marks General active as the only real destination, with Ingredients and Metadata disabled", () => {
    const tabs = recipeEditorTabs("iron-sword", "");

    expect(tabs).toEqual([
      { label: "General", href: "/admin/recipes/iron-sword/edit", active: true },
      { label: "Ingredients", href: "", active: false, disabled: true },
      { label: "Metadata", href: "", active: false, disabled: true },
    ]);
  });

  it("preserves the query on the General tab's own href", () => {
    const tabs = recipeEditorTabs("iron-sword", "iron");

    expect(tabs[0]).toEqual({
      label: "General",
      href: "/admin/recipes/iron-sword/edit?q=iron",
      active: true,
    });
  });

  it("marks exactly one tab active", () => {
    const tabs = recipeEditorTabs("iron-sword", "");
    expect(tabs.filter((tab) => tab.active)).toHaveLength(1);
  });

  it("never renders Ingredients or Metadata as real links", () => {
    const tabs = recipeEditorTabs("iron-sword", "");
    const deferred = tabs.slice(1);

    expect(deferred.every((tab) => tab.disabled)).toBe(true);
    expect(deferred.every((tab) => tab.href === "")).toBe(true);
  });
});
