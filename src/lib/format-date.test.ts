import { describe, expect, it } from "vitest";
import { formatDisplayDate } from "./format-date";

describe("formatDisplayDate", () => {
  it("formats a Date as DD MMM YYYY with a fixed English month abbreviation", () => {
    expect(formatDisplayDate(new Date("2026-09-05T00:00:00.000Z"))).toBe(
      "05 Sep 2026"
    );
  });

  it("always pads the day to two digits", () => {
    expect(formatDisplayDate(new Date("2026-01-01T00:00:00.000Z"))).toBe(
      "01 Jan 2026"
    );
  });

  it("formats a full ISO timestamp string", () => {
    expect(formatDisplayDate("2026-06-24T14:32:07.123Z")).toBe("24 Jun 2026");
  });

  it("formats a date-only YYYY-MM-DD string", () => {
    expect(formatDisplayDate("2026-07-17")).toBe("17 Jul 2026");
  });

  it("never shifts a UTC-midnight date-only value to the previous or next day", () => {
    // The historically risky case: a date-only string parses to UTC
    // midnight; reading it back with LOCAL date components would roll it
    // to the previous day in any timezone east of UTC and (for the last
    // instant of a month) the next day west of UTC. UTC components must
    // read back exactly what was stored, regardless of the machine
    // running this test.
    expect(formatDisplayDate("2026-01-01")).toBe("01 Jan 2026");
    expect(formatDisplayDate("2026-12-31")).toBe("31 Dec 2026");
  });

  it("renders every month abbreviation correctly", () => {
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    months.forEach((month, index) => {
      const monthNumber = String(index + 1).padStart(2, "0");
      expect(formatDisplayDate(`2026-${monthNumber}-15`)).toBe(
        `15 ${month} 2026`
      );
    });
  });

  it("returns null for a null value", () => {
    expect(formatDisplayDate(null)).toBeNull();
  });

  it("returns null for an undefined value", () => {
    expect(formatDisplayDate(undefined)).toBeNull();
  });

  it("returns null for an unparseable string rather than throwing", () => {
    expect(formatDisplayDate("not a date")).toBeNull();
  });

  it("is deterministic across repeated calls with the same input", () => {
    const input = new Date("2027-01-01T00:00:00.000Z");
    expect(formatDisplayDate(input)).toBe(formatDisplayDate(input));
  });
});
