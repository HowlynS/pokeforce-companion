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
          slug: "guild-marks",
          name: "Guild Marks",
          symbol: "◈",
          image: "currencies/guild-marks.png",
        },
      })
    );

    expect(html).toContain('aria-label="◈ 1,250 Guild Marks"');
    expect(html).toContain(
      'src="https://images.example/currencies/guild-marks.png"'
    );
    expect(html).toContain("◈ 1,250");
  });

  it("omits the image slot when a Currency has no image", async () => {
    const html = renderToStaticMarkup(
      await CurrencyPrice({
        amount: 20,
        currency: {
          slug: "runes",
          name: "Runes",
          symbol: null,
          image: null,
        },
      })
    );

    expect(html).toContain('aria-label="20 Runes"');
    expect(html).not.toContain("<img");
  });

  it("keeps rendering the image for a non-PokeYen Currency that has one", async () => {
    const html = renderToStaticMarkup(
      await CurrencyPrice({
        amount: 8,
        currency: {
          slug: "runes",
          name: "Runes",
          symbol: null,
          image: "currencies/runes.jpg",
        },
      })
    );

    expect(html).toContain('src="https://images.example/currencies/runes.jpg"');
    expect(html).toContain("8 Runes");
  });

  // PokeYen is deliberately symbol-only in public price surfaces: the record
  // may still carry an image, but the price renders "₽ 145" alone.
  it("never renders the PokeYen image, keeping the ₽ symbol and amount", async () => {
    const html = renderToStaticMarkup(
      await CurrencyPrice({
        amount: 145,
        currency: {
          slug: "poke-yen",
          name: "PokéYen",
          symbol: "₽",
          image: "currencies/poke-yen.png",
        },
      })
    );

    expect(html).not.toContain("<img");
    expect(html).not.toContain("poke-yen.png");
    expect(html).toContain("₽ 145");
    // The Currency name still reaches assistive technology.
    expect(html).toContain('aria-label="₽ 145 PokéYen"');
  });
});
