import { describe, expect, it } from "vitest";
import { parseShopInput } from "@/lib/validation/shop";
import { plainTextToRichText } from "@/lib/rich-text";

function formDataFrom(values: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value);
  }
  return formData;
}

describe("parseShopInput", () => {
  it("requires a name", () => {
    expect(parseShopInput(formDataFrom({ locationId: "location-1" }))).toEqual({
      ok: false,
      error: "missing_name",
    });
  });

  it("requires a Location", () => {
    expect(parseShopInput(formDataFrom({ name: "Supply Shop" }))).toEqual({
      ok: false,
      error: "missing_location",
    });
  });

  it("normalizes fields for a valid Shop", () => {
    expect(
      parseShopInput(
        formDataFrom({
          name: " Blackthorn Supply ",
          slug: "blackthorn-supply",
          locationId: " location-1 ",
          description: " General supplies. ",
        })
      )
    ).toEqual({
      ok: true,
      value: {
        name: "Blackthorn Supply",
        slug: "blackthorn-supply",
        locationId: "location-1",
        description: "General supplies.",
        descriptionRich: plainTextToRichText("General supplies."),
      },
    });
  });
});
