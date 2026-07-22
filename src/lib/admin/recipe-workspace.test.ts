import { describe, expect, it } from "vitest";
import {
  RECIPE_CREATE_PATH,
  RECIPE_LIST_PATH,
  normalizeRecipeSearchQuery,
  recipeDeleteHref,
  recipeEditHref,
  recipeEditorTabs,
  recipeIngredientsHref,
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

  it("builds the Ingredients tab route, preserving the query", () => {
    expect(recipeIngredientsHref("iron-sword", "")).toBe(
      "/admin/recipes/iron-sword/ingredients"
    );
    expect(recipeIngredientsHref("iron-sword", "iron")).toBe(
      "/admin/recipes/iron-sword/ingredients?q=iron"
    );
  });
});

describe("recipeEditorTabs", () => {
  it("marks General active and links Ingredients as a real tab", () => {
    const tabs = recipeEditorTabs("iron-sword", "", "general");

    expect(tabs).toEqual([
      { label: "General", href: "/admin/recipes/iron-sword/edit", active: true },
      {
        label: "Ingredients",
        href: "/admin/recipes/iron-sword/ingredients",
        active: false,
      },
    ]);
  });

  it("marks Ingredients active when that is the current tab", () => {
    const tabs = recipeEditorTabs("iron-sword", "iron", "ingredients");

    expect(tabs[1]).toEqual({
      label: "Ingredients",
      href: "/admin/recipes/iron-sword/ingredients?q=iron",
      active: true,
    });
    expect(tabs[0].active).toBe(false);
  });

  it("preserves the query on each real tab's own href", () => {
    const tabs = recipeEditorTabs("iron-sword", "iron", "general");

    expect(tabs[0]).toEqual({
      label: "General",
      href: "/admin/recipes/iron-sword/edit?q=iron",
      active: true,
    });
    expect(tabs[1].href).toBe("/admin/recipes/iron-sword/ingredients?q=iron");
  });

  it("marks exactly one tab active for every valid key", () => {
    for (const active of ["general", "ingredients"] as const) {
      const tabs = recipeEditorTabs("iron-sword", "", active);
      expect(tabs.filter((tab) => tab.active)).toHaveLength(1);
    }
  });

  it("never renders any Recipe tab as disabled", () => {
    for (const active of ["general", "ingredients"] as const) {
      const tabs = recipeEditorTabs("iron-sword", "", active);

      expect(tabs.every((tab) => !tab.disabled)).toBe(true);
      expect(tabs.every((tab) => tab.href !== "")).toBe(true);
    }
  });

  describe("relationship-count badges", () => {
    it("omits count entirely when no counts are supplied", () => {
      const tabs = recipeEditorTabs("iron-sword", "", "general");

      expect(tabs[0].count).toBeUndefined();
      expect(tabs[1].count).toBeUndefined();
    });

    it("threads the ingredient count onto the Ingredients tab only, never General", () => {
      const tabs = recipeEditorTabs("iron-sword", "", "general", {
        ingredients: 5,
      });

      expect(tabs[0].count).toBeUndefined();
      expect(tabs[1].count).toBe(5);
    });

    it("preserves an explicit zero count rather than treating it as absent", () => {
      const tabs = recipeEditorTabs("iron-sword", "", "ingredients", {
        ingredients: 0,
      });

      expect(tabs[1].count).toBe(0);
    });
  });
});
