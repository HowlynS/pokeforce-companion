import { ContentImage } from "@/components/content/content-image";
import {
  CurrencyPrice,
  type CurrencyPriceValue,
} from "@/components/content/currency-price";
import { formatPublicVerification } from "@/lib/public-verification";

type ShopListingCardProps = {
  item: {
    name: string;
    slug: string;
    image: string | null;
  };
  currency: CurrencyPriceValue;
  priceAmount: number;
  notes: string | null;
  verifiedAt: Date | null;
  verifiedGameVersion: { name: string } | null;
};

export function ShopListingCard({
  item,
  currency,
  priceAmount,
  notes,
  verifiedAt,
  verifiedGameVersion,
}: ShopListingCardProps) {
  const verification = formatPublicVerification({
    verifiedAt,
    verifiedGameVersion,
  });

  return (
    <article className="public-shop-listing">
      <a
        href={`/items/${item.slug}`}
        className="public-shop-listing-media"
        aria-label={`View ${item.name}`}
      >
        <ContentImage
          imagePath={item.image}
          alt={`Image of ${item.name}`}
          size="card"
        />
      </a>

      <div className="public-shop-listing-content">
        <h3>
          <a href={`/items/${item.slug}`} className="public-content-link">
            {item.name}
          </a>
        </h3>

        <CurrencyPrice amount={priceAmount} currency={currency} />

        {notes ? <p className="public-shop-listing-notes">{notes}</p> : null}
        {verification ? (
          <p className="public-verification-stamp">{verification}</p>
        ) : null}
      </div>
    </article>
  );
}
