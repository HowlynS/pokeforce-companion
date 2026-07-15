// Service-free unit tests for the pure shared record-name helpers used by
// the Category, Profession, and Recipe duplicate feedback. The module's
// only Prisma reference is type-level, so importing it here creates no
// database client — the is*NameTaken helpers are exercised by the guarded
// integration suite, not here.

import { describe, expect, it } from "vitest";
import {
  MAX_RECORD_NAME_LENGTH,
  normalizeRecordNameInput,
  recordNamesAreEquivalent,
} from "./record-name";

describe("normalizeRecordNameInput", () => {
  it("returns a plain name unchanged", () => {
    expect(normalizeRecordNameInput("Materials")).toBe("Materials");
  });

  it("trims surrounding whitespace but preserves inner spacing and case", () => {
    expect(normalizeRecordNameInput("  Minor Healing Tonic  ")).toBe(
      "Minor Healing Tonic"
    );
  });

  it("treats blank and whitespace-only values as empty", () => {
    expect(normalizeRecordNameInput("")).toBe("");
    expect(normalizeRecordNameInput("   \t ")).toBe("");
  });

  it("treats non-string values as empty", () => {
    expect(normalizeRecordNameInput(undefined)).toBe("");
    expect(normalizeRecordNameInput(null)).toBe("");
    expect(normalizeRecordNameInput(42)).toBe("");
  });
});

describe("recordNamesAreEquivalent", () => {
  it("matches identical names", () => {
    expect(recordNamesAreEquivalent("Materials", "Materials")).toBe(true);
  });

  it("matches across casing differences", () => {
    expect(recordNamesAreEquivalent("MATERIALS", "materials")).toBe(true);
  });

  it("matches across surrounding whitespace", () => {
    expect(recordNamesAreEquivalent("  Materials ", "Materials")).toBe(true);
  });

  it("does not match different names", () => {
    expect(recordNamesAreEquivalent("Materials", "Tools")).toBe(false);
  });

  it("never matches when either side is blank", () => {
    expect(recordNamesAreEquivalent("", "")).toBe(false);
    expect(recordNamesAreEquivalent("   ", "   ")).toBe(false);
    expect(recordNamesAreEquivalent("Materials", "")).toBe(false);
  });
});

describe("MAX_RECORD_NAME_LENGTH", () => {
  it("matches the established Item availability bound", () => {
    expect(MAX_RECORD_NAME_LENGTH).toBe(200);
  });
});
