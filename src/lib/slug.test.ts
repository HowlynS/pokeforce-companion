import { describe, expect, it } from "vitest";
import { SLUG_PATTERN, normalizeSlug } from "@/lib/slug";

describe("normalizeSlug", () => {
  it("lowercases and hyphenates a standard two-word name", () => {
    expect(normalizeSlug("Iron Sword")).toBe("iron-sword");
  });

  it("trims leading and trailing spaces", () => {
    expect(normalizeSlug("  Stamina Brew  ")).toBe("stamina-brew");
  });

  it("collapses repeated internal spaces into a single hyphen", () => {
    expect(normalizeSlug("  Stamina   Brew ")).toBe("stamina-brew");
  });

  it("collapses punctuation runs into a single hyphen", () => {
    expect(normalizeSlug("Smith's   Hammer!!")).toBe("smith-s-hammer");
  });

  it("collapses already-repeated separators rather than doubling them", () => {
    expect(normalizeSlug("Iron---Sword")).toBe("iron-sword");
  });

  it("is case-insensitive regardless of input capitalization", () => {
    expect(normalizeSlug("IRON SWORD")).toBe("iron-sword");
    expect(normalizeSlug("iRoN sWoRd")).toBe("iron-sword");
  });

  it("returns an empty string for empty input", () => {
    expect(normalizeSlug("")).toBe("");
  });

  it("returns an empty string when every character is stripped away", () => {
    expect(normalizeSlug("!!!")).toBe("");
    expect(normalizeSlug("   ")).toBe("");
  });

  it("keeps digits", () => {
    expect(normalizeSlug("Potion Mk2")).toBe("potion-mk2");
  });

  it("strips accented/non-ASCII characters rather than transliterating them, matching the project's established (pre-existing) policy", () => {
    // Every one of the five original per-resource normalizeSlug
    // implementations already used this exact [^a-z0-9]+ rule, treating
    // accented letters as "not a-z0-9" and collapsing them away like any
    // other punctuation — this test pins that pre-existing behavior
    // unchanged after the extraction, rather than silently changing it.
    expect(normalizeSlug("Café Ole")).toBe("caf-ole");
  });

  it("always produces a value matching SLUG_PATTERN, or an empty string", () => {
    const samples = [
      "Iron Sword",
      "  Stamina   Brew ",
      "Smith's Hammer",
      "!!!",
      "Potion Mk2",
      "Café Ole",
      "a",
      "---",
    ];

    for (const sample of samples) {
      const result = normalizeSlug(sample);
      expect(result === "" || SLUG_PATTERN.test(result)).toBe(true);
    }
  });
});
