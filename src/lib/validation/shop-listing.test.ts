import { describe, expect, it } from "vitest";
import {
  hasDuplicateShopListingCombinations,
  parseShopInventoryInput,
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

describe("parseShopInventoryInput", () => {
  function inventoryForm(
    rows: Array<{
      key: string;
      active?: boolean;
      listingId?: string;
      itemId?: string;
      currencyId?: string;
      priceAmount?: string;
      notes?: string;
    }>
  ): FormData {
    const formData = new FormData();
    for (const row of rows) {
      formData.append("listingRowKey", row.key);
      formData.set(`${row.key}.active`, row.active === false ? "0" : "1");
      formData.set(`${row.key}.listingId`, row.listingId ?? "");
      formData.set(`${row.key}.itemId`, row.itemId ?? "");
      formData.set(`${row.key}.currencyId`, row.currencyId ?? "");
      formData.set(`${row.key}.priceAmount`, row.priceAmount ?? "");
      formData.set(`${row.key}.notes`, row.notes ?? "");
    }
    return formData;
  }

  it("parses active rows and omits staged removals", () => {
    expect(
      parseShopInventoryInput(
        inventoryForm([
          {
            key: "existing-listing1",
            listingId: "listing1",
            itemId: "item1",
            currencyId: "currency1",
            priceAmount: "1250",
            notes: " Upstairs. ",
          },
          {
            key: "existing-listing2",
            active: false,
            listingId: "listing2",
          },
        ])
      )
    ).toEqual({
      ok: true,
      value: {
        rowKeys: ["existing-listing1", "existing-listing2"],
        rows: [
          {
            key: "existing-listing1",
            listingId: "listing1",
            itemId: "item1",
            currencyId: "currency1",
            priceAmount: 1250,
            notes: "Upstairs.",
          },
        ],
      },
    });
  });

  it("rejects unsafe, repeated, and excessive row keys", () => {
    expect(
      parseShopInventoryInput(inventoryForm([{ key: "../unsafe" }]))
    ).toEqual({ ok: false, error: "invalid_inventory" });

    const repeated = inventoryForm([
      { key: "new-1", active: false },
      { key: "new-1", active: false },
    ]);
    expect(parseShopInventoryInput(repeated)).toEqual({
      ok: false,
      error: "invalid_inventory",
    });

    expect(
      parseShopInventoryInput(
        inventoryForm(
          Array.from({ length: 101 }, (_, index) => ({
            key: `new-${index}`,
            active: false,
          }))
        )
      )
    ).toEqual({ ok: false, error: "invalid_inventory" });
  });

  it("returns the failing row's validation error without losing other values", () => {
    expect(
      parseShopInventoryInput(
        inventoryForm([
          {
            key: "new-1",
            itemId: "item1",
            currencyId: "currency1",
            priceAmount: "0",
          },
        ])
      )
    ).toEqual({ ok: false, error: "invalid_price" });
  });

  it("rejects an exact duplicate but allows another Currency", () => {
    const base = {
      itemId: "item1",
      currencyId: "currency1",
      priceAmount: "10",
    };
    expect(
      parseShopInventoryInput(
        inventoryForm([
          { key: "new-1", ...base },
          { key: "new-2", ...base },
        ])
      )
    ).toEqual({ ok: false, error: "duplicate_listing" });

    expect(
      parseShopInventoryInput(
        inventoryForm([
          { key: "new-1", ...base },
          { key: "new-2", ...base, currencyId: "currency2" },
        ])
      )
    ).toMatchObject({ ok: true });
  });
});
