import { describe, expect, it } from "vitest";
import {
  normalizeSlug,
  parseProfessionInput,
} from "@/lib/validation/profession";

function formDataFrom(entries: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }
  return formData;
}

describe("normalizeSlug (profession)", () => {
  it("trims, lowercases, and hyphenates the value", () => {
    expect(normalizeSlug("  Master Blacksmithing  ")).toBe(
      "master-blacksmithing"
    );
  });

  it("strips leading and trailing separators", () => {
    expect(normalizeSlug("__alchemy__")).toBe("alchemy");
  });
});

describe("parseProfessionInput", () => {
  it("rejects a missing name", () => {
    const result = parseProfessionInput(formDataFrom({ name: "" }));

    expect(result).toEqual({ ok: false, error: "missing_name" });
  });

  it("derives the slug from the name when the slug field is blank", () => {
    const result = parseProfessionInput(formDataFrom({ name: "Blacksmithing" }));

    expect(result).toEqual({
      ok: true,
      value: { name: "Blacksmithing", slug: "blacksmithing", description: null },
    });
  });

  it("uses an explicitly supplied slug after normalizing it", () => {
    const result = parseProfessionInput(
      formDataFrom({ name: "Blacksmithing", slug: " Forge Work " })
    );

    expect(result).toEqual({
      ok: true,
      value: { name: "Blacksmithing", slug: "forge-work", description: null },
    });
  });

  it("rejects a name that produces an empty slug", () => {
    const result = parseProfessionInput(formDataFrom({ name: "???" }));

    expect(result).toEqual({ ok: false, error: "invalid_slug" });
  });

  it("trims the description and stores a blank one as null", () => {
    const withText = parseProfessionInput(
      formDataFrom({ name: "Alchemy", description: " Brewing potions. " })
    );
    const withBlank = parseProfessionInput(
      formDataFrom({ name: "Alchemy", description: "  " })
    );

    expect(withText).toEqual({
      ok: true,
      value: { name: "Alchemy", slug: "alchemy", description: "Brewing potions." },
    });
    expect(withBlank).toEqual({
      ok: true,
      value: { name: "Alchemy", slug: "alchemy", description: null },
    });
  });
});
