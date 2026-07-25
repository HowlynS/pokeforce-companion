import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/lib/storage/images", () => ({
  getImagePublicUrl: async (path: string | null) =>
    path ? `https://images.example/${path}` : null,
}));

import { CurrencyPrice } from "@/components/content/currency-price";

describe("CurrencyPrice", () => {
  it("renders a Currency image and keeps the name in the accessible label", async () => {
    const html = renderToStaticMarkup(
      await CurrencyPrice({
        amount: 1_250,
        currency: {
          name: "Pokéyen",
          symbol: "₽",
          image: "currencies/pokeyen.png",
        },
      })
    );

    expect(html).toContain('aria-label="₽ 1,250 Pokéyen"');
    expect(html).toContain(
      'src="https://images.example/currencies/pokeyen.png"'
    );
    expect(html).toContain("₽ 1,250");
  });

  it("omits the image slot when a Currency has no image", async () => {
    const html = renderToStaticMarkup(
      await CurrencyPrice({
        amount: 20,
        currency: { name: "Runes", symbol: null, image: null },
      })
    );

    expect(html).toContain('aria-label="20 Runes"');
    expect(html).not.toContain("<img");
  });
});
