import { describe, expect, it } from "vitest";
import {
  parseGameVersionInput,
  parseReleaseDateInput,
} from "@/lib/validation/game-version";

function formDataFrom(entries: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }
  return formData;
}

describe("parseReleaseDateInput", () => {
  it("treats an empty value as no release date (the field is optional)", () => {
    expect(parseReleaseDateInput("")).toEqual({ ok: true, value: null });
    expect(parseReleaseDateInput("   ")).toEqual({ ok: true, value: null });
  });

  it("accepts a valid YYYY-MM-DD date anchored to UTC midnight", () => {
    const result = parseReleaseDateInput("2026-07-17");

    expect(result.ok).toBe(true);
    if (result.ok && result.value) {
      expect(result.value.toISOString()).toBe("2026-07-17T00:00:00.000Z");
    }
  });

  it("rejects values that are not in YYYY-MM-DD form", () => {
    expect(parseReleaseDateInput("17/07/2026").ok).toBe(false);
    expect(parseReleaseDateInput("2026-7-17").ok).toBe(false);
    expect(parseReleaseDateInput("not-a-date").ok).toBe(false);
  });

  it("rejects impossible calendar dates instead of rolling them over", () => {
    expect(parseReleaseDateInput("2026-02-31").ok).toBe(false);
    expect(parseReleaseDateInput("2026-13-01").ok).toBe(false);
    expect(parseReleaseDateInput("2026-00-10").ok).toBe(false);
  });
});

describe("parseGameVersionInput", () => {
  it("rejects a missing name", () => {
    const result = parseGameVersionInput(formDataFrom({ name: "  " }));

    expect(result).toEqual({ ok: false, error: "missing_name" });
  });

  it("accepts a name alone, trimming surrounding whitespace", () => {
    const result = parseGameVersionInput(
      formDataFrom({ name: "  Summer Update 2026  " })
    );

    expect(result).toEqual({
      ok: true,
      value: { name: "Summer Update 2026", releaseDate: null },
    });
  });

  it("accepts a name with a valid release date", () => {
    const result = parseGameVersionInput(
      formDataFrom({ name: "Summer Update 2026", releaseDate: "2026-07-01" })
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe("Summer Update 2026");
      expect(result.value.releaseDate?.toISOString()).toBe(
        "2026-07-01T00:00:00.000Z"
      );
    }
  });

  it("rejects an invalid release date", () => {
    const result = parseGameVersionInput(
      formDataFrom({ name: "Summer Update 2026", releaseDate: "2026-02-31" })
    );

    expect(result).toEqual({ ok: false, error: "invalid_release_date" });
  });

  it("treats a completely absent releaseDate field as no release date", () => {
    const result = parseGameVersionInput(formDataFrom({ name: "V1" }));

    expect(result).toEqual({
      ok: true,
      value: { name: "V1", releaseDate: null },
    });
  });
});
