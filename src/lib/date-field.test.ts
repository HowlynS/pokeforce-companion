import { describe, expect, it } from "vitest";
import { formatIsoToDateEntryText, parseDateEntryText } from "./date-field";

describe("parseDateEntryText", () => {
  it("parses '05 Sep 2026' to '2026-09-05'", () => {
    expect(parseDateEntryText("05 Sep 2026")).toEqual({
      ok: true,
      iso: "2026-09-05",
    });
  });

  it("parses '24 Jun 2026' to '2026-06-24'", () => {
    expect(parseDateEntryText("24 Jun 2026")).toEqual({
      ok: true,
      iso: "2026-06-24",
    });
  });

  it("accepts a valid leap-year date (29 Feb 2028)", () => {
    expect(parseDateEntryText("29 Feb 2028")).toEqual({
      ok: true,
      iso: "2028-02-29",
    });
  });

  it("rejects 29 Feb in a non-leap year (invalid day)", () => {
    expect(parseDateEntryText("29 Feb 2026")).toEqual({ ok: false });
  });

  it("rejects an invalid day (31 Feb)", () => {
    expect(parseDateEntryText("31 Feb 2026")).toEqual({ ok: false });
  });

  it("rejects invalid month text", () => {
    expect(parseDateEntryText("05 Xyz 2026")).toEqual({ ok: false });
  });

  it("rejects an impossible date (31 Apr — April has 30 days)", () => {
    expect(parseDateEntryText("31 Apr 2026")).toEqual({ ok: false });
  });

  it("treats a blank value as valid and optional (no date)", () => {
    expect(parseDateEntryText("")).toEqual({ ok: true, iso: null });
    expect(parseDateEntryText("   ")).toEqual({ ok: true, iso: null });
  });

  it("normalizes month capitalization (lowercase and uppercase both accepted)", () => {
    expect(parseDateEntryText("05 sep 2026")).toEqual({
      ok: true,
      iso: "2026-09-05",
    });
    expect(parseDateEntryText("05 SEP 2026")).toEqual({
      ok: true,
      iso: "2026-09-05",
    });
  });

  it("rejects purely numeric, ambiguous input", () => {
    expect(parseDateEntryText("07/11/2026")).toEqual({ ok: false });
    expect(parseDateEntryText("11/07/2026")).toEqual({ ok: false });
    expect(parseDateEntryText("2026-07-17")).toEqual({ ok: false });
  });

  it("rejects malformed shapes", () => {
    expect(parseDateEntryText("Sep 2026")).toEqual({ ok: false });
    expect(parseDateEntryText("05 Sep")).toEqual({ ok: false });
    expect(parseDateEntryText("not a date")).toEqual({ ok: false });
  });

  it("rejects a zero or negative day", () => {
    expect(parseDateEntryText("00 Sep 2026")).toEqual({ ok: false });
  });
});

describe("formatIsoToDateEntryText", () => {
  it("formats '2026-09-05' to '05 Sep 2026'", () => {
    expect(formatIsoToDateEntryText("2026-09-05")).toBe("05 Sep 2026");
  });

  it("formats '2026-06-24' to '24 Jun 2026'", () => {
    expect(formatIsoToDateEntryText("2026-06-24")).toBe("24 Jun 2026");
  });

  it("returns an empty string for null/undefined/blank", () => {
    expect(formatIsoToDateEntryText(null)).toBe("");
    expect(formatIsoToDateEntryText(undefined)).toBe("");
    expect(formatIsoToDateEntryText("")).toBe("");
  });

  it("round-trips through parseDateEntryText for every month", () => {
    for (let month = 1; month <= 12; month += 1) {
      const iso = `2026-${String(month).padStart(2, "0")}-15`;
      const text = formatIsoToDateEntryText(iso);
      expect(parseDateEntryText(text)).toEqual({ ok: true, iso });
    }
  });
});
