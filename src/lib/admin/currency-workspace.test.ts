import { describe, expect, it } from "vitest";
import {
  CURRENCY_CREATE_PATH,
  CURRENCY_LIST_PATH,
  currencyCanDelete,
  currencyEditHref,
  currencyEditorTabs,
  describeCurrencyShopListings,
  normalizeCurrencySearchQuery,
  withCurrencySearchQuery,
} from "@/lib/admin/currency-workspace";

describe("currency workspace routes", () => {
  it("uses the settings-scoped Currency routes", () => {
    expect(CURRENCY_LIST_PATH).toBe("/admin/settings/currencies");
    expect(CURRENCY_CREATE_PATH).toBe("/admin/settings/currencies/new");
    expect(currencyEditHref("pokeyen")).toBe(
      "/admin/settings/currencies/pokeyen/edit"
    );
  });

  it("preserves normalized searches in record links", () => {
    const query = normalizeCurrencySearchQuery("  coin  ");
    expect(query).toBe("coin");
    expect(currencyEditHref("sanctuary-coins", query)).toBe(
      "/admin/settings/currencies/sanctuary-coins/edit?q=coin"
    );
    expect(withCurrencySearchQuery(CURRENCY_CREATE_PATH, "")).toBe(
      CURRENCY_CREATE_PATH
    );
  });

  it("renders one active General tab", () => {
    expect(currencyEditorTabs("runes", "coin")).toEqual([
      {
        label: "General",
        href: "/admin/settings/currencies/runes/edit?q=coin",
        active: true,
      },
    ]);
  });
});

describe("Currency deletion safeguards", () => {
  it("allows only unreferenced Currencies to be deleted", () => {
    expect(currencyCanDelete(0)).toBe(true);
    expect(currencyCanDelete(1)).toBe(false);
  });

  it("describes dependent ShopListings clearly", () => {
    expect(describeCurrencyShopListings(1)).toBe("1 shop listing");
    expect(describeCurrencyShopListings(3)).toBe("3 shop listings");
  });
});
