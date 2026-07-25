import { describe, expect, it } from "vitest";
import {
  formatGameCurrencyPrice,
  formatGameCurrencyPriceLabel,
} from "@/lib/currency-price";

describe("formatGameCurrencyPrice", () => {
  it("formats Pokéyen with its symbol before a comma-grouped amount", () => {
    expect(
      formatGameCurrencyPrice(1_250, { name: "Pokéyen", symbol: "₽" })
    ).toBe("₽ 1,250");
  });

  it("never substitutes a dollar sign for Pokéyen", () => {
    expect(
      formatGameCurrencyPrice(999, { name: "Pokéyen", symbol: "₽" })
    ).not.toContain("$");
  });

  it("uses amount and Currency name when no symbol exists", () => {
    expect(
      formatGameCurrencyPrice(20, { name: "Runes", symbol: null })
    ).toBe("20 Runes");
  });

  it("groups large integer amounts deterministically", () => {
    expect(
      formatGameCurrencyPrice(2_147_483_647, {
        name: "Sanctuary Coins",
        symbol: null,
      })
    ).toBe("2,147,483,647 Sanctuary Coins");
  });

  it("includes the Currency name in symbol-first accessible labels", () => {
    expect(
      formatGameCurrencyPriceLabel(1_250, {
        name: "Pokéyen",
        symbol: "₽",
      })
    ).toBe("₽ 1,250 Pokéyen");
  });

  it("rejects non-positive and non-integer amounts", () => {
    expect(() =>
      formatGameCurrencyPrice(0, { name: "Runes", symbol: null })
    ).toThrow(RangeError);
    expect(() =>
      formatGameCurrencyPrice(1.5, { name: "Runes", symbol: null })
    ).toThrow(RangeError);
  });
});
