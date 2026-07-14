import { describe, expect, it } from "vitest";
import { normalizeSlug, parseCategoryInput } from "@/lib/validation/category";

function formDataFrom(entries: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }
  return formData;
}

describe("normalizeSlug (category)", () => {
  it("trims and lowercases the value", () => {
    expect(normalizeSlug("  Materials  ")).toBe("materials");
  });

  it("collapses runs of non-alphanumeric characters into single hyphens", () => {
    expect(normalizeSlug("Crafting   &  Gathering!!")).toBe(
      "crafting-gathering"
    );
  });

  it("strips leading and trailing separators", () => {
    expect(normalizeSlug("--already-hyphenated--")).toBe("already-hyphenated");
  });

  it("returns an empty string when nothing usable remains", () => {
    expect(normalizeSlug("!!!")).toBe("");
  });
});

describe("parseCategoryInput", () => {
  it("rejects a missing name", () => {
    const result = parseCategoryInput(formDataFrom({ name: "   " }));

    expect(result).toEqual({ ok: false, error: "missing_name" });
  });

  it("derives the slug from the name when the slug field is blank", () => {
    const result = parseCategoryInput(
      formDataFrom({ name: "Rare Materials", slug: "" })
    );

    expect(result).toEqual({
      ok: true,
      value: { name: "Rare Materials", slug: "rare-materials", description: null },
    });
  });

  it("uses an explicitly supplied slug after normalizing it", () => {
    const result = parseCategoryInput(
      formDataFrom({ name: "Rare Materials", slug: "  Custom Slug! " })
    );

    expect(result).toEqual({
      ok: true,
      value: { name: "Rare Materials", slug: "custom-slug", description: null },
    });
  });

  it("rejects a name that produces an empty slug", () => {
    const result = parseCategoryInput(formDataFrom({ name: "!!!" }));

    expect(result).toEqual({ ok: false, error: "invalid_slug" });
  });

  it("trims the description and stores a blank one as null", () => {
    const withText = parseCategoryInput(
      formDataFrom({ name: "Tools", description: "  Crafting tools.  " })
    );
    const withBlank = parseCategoryInput(
      formDataFrom({ name: "Tools", description: "   " })
    );

    expect(withText).toEqual({
      ok: true,
      value: { name: "Tools", slug: "tools", description: "Crafting tools." },
    });
    expect(withBlank).toEqual({
      ok: true,
      value: { name: "Tools", slug: "tools", description: null },
    });
  });

  it("trims the submitted name", () => {
    const result = parseCategoryInput(formDataFrom({ name: "  Gear  " }));

    expect(result).toEqual({
      ok: true,
      value: { name: "Gear", slug: "gear", description: null },
    });
  });
});
