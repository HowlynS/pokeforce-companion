import { describe, expect, it } from "vitest";
import { parseCurrencyInput } from "@/lib/validation/currency";
import { plainTextToRichText } from "@/lib/rich-text";

function formDataFrom(values: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value);
  }
  return formData;
}

describe("parseCurrencyInput", () => {
  it("requires a name", () => {
    expect(parseCurrencyInput(formDataFrom({}))).toEqual({
      ok: false,
      error: "missing_name",
    });
  });

  it("derives a normalized slug and trims optional fields", () => {
    expect(
      parseCurrencyInput(
        formDataFrom({
          name: " Pokéyen ",
          symbol: " ₽ ",
          description: " Standard game currency. ",
        })
      )
    ).toEqual({
      ok: true,
      value: {
        name: "Pokéyen",
        slug: "pok-yen",
        symbol: "₽",
        description: "Standard game currency.",
        descriptionRich: plainTextToRichText("Standard game currency."),
      },
    });
  });

  it("preserves absent optional fields as null", () => {
    expect(
      parseCurrencyInput(formDataFrom({ name: "Runes", slug: "runes" }))
    ).toEqual({
      ok: true,
      value: {
        name: "Runes",
        slug: "runes",
        symbol: null,
        description: null,
        descriptionRich: null,
      },
    });
  });
});
