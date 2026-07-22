import { describe, expect, it } from "vitest";
import {
  PROFESSION_CREATE_PATH,
  PROFESSION_LIST_PATH,
  normalizeProfessionSearchQuery,
  professionDeleteHref,
  professionEditHref,
  professionEditorTabs,
  professionRecipesHref,
  withProfessionSearchQuery,
} from "@/lib/admin/profession-workspace";

describe("normalizeProfessionSearchQuery", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeProfessionSearchQuery("  smithing  ")).toBe("smithing");
  });

  it("treats absent, blank, and non-string values as no query", () => {
    expect(normalizeProfessionSearchQuery(undefined)).toBe("");
    expect(normalizeProfessionSearchQuery("   ")).toBe("");
    expect(normalizeProfessionSearchQuery(["smithing", "alchemy"])).toBe("");
    expect(normalizeProfessionSearchQuery(42)).toBe("");
  });
});

describe("withProfessionSearchQuery", () => {
  it("appends the encoded query as the q parameter", () => {
    expect(withProfessionSearchQuery(PROFESSION_LIST_PATH, "smithing tools")).toBe(
      "/admin/professions?q=smithing%20tools"
    );
  });

  it("leaves the path untouched when no query is active", () => {
    expect(withProfessionSearchQuery(PROFESSION_LIST_PATH, "")).toBe(
      "/admin/professions"
    );
    expect(withProfessionSearchQuery(PROFESSION_CREATE_PATH, "")).toBe(
      "/admin/professions/new"
    );
  });

  it("encodes characters that would corrupt the URL", () => {
    expect(withProfessionSearchQuery(PROFESSION_LIST_PATH, "a&b=c")).toBe(
      "/admin/professions?q=a%26b%3Dc"
    );
  });
});

describe("profession workspace hrefs", () => {
  it("builds slug-based edit and delete routes", () => {
    expect(professionEditHref("smithing", "")).toBe(
      "/admin/professions/smithing/edit"
    );
    expect(professionDeleteHref("smithing", "")).toBe(
      "/admin/professions/smithing/delete"
    );
  });

  it("preserves the active query for quick switching and deletion", () => {
    expect(professionEditHref("smithing", "smith")).toBe(
      "/admin/professions/smithing/edit?q=smith"
    );
    expect(professionDeleteHref("smithing", "smith")).toBe(
      "/admin/professions/smithing/delete?q=smith"
    );
  });

  it("builds the Recipes tab route, preserving the query", () => {
    expect(professionRecipesHref("smithing", "")).toBe(
      "/admin/professions/smithing/recipes"
    );
    expect(professionRecipesHref("smithing", "smith")).toBe(
      "/admin/professions/smithing/recipes?q=smith"
    );
  });
});

describe("professionEditorTabs", () => {
  it("marks General active and links every other tab as a real destination", () => {
    const tabs = professionEditorTabs("smithing", "", "general");

    expect(tabs).toEqual([
      {
        label: "General",
        href: "/admin/professions/smithing/edit",
        active: true,
      },
      {
        label: "Recipes",
        href: "/admin/professions/smithing/recipes",
        active: false,
      },
    ]);
  });

  it("marks Recipes active when that is the current tab", () => {
    const tabs = professionEditorTabs("smithing", "iron", "recipes");

    expect(tabs[0]).toEqual({
      label: "General",
      href: "/admin/professions/smithing/edit?q=iron",
      active: false,
    });
    expect(tabs[1]).toEqual({
      label: "Recipes",
      href: "/admin/professions/smithing/recipes?q=iron",
      active: true,
    });
  });

  it("preserves the query on every tab's own href", () => {
    const tabs = professionEditorTabs("smithing", "smith", "general");

    expect(tabs[0].href).toBe("/admin/professions/smithing/edit?q=smith");
    expect(tabs[1].href).toBe("/admin/professions/smithing/recipes?q=smith");
  });

  it("marks exactly one tab active for every valid key", () => {
    for (const active of ["general", "recipes"] as const) {
      const tabs = professionEditorTabs("smithing", "", active);
      expect(tabs.filter((tab) => tab.active)).toHaveLength(1);
    }
  });

  it("renders no disabled tabs — every Profession tab is now a real destination", () => {
    for (const active of ["general", "recipes"] as const) {
      const tabs = professionEditorTabs("smithing", "", active);
      expect(tabs.every((tab) => !tab.disabled)).toBe(true);
      expect(tabs.every((tab) => tab.href !== "")).toBe(true);
    }
  });

  describe("relationship-count badges", () => {
    it("omits count entirely when no counts are supplied", () => {
      const tabs = professionEditorTabs("smithing", "", "general");

      expect(tabs[0].count).toBeUndefined();
      expect(tabs[1].count).toBeUndefined();
    });

    it("threads the recipe count onto the Recipes tab only, never General", () => {
      const tabs = professionEditorTabs("smithing", "", "general", {
        recipes: 4,
      });

      expect(tabs[0].count).toBeUndefined();
      expect(tabs[1].count).toBe(4);
    });

    it("preserves an explicit zero count rather than treating it as absent", () => {
      const tabs = professionEditorTabs("smithing", "", "recipes", {
        recipes: 0,
      });

      expect(tabs[1].count).toBe(0);
    });
  });
});
