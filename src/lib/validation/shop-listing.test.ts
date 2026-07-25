import { describe, expect, it } from "vitest";
import {
  hasDuplicateShopListingCombinations,
  parseShopListingInput,
} from "@/lib/validation/shop-listing";

function formDataFrom(values: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value);
  }
  return formData;
}

describe("parseShopListingInput", () => {
  it("requires an Item and Currency", () => {
    expect(
      parseShopListingInput(
        formDataFrom({ currencyId: "currency-1", priceAmount: "5" })
      )
    ).toEqual({ ok: false, error: "missing_item" });

    expect(
      parseShopListingInput(
        formDataFrom({ itemId: "item-1", priceAmount: "5" })
      )
    ).toEqual({ ok: false, error: "missing_currency" });
  });

  it.each(["", "0", "-1", "1.5", "not-a-number", "2147483648"])(
    "rejects invalid price %j",
    (priceAmount) => {
      expect(
        parseShopListingInput(
          formDataFrom({
            itemId: "item-1",
            currencyId: "currency-1",
            priceAmount,
          })
        )
      ).toEqual({ ok: false, error: "invalid_price" });
    }
  );

  it("accepts a positive integer and trims optional notes", () => {
    expect(
      parseShopListingInput(
        formDataFrom({
          itemId: " item-1 ",
          currencyId: " currency-1 ",
          priceAmount: "1250",
          notes: " After the tutorial. ",
        })
      )
    ).toEqual({
      ok: true,
      value: {
        itemId: "item-1",
        currencyId: "currency-1",
        priceAmount: 1250,
        notes: "After the tutorial.",
      },
    });
  });
});

describe("hasDuplicateShopListingCombinations", () => {
  it("flags the same Item and Currency combination", () => {
    expect(
      hasDuplicateShopListingCombinations([
        { itemId: "item-1", currencyId: "currency-1" },
        { itemId: "item-1", currencyId: "currency-1" },
      ])
    ).toBe(true);
  });

  it("allows the same Item with different Currencies", () => {
    expect(
      hasDuplicateShopListingCombinations([
        { itemId: "item-1", currencyId: "currency-1" },
        { itemId: "item-1", currencyId: "currency-2" },
      ])
    ).toBe(false);
  });
});
