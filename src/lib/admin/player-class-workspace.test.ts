import { describe, expect, it } from "vitest";
import {
  PLAYER_CLASS_CREATE_PATH,
  PLAYER_CLASS_LIST_PATH,
  normalizePlayerClassSearchQuery,
  playerClassDeleteHref,
  playerClassEditHref,
  playerClassEditorTabs,
  withPlayerClassSearchQuery,
} from "@/lib/admin/player-class-workspace";

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
  it("appends an encoded query and leaves blank queries clean", () => {
    expect(
      withPlayerClassSearchQuery(PLAYER_CLASS_LIST_PATH, "field craft")
    ).toBe("/admin/classes?q=field%20craft");
    expect(withPlayerClassSearchQuery(PLAYER_CLASS_CREATE_PATH, "")).toBe(
      "/admin/classes/new"
    );
  });
});

describe("player class workspace hrefs", () => {
  it("builds slug-based edit and delete routes while preserving search", () => {
    expect(playerClassEditHref("artisan", "art")).toBe(
      "/admin/classes/artisan/edit?q=art"
    );
    expect(playerClassDeleteHref("artisan", "art")).toBe(
      "/admin/classes/artisan/delete?q=art"
    );
  });
});

describe("playerClassEditorTabs", () => {
  it("exposes only the independent resource's General tab", () => {
    expect(playerClassEditorTabs("artisan", "art", "general")).toEqual([
      {
        label: "General",
        href: "/admin/classes/artisan/edit?q=art",
        active: true,
      },
    ]);
  });
});
