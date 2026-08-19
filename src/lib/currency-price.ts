export type PriceCurrency = {
  name: string;
  symbol: string | null;
};

/**
 * The canonical PokeYen Currency, identified by its stable slug rather than
 * by rendered text. PokeYen is deliberately symbol-only in public price
 * surfaces: its record may still carry an image (admin keeps full Currency
 * image support), but the public price never renders it, because the bare
 * "₽" already reads as the price.
 */
export const POKE_YEN_CURRENCY_SLUG = "poke-yen";

/**
 * Whether a Currency's image participates in its PUBLIC price presentation.
 * This is a PokeYen-only exception, never a general rule -- every other
 * Currency keeps the existing image behavior, so a future Currency added
 * with an image renders it without any further change here.
 */
export function currencyShowsPriceImage(currency: { slug: string }): boolean {
  return currency.slug !== POKE_YEN_CURRENCY_SLUG;
}

function groupIntegerDigits(value: number): string {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError("Currency price amounts must be positive safe integers.");
  }

  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Deterministic game-Currency formatting shared by server and client.
 * This deliberately avoids Intl / browser locale state so server output
 * and hydrated client output always use the approved comma grouping.
 */
export function formatGameCurrencyPrice(
  priceAmount: number,
  currency: PriceCurrency
): string {
  const amount = groupIntegerDigits(priceAmount);
  return currency.symbol
    ? `${currency.symbol} ${amount}`
    : `${amount} ${currency.name}`;
}

/**
 * A complete spoken label for compact symbol-first contexts. The visible
 * text may use only the symbol, but assistive technology still receives
 * the Currency's name.
 */
export function formatGameCurrencyPriceLabel(
  priceAmount: number,
  currency: PriceCurrency
): string {
  const formatted = formatGameCurrencyPrice(priceAmount, currency);
  return currency.symbol ? `${formatted} ${currency.name}` : formatted;
}
