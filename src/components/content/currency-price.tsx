import { ResourceIcon } from "@/components/admin/resource-icon";
import {
  currencyShowsPriceImage,
  formatGameCurrencyPrice,
  formatGameCurrencyPriceLabel,
} from "@/lib/currency-price";
import { getImagePublicUrl } from "@/lib/storage/images";

export type CurrencyPriceValue = {
  /** Canonical identity -- the PokeYen image exception keys on this, never
      on the rendered name or symbol. */
  slug: string;
  name: string;
  symbol: string | null;
  image: string | null;
};

type CurrencyPriceProps = {
  amount: number;
  currency: CurrencyPriceValue;
  className?: string;
};

/**
 * Shared public price presentation. The compact icon is decorative because
 * the parent exposes a complete spoken label including the Currency name.
 */
export async function CurrencyPrice({
  amount,
  currency,
  className,
}: CurrencyPriceProps) {
  // PokeYen is symbol-only in public price surfaces; every other Currency
  // keeps rendering its image exactly as before.
  const imageUrl =
    currency.image && currencyShowsPriceImage(currency)
      ? await getImagePublicUrl(currency.image)
      : null;

  return (
    <span
      className={
        className ? `currency-price ${className}` : "currency-price"
      }
      aria-label={formatGameCurrencyPriceLabel(amount, currency)}
    >
      {imageUrl ? (
        <ResourceIcon imageUrl={imageUrl} alt="" size="md" />
      ) : null}
      <span aria-hidden="true">
        {formatGameCurrencyPrice(amount, currency)}
      </span>
    </span>
  );
}
