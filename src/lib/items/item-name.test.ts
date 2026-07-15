// Service-free unit tests for the pure Item-name helpers. The module's only
// Prisma reference is type-level, so importing it here creates no database
// client — isItemNameTaken itself is exercised by the guarded integration
// suite, not here.

import { describe, expect, it } from "vitest";
import {
  MAX_ITEM_NAME_LENGTH,
  itemNamesAreEquivalent,
  normalizeItemNameInput,
} from "./item-name";

describe("normalizeItemNameInput", () => {
  it("returns a plain name unchanged", () => {
    expect(normalizeItemNameInput("Iron Ore")).toBe("Iron Ore");
  });

  it("trims surrounding whitespace but preserves inner spacing and case", () => {
    expect(normalizeItemNameInput("  Iron Ore  ")).toBe("Iron Ore");
  });

  it("treats blank and whitespace-only values as empty", () => {
    expect(normalizeItemNameInput("")).toBe("");
    expect(normalizeItemNameInput("   \t ")).toBe("");
  });

  it("treats non-string values as empty", () => {
    expect(normalizeItemNameInput(undefined)).toBe("");
    expect(normalizeItemNameInput(null)).toBe("");
    expect(normalizeItemNameInput(42)).toBe("");
  });
});

describe("itemNamesAreEquivalent", () => {
  it("matches identical names", () => {
    expect(itemNamesAreEquivalent("Iron Ore", "Iron Ore")).toBe(true);
  });

  it("matches across casing differences", () => {
    expect(itemNamesAreEquivalent("IRON ORE", "iron ore")).toBe(true);
  });

  it("matches across surrounding whitespace", () => {
    expect(itemNamesAreEquivalent("  Iron Ore ", "Iron Ore")).toBe(true);
  });

  it("does not match different names", () => {
    expect(itemNamesAreEquivalent("Iron Ore", "Copper Ore")).toBe(false);
  });

  it("never matches when either side is blank", () => {
    expect(itemNamesAreEquivalent("", "")).toBe(false);
    expect(itemNamesAreEquivalent("   ", "   ")).toBe(false);
    expect(itemNamesAreEquivalent("Iron Ore", "")).toBe(false);
  });
});

describe("MAX_ITEM_NAME_LENGTH", () => {
  it("is a generous but finite availability-input bound", () => {
    expect(MAX_ITEM_NAME_LENGTH).toBe(200);
  });
});
