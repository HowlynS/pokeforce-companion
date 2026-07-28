import { describe, expect, it } from "vitest";
import {
  PLAYER_CLASS_CREATE_PATH,
  PLAYER_CLASS_LIST_PATH,
  describeLinkedRecipes,
  normalizePlayerClassSearchQuery,
  playerClassCanDelete,
  playerClassDeleteHref,
  playerClassEditHref,
  playerClassEditorTabs,
  playerClassRecipesHref,
  withPlayerClassSearchQuery,
} from "@/lib/admin/player-class-workspace";

// Shared between the dedicated /delete route and the in-editor delete
// dialog — pinned here so the two surfaces can never silently drift apart.
describe("playerClassCanDelete", () => {
  it("allows deletion when no recipe references the player class", () => {
    expect(playerClassCanDelete(0)).toBe(true);
  });

  it("blocks deletion when at least one recipe references the player class", () => {
    expect(playerClassCanDelete(1)).toBe(false);
    expect(playerClassCanDelete(4)).toBe(false);
  });
});

describe("describeLinkedRecipes", () => {
  it("uses singular phrasing for exactly one recipe", () => {
    expect(describeLinkedRecipes(1)).toBe("1 recipe");
  });

  it("uses plural phrasing for zero or more than one recipe", () => {
    expect(describeLinkedRecipes(0)).toBe("0 recipes");
    expect(describeLinkedRecipes(5)).toBe("5 recipes");
  });
});

describe("normalizePlayerClassSearchQuery", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizePlayerClassSearchQuery("  artisan  ")).toBe("artisan");
  });

  it("treats absent, blank, and non-string values as no query", () => {
    expect(normalizePlayerClassSearchQuery(undefined)).toBe("");
    expect(normalizePlayerClassSearchQuery("   ")).toBe("");
    expect(normalizePlayerClassSearchQuery(["artisan", "ranger"])).toBe("");
    expect(normalizePlayerClassSearchQuery(42)).toBe("");
  });
});

describe("withPlayerClassSearchQuery", () => {
  it("appends the encoded query as the q parameter", () => {
    expect(
      withPlayerClassSearchQuery(PLAYER_CLASS_LIST_PATH, "field craft")
    ).toBe("/admin/classes?q=field%20craft");
  });

  it("leaves the path untouched when no query is active", () => {
    expect(withPlayerClassSearchQuery(PLAYER_CLASS_LIST_PATH, "")).toBe(
      "/admin/classes"
    );
    expect(withPlayerClassSearchQuery(PLAYER_CLASS_CREATE_PATH, "")).toBe(
      "/admin/classes/new"
    );
  });

  it("encodes characters that would corrupt the URL", () => {
    expect(withPlayerClassSearchQuery(PLAYER_CLASS_LIST_PATH, "a&b=c")).toBe(
      "/admin/classes?q=a%26b%3Dc"
    );
  });
});

describe("player class workspace hrefs", () => {
  it("builds slug-based edit and delete routes", () => {
    expect(playerClassEditHref("artisan", "")).toBe(
      "/admin/classes/artisan/edit"
    );
    expect(playerClassDeleteHref("artisan", "")).toBe(
      "/admin/classes/artisan/delete"
    );
  });

  it("preserves the active query for quick switching and deletion", () => {
    expect(playerClassEditHref("artisan", "art")).toBe(
      "/admin/classes/artisan/edit?q=art"
    );
    expect(playerClassDeleteHref("artisan", "art")).toBe(
      "/admin/classes/artisan/delete?q=art"
    );
  });

  it("builds the Recipes tab route, preserving the query", () => {
    expect(playerClassRecipesHref("artisan", "")).toBe(
      "/admin/classes/artisan/recipes"
    );
    expect(playerClassRecipesHref("artisan", "art")).toBe(
      "/admin/classes/artisan/recipes?q=art"
    );
  });
});

describe("playerClassEditorTabs", () => {
  it("marks General active and links every other tab as a real destination", () => {
    const tabs = playerClassEditorTabs("artisan", "", "general");

    expect(tabs).toEqual([
      {
        label: "General",
        href: "/admin/classes/artisan/edit",
        active: true,
      },
      {
        label: "Recipes",
        href: "/admin/classes/artisan/recipes",
        active: false,
      },
    ]);
  });

  it("marks Recipes active when that is the current tab", () => {
    const tabs = playerClassEditorTabs("artisan", "iron", "recipes");

    expect(tabs[0]).toEqual({
      label: "General",
      href: "/admin/classes/artisan/edit?q=iron",
      active: false,
    });
    expect(tabs[1]).toEqual({
      label: "Recipes",
      href: "/admin/classes/artisan/recipes?q=iron",
      active: true,
    });
  });

  it("preserves the query on every tab's own href", () => {
    const tabs = playerClassEditorTabs("artisan", "art", "general");

    expect(tabs[0].href).toBe("/admin/classes/artisan/edit?q=art");
    expect(tabs[1].href).toBe("/admin/classes/artisan/recipes?q=art");
  });

  it("marks exactly one tab active for every valid key", () => {
    for (const active of ["general", "recipes"] as const) {
      const tabs = playerClassEditorTabs("artisan", "", active);
      expect(tabs.filter((tab) => tab.active)).toHaveLength(1);
    }
  });

  it("renders no disabled tabs — every Player Class tab is a real destination", () => {
    for (const active of ["general", "recipes"] as const) {
      const tabs = playerClassEditorTabs("artisan", "", active);
      expect(tabs.every((tab) => !tab.disabled)).toBe(true);
      expect(tabs.every((tab) => tab.href !== "")).toBe(true);
    }
  });

  describe("relationship-count badges", () => {
    it("omits count entirely when no counts are supplied", () => {
      const tabs = playerClassEditorTabs("artisan", "", "general");

      expect(tabs[0].count).toBeUndefined();
      expect(tabs[1].count).toBeUndefined();
    });

    it("threads the recipe count onto the Recipes tab only, never General", () => {
      const tabs = playerClassEditorTabs("artisan", "", "general", {
        recipes: 4,
      });

      expect(tabs[0].count).toBeUndefined();
      expect(tabs[1].count).toBe(4);
    });

    it("preserves an explicit zero count rather than treating it as absent", () => {
      const tabs = playerClassEditorTabs("artisan", "", "recipes", {
        recipes: 0,
      });

      expect(tabs[1].count).toBe(0);
    });
  });
});
