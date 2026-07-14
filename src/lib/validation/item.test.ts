import { describe, expect, it } from "vitest";
import { normalizeSlug, parseItemInput } from "@/lib/validation/item";

function formDataFrom(entries: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }
  return formData;
}

describe("normalizeSlug (item)", () => {
  it("trims, lowercases, and hyphenates the value", () => {
    expect(normalizeSlug("  Iron Ore  ")).toBe("iron-ore");
  });

  it("collapses runs of non-alphanumeric characters", () => {
    expect(normalizeSlug("Smith's   Hammer")).toBe("smith-s-hammer");
  });
});

describe("parseItemInput", () => {
  it("rejects a missing name", () => {
    const result = parseItemInput(formDataFrom({}));

    expect(result).toEqual({ ok: false, error: "missing_name" });
  });

  it("derives the slug from the name when the slug field is blank", () => {
    const result = parseItemInput(formDataFrom({ name: "Iron Ore" }));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.slug).toBe("iron-ore");
    }
  });

  it("uses an explicitly supplied slug after normalizing it", () => {
    const result = parseItemInput(
      formDataFrom({ name: "Iron Ore", slug: " Raw IRON " })
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.slug).toBe("raw-iron");
    }
  });

  it("rejects a name that produces an empty slug", () => {
    const result = parseItemInput(formDataFrom({ name: "***" }));

    expect(result).toEqual({ ok: false, error: "invalid_slug" });
  });

  it("returns all optional fields as null when left blank", () => {
    const result = parseItemInput(formDataFrom({ name: "Wood" }));

    expect(result).toEqual({
      ok: true,
      value: {
        name: "Wood",
        slug: "wood",
        description: null,
        rarity: null,
        tradeable: false,
        baseValue: null,
        categoryId: null,
      },
    });
  });

  it("keeps trimmed values for the optional text fields", () => {
    const result = parseItemInput(
      formDataFrom({
        name: "Wood",
        description: " A log. ",
        rarity: " Common ",
        categoryId: " cat123 ",
      })
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.description).toBe("A log.");
      expect(result.value.rarity).toBe("Common");
      expect(result.value.categoryId).toBe("cat123");
    }
  });

  it("parses the tradeable checkbox: 'on' means true, absent means false", () => {
    const checked = parseItemInput(
      formDataFrom({ name: "Wood", tradeable: "on" })
    );
    const unchecked = parseItemInput(formDataFrom({ name: "Wood" }));

    expect(checked.ok && checked.value.tradeable).toBe(true);
    expect(unchecked.ok && unchecked.value.tradeable).toBe(false);
  });

  describe("base value parsing", () => {
    it("accepts a positive whole number", () => {
      const result = parseItemInput(
        formDataFrom({ name: "Wood", baseValue: "25" })
      );

      expect(result.ok && result.value.baseValue).toBe(25);
    });

    it("accepts zero", () => {
      const result = parseItemInput(
        formDataFrom({ name: "Wood", baseValue: "0" })
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.baseValue).toBe(0);
      }
    });

    it("treats a blank value as null", () => {
      const result = parseItemInput(
        formDataFrom({ name: "Wood", baseValue: "  " })
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.baseValue).toBeNull();
      }
    });

    it("rejects a negative number", () => {
      const result = parseItemInput(
        formDataFrom({ name: "Wood", baseValue: "-1" })
      );

      expect(result).toEqual({ ok: false, error: "invalid_base_value" });
    });

    it("rejects a decimal number", () => {
      const result = parseItemInput(
        formDataFrom({ name: "Wood", baseValue: "2.5" })
      );

      expect(result).toEqual({ ok: false, error: "invalid_base_value" });
    });

    it("rejects a non-numeric value", () => {
      const result = parseItemInput(
        formDataFrom({ name: "Wood", baseValue: "lots" })
      );

      expect(result).toEqual({ ok: false, error: "invalid_base_value" });
    });
  });
});
