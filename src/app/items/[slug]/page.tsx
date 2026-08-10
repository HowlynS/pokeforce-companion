import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { CollapsibleSection } from "@/components/content/collapsible-section";
import { ContentImage } from "@/components/content/content-image";
import { CurrencyPrice } from "@/components/content/currency-price";
import { RichTextContent } from "@/components/content/rich-text-content";
import { prisma } from "@/lib/db";
import { formatDisplayDate } from "@/lib/format-date";
import { formatPublicVerification } from "@/lib/public-verification";
import { resolveRecipeDisplayImage } from "@/lib/recipes/recipe-image";
import {
  ACQUISITION_TYPE_LABELS,
  groupAcquisitionSourcesByType,
} from "@/lib/validation/acquisition-source";

export const dynamic = "force-dynamic";

const numberFormatter = new Intl.NumberFormat("en-US");

type ItemDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ItemDetailPage({ params }: ItemDetailPageProps) {
  const { slug } = await params;
  const item = await prisma.item.findUnique({
    where: { slug },
    select: {
      name: true,
      description: true,
      descriptionRich: true,
      image: true,
      heldItem: true,
      baseValue: true,
      updatedAt: true,
      verifiedAt: true,
      verifiedGameVersion: { select: { name: true } },
      category: { select: { name: true } },
      recipeIngredients: {
        select: {
          id: true,
          quantity: true,
          recipe: {
            select: {
              slug: true,
              name: true,
              image: true,
              profession: { select: { name: true } },
              resultingItem: {
                select: { name: true, image: true },
              },
              // Full ingredient list, real (not invented) — used only to
              // derive "Related Items" below (items crafted alongside
              // this one), not shown as a duplicate ingredient list here.
              ingredients: {
                select: {
                  quantity: true,
                  item: {
                    select: {
                      slug: true,
                      name: true,
                      image: true,
                      category: { select: { name: true } },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { recipe: { name: "asc" } },
      },
      acquisitionSources: {
        select: {
          id: true,
          type: true,
          sourceLabel: true,
          quantity: true,
          notes: true,
          location: { select: { name: true, slug: true } },
          profession: { select: { name: true, slug: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      shopListings: {
        select: {
          id: true,
          priceAmount: true,
          notes: true,
          shop: {
            select: {
              name: true,
              slug: true,
              location: { select: { name: true, slug: true } },
            },
          },
          currency: {
            select: { name: true, symbol: true, image: true },
          },
        },
        orderBy: [
          { shop: { name: "asc" } },
          { currency: { name: "asc" } },
          { priceAmount: "asc" },
        ],
      },
    },
  });

  if (!item) {
    notFound();
  }

  const acquisitionGroups = groupAcquisitionSourcesByType(
    item.acquisitionSources
  );
  const verification = formatPublicVerification(item);
  const updatedAt = formatDisplayDate(item.updatedAt);
  const hasAcquisition =
    item.shopListings.length > 0 || acquisitionGroups.length > 0;

  // Real "source" chip, matching the same derivation as the Items
  // directory card: first acquisition source's type, else a Shop
  // listing, else omitted (never invented).
  const primarySource = item.acquisitionSources[0]
    ? ACQUISITION_TYPE_LABELS[item.acquisitionSources[0].type]
    : item.shopListings.length > 0
      ? "Shop"
      : null;

  // Related Items: items that appear as ingredients in the same recipes
  // this item is used in — a real "crafted alongside" relationship
  // derived from RecipeIngredient rows, not an invented association.
  const relatedItemsMap = new Map<
    string,
    { slug: string; name: string; image: string | null; category: string | null }
  >();
  for (const ingredient of item.recipeIngredients) {
    for (const sibling of ingredient.recipe.ingredients) {
      if (sibling.item.slug === slug) continue;
      if (!relatedItemsMap.has(sibling.item.slug)) {
        relatedItemsMap.set(sibling.item.slug, {
          slug: sibling.item.slug,
          name: sibling.item.name,
          image: sibling.item.image,
          category: sibling.item.category?.name ?? null,
        });
      }
    }
  }
  const relatedItems = [...relatedItemsMap.values()].slice(0, 12);

  return (
    <AppShell scenic="detail" wide>
      <article className="item-detail-page">
        <Breadcrumb
          segments={[
            { name: "Home", href: "/" },
            { name: "Items", href: "/items" },
          ]}
          current={item.name}
        />

        <div className="item-content-grid">
          <div className="item-main-column">
            <section
              className="item-identity-panel resource-atmosphere resource-atmosphere--item"
              aria-labelledby="item-title"
            >
              <div className="item-identity-stage">
                <ContentImage
                  imagePath={item.image}
                  alt={`Image of ${item.name}`}
                  size="hero"
                />
              </div>

              <div className="item-identity-copy">
                {item.category ? (
                  <p className="item-category-label">{item.category.name}</p>
                ) : null}
                <h1 id="item-title" className="public-resource-title">
                  {item.name}
                </h1>
                <RichTextContent
                  value={item.descriptionRich}
                  fallback={item.description}
                  className="item-description rich-text-content"
                />
                {primarySource || item.baseValue !== null ? (
                  <div className="item-info-chips">
                    {primarySource ? (
                      <span className="item-info-chip">
                        Source:{" "}
                        <strong>{primarySource}</strong>
                      </span>
                    ) : null}
                    {item.baseValue !== null ? (
                      <span className="item-info-chip">
                        Sell value:{" "}
                        <strong className="item-info-chip-accent">
                          {numberFormatter.format(item.baseValue)}g
                        </strong>
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <dl className="item-fact-strip">
                  <div>
                    <dt>Held item</dt>
                    <dd>{item.heldItem ? "Yes" : "No"}</dd>
                  </div>
                </dl>
              </div>
            </section>

            {hasAcquisition || item.recipeIngredients.length > 0 ? (
              <div className="item-lower-grid">
                {hasAcquisition ? (
                  <CollapsibleSection
                    title="How to obtain"
                    className="item-panel item-obtain-panel"
                  >
                    {item.shopListings.length > 0 ? (
                      <div className="item-source-group">
                        <h3>Shops</h3>
                        <div className="item-source-rows">
                          {item.shopListings.map((listing) => (
                            <article
                              className="item-acquisition-row item-shop-row"
                              key={listing.id}
                            >
                              <div className="item-row-primary">
                                <Link
                                  href={`/shops/${listing.shop.slug}`}
                                  className="public-content-link"
                                >
                                  {listing.shop.name}
                                </Link>
                                <Link
                                  href={`/locations/${listing.shop.location.slug}`}
                                  className="item-row-context public-content-link"
                                >
                                  {listing.shop.location.name}
                                </Link>
                              </div>
                              <CurrencyPrice
                                amount={listing.priceAmount}
                                currency={listing.currency}
                                className="item-shop-price"
                              />
                              {listing.notes ? (
                                <p className="item-row-notes">{listing.notes}</p>
                              ) : null}
                            </article>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {acquisitionGroups.map((group) => (
                      <div className="item-source-group" key={group.type}>
                        <h3>{group.label}</h3>
                        <div className="item-source-rows">
                          {group.sources.map((source) => {
                            const title =
                              source.sourceLabel ??
                              source.location?.name ??
                              source.profession?.name ??
                              ACQUISITION_TYPE_LABELS[source.type];
                            return (
                              <article className="item-acquisition-row" key={source.id}>
                                <div className="item-row-primary">
                                  <strong>{title}</strong>
                                  {source.location &&
                                  title !== source.location.name ? (
                                    <Link
                                      href={`/locations/${source.location.slug}`}
                                      className="item-row-context public-content-link"
                                    >
                                      {source.location.name}
                                    </Link>
                                  ) : source.location ? (
                                    <Link
                                      href={`/locations/${source.location.slug}`}
                                      className="item-row-context public-content-link"
                                    >
                                      View location
                                    </Link>
                                  ) : null}
                                  {source.profession?.slug &&
                                  title !== source.profession.name ? (
                                    <Link
                                      href={`/professions/${source.profession.slug}`}
                                      className="item-row-context public-content-link"
                                    >
                                      {source.profession.name}
                                    </Link>
                                  ) : null}
                                </div>
                                {source.quantity ? (
                                  <span className="item-source-quantity">
                                    Quantity: {source.quantity}
                                  </span>
                                ) : null}
                                {source.notes ? (
                                  <p className="item-row-notes">{source.notes}</p>
                                ) : null}
                              </article>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </CollapsibleSection>
                ) : null}

                {item.recipeIngredients.length > 0 ? (
                  <CollapsibleSection
                    title="Used in recipes"
                    className="item-panel item-recipes-panel"
                  >
                    <div className="item-recipe-rows">
                      {item.recipeIngredients.map((ingredient) => (
                        <Link
                          className="item-recipe-row"
                          href={`/recipes/${ingredient.recipe.slug}`}
                          key={ingredient.id}
                        >
                          <span className="item-recipe-thumbnail">
                            <ContentImage
                              imagePath={resolveRecipeDisplayImage({
                                recipeImage: ingredient.recipe.image,
                                resultingItemImage:
                                  ingredient.recipe.resultingItem.image,
                              })}
                              alt={`Image of ${ingredient.recipe.name}`}
                              size="row"
                            />
                          </span>
                          <span className="item-recipe-copy">
                            <strong>{ingredient.recipe.name}</strong>
                            {ingredient.recipe.profession ? (
                              <span>{ingredient.recipe.profession.name}</span>
                            ) : null}
                            <span>
                              Requires {ingredient.quantity} × {item.name}
                            </span>
                          </span>
                          <span className="item-recipe-affordance" aria-hidden="true">
                            →
                          </span>
                        </Link>
                      ))}
                    </div>
                  </CollapsibleSection>
                ) : null}
              </div>
            ) : null}

            {relatedItems.length > 0 ? (
              <CollapsibleSection
                title="Related Items"
                className="item-panel item-related-panel"
              >
                <div className="item-related-grid">
                  {relatedItems.map((related) => (
                    <Link
                      key={related.slug}
                      href={`/items/${related.slug}`}
                      className="item-related-card"
                    >
                      <span className="item-related-card-media">
                        <ContentImage
                          imagePath={related.image}
                          alt={`Image of ${related.name}`}
                          size="grid"
                        />
                      </span>
                      <span className="item-related-card-name">
                        {related.name}
                      </span>
                      {related.category ? (
                        <span className="item-related-card-category">
                          {related.category}
                        </span>
                      ) : null}
                    </Link>
                  ))}
                </div>
              </CollapsibleSection>
            ) : null}
          </div>

          <aside className="item-sidebar" aria-label="Item information">
            <section className="item-panel item-sidebar-panel">
              <h2>Item details</h2>
              <dl className="item-detail-list">
                {item.category ? (
                  <div>
                    <dt>Category</dt>
                    <dd>{item.category.name}</dd>
                  </div>
                ) : null}
                {updatedAt ? (
                  <div>
                    <dt>Last updated</dt>
                    <dd>{updatedAt}</dd>
                  </div>
                ) : null}
              </dl>
            </section>

            <section className="item-panel item-sidebar-panel">
              <h2>Verification</h2>
              <p className="item-verification-state">
                {verification ? "Verified" : "Unverified"}
              </p>
              <p className="item-verification-copy">
                {verification ??
                  "This item's gameplay information has not been verified for a Game Version."}
              </p>
            </section>
          </aside>
        </div>
      </article>
    </AppShell>
  );
}
