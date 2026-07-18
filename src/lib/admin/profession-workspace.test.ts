import { describe, expect, it } from "vitest";
import {
  PROFESSION_CREATE_PATH,
  PROFESSION_LIST_PATH,
  normalizeProfessionSearchQuery,
  professionDeleteHref,
  professionEditHref,
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
});
