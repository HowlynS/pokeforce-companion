import { ResourceIcon } from "@/components/admin/resource-icon";
import {
  formatGameCurrencyPrice,
  formatGameCurrencyPriceLabel,
} from "@/lib/currency-price";
import { getImagePublicUrl } from "@/lib/storage/images";

export type CurrencyPriceValue = {
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
  const imageUrl = currency.image
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
