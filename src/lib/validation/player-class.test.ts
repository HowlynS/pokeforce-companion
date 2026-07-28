import { describe, expect, it } from "vitest";
import { parsePlayerClassInput } from "@/lib/validation/player-class";
import { plainTextToRichText } from "@/lib/rich-text";

function formDataFrom(entries: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }
  return formData;
}

describe("parsePlayerClassInput", () => {
  it("rejects a missing name", () => {
    const result = parsePlayerClassInput(formDataFrom({ name: "" }));

    expect(result).toEqual({ ok: false, error: "missing_name" });
  });

  it("derives the slug from the name when the slug field is blank", () => {
    const result = parsePlayerClassInput(formDataFrom({ name: "Trainer" }));

    expect(result).toEqual({
      ok: true,
      value: {
        name: "Trainer",
        slug: "trainer",
        description: null,
        descriptionRich: null,
      },
    });
  });

  it("uses an explicitly supplied slug after normalizing it", () => {
    const result = parsePlayerClassInput(
      formDataFrom({ name: "Trainer", slug: " Pokemon Trainer " })
    );

    expect(result).toEqual({
      ok: true,
      value: {
        name: "Trainer",
        slug: "pokemon-trainer",
        description: null,
        descriptionRich: null,
      },
    });
  });

  it("rejects a name that produces an empty slug", () => {
    const result = parsePlayerClassInput(formDataFrom({ name: "???" }));

    expect(result).toEqual({ ok: false, error: "invalid_slug" });
  });

  it("trims the description and stores a blank one as null", () => {
    const withText = parsePlayerClassInput(
      formDataFrom({ name: "Artisan", description: " Crafts and builds. " })
    );
    const withBlank = parsePlayerClassInput(
      formDataFrom({ name: "Artisan", description: "  " })
    );

    expect(withText).toEqual({
      ok: true,
      value: {
        name: "Artisan",
        slug: "artisan",
        description: "Crafts and builds.",
        descriptionRich: plainTextToRichText("Crafts and builds."),
      },
    });
    expect(withBlank).toEqual({
      ok: true,
      value: {
        name: "Artisan",
        slug: "artisan",
        description: null,
        descriptionRich: null,
      },
    });
  });
});
