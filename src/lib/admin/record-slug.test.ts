// Service-free unit tests for the pure shared record-slug helpers. The
// module's only Prisma reference is type-level, so importing it here
// creates no database client — the is*SlugTaken helpers are exercised by
// the guarded integration suite, not here (mirroring record-name.test.ts's
// own established split).

import { describe, expect, it } from "vitest";
import {
  MAX_RECORD_SLUG_LENGTH,
  normalizeRecordSlugCandidate,
} from "./record-slug";

describe("normalizeRecordSlugCandidate", () => {
  it("applies the canonical slug rule (lowercase, hyphenated)", () => {
    expect(normalizeRecordSlugCandidate("Iron Sword")).toBe("iron-sword");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeRecordSlugCandidate("  iron-sword  ")).toBe("iron-sword");
  });

  it("collapses punctuation and repeated separators", () => {
    expect(normalizeRecordSlugCandidate("Iron---Sword!!")).toBe("iron-sword");
  });

  it("treats blank and whitespace-only values as empty", () => {
    expect(normalizeRecordSlugCandidate("")).toBe("");
    expect(normalizeRecordSlugCandidate("   ")).toBe("");
  });

  it("treats non-string values as empty", () => {
    expect(normalizeRecordSlugCandidate(undefined)).toBe("");
    expect(normalizeRecordSlugCandidate(null)).toBe("");
    expect(normalizeRecordSlugCandidate(42)).toBe("");
  });

  it("returns empty for input that normalizes away entirely", () => {
    expect(normalizeRecordSlugCandidate("!!!")).toBe("");
  });
});

describe("MAX_RECORD_SLUG_LENGTH", () => {
  it("matches the established Name availability bound", () => {
    expect(MAX_RECORD_SLUG_LENGTH).toBe(200);
  });
});
