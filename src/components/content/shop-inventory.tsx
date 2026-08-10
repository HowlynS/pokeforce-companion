"use client";

import Link from "next/link";
import { useState } from "react";
import { CollapsibleSection } from "@/components/content/collapsible-section";

type ShopInventoryListing = {
  id: string;
  item: {
    name: string;
    slug: string;
    description: string | null;
  };
  previewImage: React.ReactNode;
  rowImage: React.ReactNode;
  price: React.ReactNode;
  notes: string | null;
  verification: string | null;
};

type ShopInventoryProps = {
  listings: readonly ShopInventoryListing[];
};

export function ShopInventory({ listings }: ShopInventoryProps) {
  const [selectedId, setSelectedId] = useState(listings[0]?.id);
  const selected =
    listings.find((listing) => listing.id === selectedId) ?? listings[0];

  if (!selected) return null;

  return (
    <CollapsibleSection
      title="Inventory"
      meta={`${listings.length} ${listings.length === 1 ? "item" : "items"}`}
      className="shop-detail-inventory"
    >
      <div className="shop-detail-inventory-panel">
        <div className="shop-detail-selected">
          <div className="shop-detail-selected-stage">{selected.previewImage}</div>
          <div className="shop-detail-selected-copy">
            <Link href={`/items/${selected.item.slug}`}>{selected.item.name}</Link>
            {selected.item.description ? <p>{selected.item.description}</p> : null}
          </div>
        </div>

        <div className="shop-detail-inventory-list">
          {listings.map((listing, index) => {
            const isSelected = listing.id === selected.id;
            return (
              <article
                className={`public-shop-listing shop-detail-inventory-row cx-fade-stagger${
                  isSelected ? " shop-detail-inventory-row--selected" : ""
                }`}
                style={{ animationDelay: `${Math.min(index * 40, 360)}ms` }}
                onClick={() => setSelectedId(listing.id)}
                key={listing.id}
              >
                <button
                  type="button"
                  className="shop-detail-inventory-select"
                  aria-label={`Preview ${listing.item.name}`}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedId(listing.id)}
                >
                  ▶
                </button>
                <span className="shop-detail-inventory-icon">{listing.rowImage}</span>
                <div className="public-shop-listing-content">
                  <h3>
                    <Link href={`/items/${listing.item.slug}`}>
                      {listing.item.name}
                    </Link>
                  </h3>
                  {listing.price}
                  {listing.notes ? (
                    <p className="public-shop-listing-notes">{listing.notes}</p>
                  ) : null}
                  {listing.verification ? (
                    <p className="public-verification-stamp">
                      {listing.verification}
                    </p>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </CollapsibleSection>
  );
}
