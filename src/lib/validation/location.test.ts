import { describe, expect, it } from "vitest";
import {
  LOCATION_TYPES,
  LOCATION_TYPE_LABELS,
  normalizeSlug,
  parseLocationInput,
} from "@/lib/validation/location";

function formDataFrom(entries: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }
  return formData;
}

describe("normalizeSlug (location)", () => {
  it("trims, lowercases, and hyphenates the value", () => {
    expect(normalizeSlug("  Whispering Woods  ")).toBe("whispering-woods");
  });

  it("strips leading and trailing separators", () => {
    expect(normalizeSlug("__old-mine__")).toBe("old-mine");
  });
});

describe("LOCATION_TYPE_LABELS", () => {
  it("has exactly one label per location type, in the same order", () => {
    expect(Object.keys(LOCATION_TYPE_LABELS)).toEqual([...LOCATION_TYPES]);
  });

  it("gives every type a non-empty, distinct label", () => {
    const labels = LOCATION_TYPES.map((type) => LOCATION_TYPE_LABELS[type]);
    expect(labels.every((label) => label.trim().length > 0)).toBe(true);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("uses the required display wording for the three renamed types", () => {
    expect(LOCATION_TYPE_LABELS.BUILDING).toBe("Building or interior");
    expect(LOCATION_TYPE_LABELS.SUB_AREA).toBe("Sub-area");
    expect(LOCATION_TYPE_LABELS.SPECIAL_AREA).toBe("Special area");
  });
});

describe("parseLocationInput", () => {
  it("rejects a missing name", () => {
    const result = parseLocationInput(formDataFrom({ name: "", type: "REGION" }));

    expect(result).toEqual({ ok: false, error: "missing_name" });
  });

  it("derives the slug from the name when the slug field is blank", () => {
    const result = parseLocationInput(
      formDataFrom({ name: "Whispering Woods", type: "REGION" })
    );

    expect(result).toEqual({
      ok: true,
      value: {
        name: "Whispering Woods",
        slug: "whispering-woods",
        type: "REGION",
        parentId: null,
        description: null,
        accessNote: null,
      },
    });
  });

  it("uses an explicitly supplied slug after normalizing it", () => {
    const result = parseLocationInput(
      formDataFrom({
        name: "Whispering Woods",
        slug: " The Woods ",
        type: "REGION",
      })
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.slug).toBe("the-woods");
    }
  });

  it("rejects a name that produces an empty slug", () => {
    const result = parseLocationInput(formDataFrom({ name: "???", type: "REGION" }));

    expect(result).toEqual({ ok: false, error: "invalid_slug" });
  });

  it("rejects a missing type", () => {
    const result = parseLocationInput(formDataFrom({ name: "Old Mine" }));

    expect(result).toEqual({ ok: false, error: "missing_type" });
  });

  it("rejects a type outside the fixed enum", () => {
    const result = parseLocationInput(
      formDataFrom({ name: "Old Mine", type: "NOT_A_REAL_TYPE" })
    );

    expect(result).toEqual({ ok: false, error: "invalid_type" });
  });

  it("accepts every declared location type", () => {
    for (const type of LOCATION_TYPES) {
      const result = parseLocationInput(formDataFrom({ name: "Old Mine", type }));
      expect(result.ok && result.value.type).toBe(type);
    }
  });

  it("trims optional text fields and stores blank ones as null", () => {
    const withText = parseLocationInput(
      formDataFrom({
        name: "Old Mine",
        type: "DUNGEON",
        description: " A collapsed shaft. ",
        accessNote: " Requires a lantern. ",
        parentId: " parent123 ",
      })
    );
    const withBlank = parseLocationInput(
      formDataFrom({
        name: "Old Mine",
        type: "DUNGEON",
        description: "  ",
        accessNote: "  ",
      })
    );

    expect(withText.ok).toBe(true);
    if (withText.ok) {
      expect(withText.value.description).toBe("A collapsed shaft.");
      expect(withText.value.accessNote).toBe("Requires a lantern.");
      expect(withText.value.parentId).toBe("parent123");
    }

    expect(withBlank.ok).toBe(true);
    if (withBlank.ok) {
      expect(withBlank.value.description).toBeNull();
      expect(withBlank.value.accessNote).toBeNull();
      expect(withBlank.value.parentId).toBeNull();
    }
  });
});
