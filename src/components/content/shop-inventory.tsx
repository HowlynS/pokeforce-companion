"use client";

import { useState } from "react";
import { CollapsibleSection } from "@/components/content/collapsible-section";
import { PageLinkArrow } from "@/components/ui/page-link-arrow";

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
    // Reveal motion is the Recipe detail Ingredients section's own: the
    // default "item" variant, with no per-row stagger. The rows are the same
    // compact family, so they enter as one block rather than cascading.
    <CollapsibleSection
      title="Inventory"
      meta={`${listings.length} ${listings.length === 1 ? "item" : "items"}`}
      className="shop-detail-inventory"
    >
      <div className="shop-detail-inventory-panel">
        <div className="shop-detail-selected">
          <div className="shop-detail-selected-stage">{selected.previewImage}</div>
          <div className="shop-detail-selected-copy">
            <span className="shop-detail-selected-name">
              {selected.item.name}
            </span>
            {selected.item.description ? <p>{selected.item.description}</p> : null}
            <PageLinkArrow
              href={`/items/${selected.item.slug}`}
              label={`Open ${selected.item.name} item page`}
              variant="prominent"
              className="shop-detail-selected-link"
            />
          </div>
        </div>

        <div className="shop-detail-inventory-list">
          {listings.map((listing) => {
            const isSelected = listing.id === selected.id;
            return (
              <article
                className={`public-shop-listing shop-detail-inventory-row${
                  isSelected ? " shop-detail-inventory-row--selected" : ""
                }`}
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
                    <span className="shop-detail-inventory-name">
                      {listing.item.name}
                    </span>
                    <PageLinkArrow
                      href={`/items/${listing.item.slug}`}
                      label={`Open ${listing.item.name} item page`}
                      variant="subtle"
                      className="shop-detail-inventory-link"
                      // The arrow navigates; the row selects. Without this a
                      // click would also re-select the row on the way out.
                      onClick={(event) => event.stopPropagation()}
                    />
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
