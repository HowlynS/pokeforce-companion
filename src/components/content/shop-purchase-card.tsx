import Link from "next/link";
import {
  CurrencyPrice,
  type CurrencyPriceValue,
} from "@/components/content/currency-price";
import { formatPublicVerification } from "@/lib/public-verification";

type ShopPurchaseCardProps = {
  shop: {
    name: string;
    slug: string;
    location: {
      name: string;
      slug: string;
    };
  };
  currency: CurrencyPriceValue;
  priceAmount: number;
  notes: string | null;
  verifiedAt: Date | null;
  verifiedGameVersion: { name: string } | null;
};

export function ShopPurchaseCard({
  shop,
  currency,
  priceAmount,
  notes,
  verifiedAt,
  verifiedGameVersion,
}: ShopPurchaseCardProps) {
  const verification = formatPublicVerification({
    verifiedAt,
    verifiedGameVersion,
  });

  return (
    <article className="public-shop-purchase">
      <h3>
        Purchased from{" "}
        <Link href={`/shops/${shop.slug}`} className="public-content-link">
          {shop.name}
        </Link>
      </h3>

      <div className="public-shop-purchase-summary">
        <Link
          href={`/locations/${shop.location.slug}`}
          className="public-content-link"
        >
          {shop.location.name}
        </Link>
        <span aria-hidden="true">·</span>
        <CurrencyPrice amount={priceAmount} currency={currency} />
      </div>

      {notes ? <p className="public-shop-listing-notes">{notes}</p> : null}
      {verification ? (
        <p className="public-verification-stamp">{verification}</p>
      ) : null}
    </article>
  );
}
