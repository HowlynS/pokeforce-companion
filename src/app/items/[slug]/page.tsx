import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { CollapsibleSection } from "@/components/content/collapsible-section";
import { ContentImage } from "@/components/content/content-image";
import { CurrencyPrice } from "@/components/content/currency-price";
import { RecipeCollectionSection } from "@/components/content/recipe-collection-section";
import {
  RecipeCollectionGrid,
  RecipeCollectionList,
} from "@/components/content/recipe-collection-views";
import { RichTextContent } from "@/components/content/rich-text-content";
import { VerificationCard } from "@/components/ui/verification-card";
import { prisma } from "@/lib/db";
import { formatDisplayDate } from "@/lib/format-date";
import { recipeOutputCardSelect } from "@/lib/recipes/recipe-output-catalogue";
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
          // The canonical Recipe relationship card's own shape, so this
          // surface shows the same card as every other Recipe collection
          // rather than a shortened lookalike. Its ingredient rows also
          // supply "Related Items" below (items crafted alongside this one).
          recipe: { select: recipeOutputCardSelect },
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
          location: { select: { name: true, slug: true, image: true } },
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
              image: true,
              location: { select: { name: true, slug: true } },
            },
          },
          currency: {
            select: { slug: true, name: true, symbol: true, image: true },
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
  const updatedAt = formatDisplayDate(item.updatedAt);
  const hasAcquisition =
    item.shopListings.length > 0 || acquisitionGroups.length > 0;

  // Only worth comparing when every listing shares the same Currency --
  // there is no exchange rate to make a cross-Currency comparison honest, so
  // a mixed set simply omits the enhancement rather than guessing.
  const shopCurrencySlugs = new Set(
    item.shopListings.map((listing) => listing.currency.slug)
  );
  const cheapestListing =
    shopCurrencySlugs.size === 1 && item.shopListings.length > 0
      ? item.shopListings.reduce((cheapest, listing) =>
          listing.priceAmount < cheapest.priceAmount ? listing : cheapest
        )
      : null;

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
  // The Recipes this Item is an ingredient of, as canonical collection cards.
  const usedInRecipes = item.recipeIngredients.map(
    (ingredient) => ingredient.recipe,
  );

  return (
    <AppShell scenic="detail" wide>
      <article className="item-detail-page item-resource-detail-page">
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
                {/* Always rendered, so every resource hero opens with an
                    eyebrow: the category when the Item has one, the resource
                    name itself when it does not. Never invented data. */}
                <p className="item-category-label">
                  {item.category ? item.category.name : "Item"}
                </p>
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
              </div>
            </section>

            {hasAcquisition || item.recipeIngredients.length > 0 ? (
              <div className="item-lower-grid">
                {hasAcquisition ? (
                  <CollapsibleSection
                    title="How to obtain"
                    meta={
                      cheapestListing ? (
                        <span className="item-obtain-cheapest">
                          Cheapest{" "}
                          <CurrencyPrice
                            amount={cheapestListing.priceAmount}
                            currency={cheapestListing.currency}
                          />
                        </span>
                      ) : null
                    }
                    className="item-panel item-obtain-panel"
                    animationVariant="stagger"
                  >
                    {item.shopListings.length > 0 ? (
                      <div className="item-source-group">
                        <h3>Shops</h3>
                        <div className="item-obtain-cards">
                          {item.shopListings.map((listing) => {
                            const isCheapest =
                              cheapestListing?.id === listing.id;
                            return (
                              <article
                                className={`item-acquisition-row item-shop-row item-obtain-card${
                                  isCheapest ? " item-obtain-card--best" : ""
                                }`}
                                key={listing.id}
                              >
                                {isCheapest ? (
                                  <span className="item-obtain-card-best-badge">
                                    Best price
                                  </span>
                                ) : null}
                                <span className="item-obtain-card-media">
                                  <ContentImage
                                    imagePath={listing.shop.image}
                                    alt=""
                                    size="row"
                                  />
                                </span>
                                <span className="item-obtain-card-body">
                                  <Link
                                    href={`/shops/${listing.shop.slug}`}
                                    className="item-obtain-card-title public-content-link"
                                  >
                                    {listing.shop.name}
                                  </Link>
                                  <Link
                                    href={`/locations/${listing.shop.location.slug}`}
                                    className="item-obtain-card-context public-content-link"
                                  >
                                    {listing.shop.location.name}
                                  </Link>
                                  <CurrencyPrice
                                    amount={listing.priceAmount}
                                    currency={listing.currency}
                                    className="item-obtain-card-value"
                                  />
                                  {listing.notes ? (
                                    <p className="item-obtain-card-notes">
                                      {listing.notes}
                                    </p>
                                  ) : null}
                                </span>
                              </article>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    {acquisitionGroups.map((group) => (
                      <div className="item-source-group" key={group.type}>
                        <h3>{group.label}</h3>
                        <div className="item-obtain-cards">
                          {group.sources.map((source) => {
                            const title =
                              source.sourceLabel ??
                              source.location?.name ??
                              source.profession?.name ??
                              ACQUISITION_TYPE_LABELS[source.type];
                            return (
                              <article
                                className="item-acquisition-row item-obtain-card"
                                key={source.id}
                              >
                                <span className="item-obtain-card-media">
                                  <ContentImage
                                    imagePath={source.location?.image ?? null}
                                    alt=""
                                    size="row"
                                  />
                                </span>
                                <span className="item-obtain-card-body">
                                  <strong className="item-obtain-card-title">
                                    {title}
                                  </strong>
                                  {source.location &&
                                  title !== source.location.name ? (
                                    <Link
                                      href={`/locations/${source.location.slug}`}
                                      className="item-obtain-card-context public-content-link"
                                    >
                                      {source.location.name}
                                    </Link>
                                  ) : source.location ? (
                                    <Link
                                      href={`/locations/${source.location.slug}`}
                                      className="item-obtain-card-context public-content-link"
                                    >
                                      View location
                                    </Link>
                                  ) : null}
                                  {source.profession?.slug &&
                                  title !== source.profession.name ? (
                                    <Link
                                      href={`/professions/${source.profession.slug}`}
                                      className="item-obtain-card-context public-content-link"
                                    >
                                      {source.profession.name}
                                    </Link>
                                  ) : null}
                                  {source.quantity ? (
                                    <span className="item-obtain-card-value">
                                      Quantity: {source.quantity}
                                    </span>
                                  ) : null}
                                  {source.notes ? (
                                    <p className="item-obtain-card-notes">
                                      {source.notes}
                                    </p>
                                  ) : null}
                                </span>
                              </article>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </CollapsibleSection>
                ) : null}

                {usedInRecipes.length > 0 ? (
                  <RecipeCollectionSection
                    title="Used in recipes"
                    grid={<RecipeCollectionGrid recipes={usedInRecipes} />}
                    list={<RecipeCollectionList recipes={usedInRecipes} />}
                  />
                ) : null}
              </div>
            ) : null}

            {relatedItems.length > 0 ? (
              <CollapsibleSection
                title="Related Items"
                className="item-panel item-related-panel"
                animationVariant="stagger"
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
                {primarySource ? (
                  <div>
                    <dt>Source</dt>
                    <dd>{primarySource}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>Held item</dt>
                  <dd>{item.heldItem ? "Yes" : "No"}</dd>
                </div>
                {item.baseValue !== null ? (
                  <div>
                    <dt>Sell value</dt>
                    <dd>{numberFormatter.format(item.baseValue)}g</dd>
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

            <VerificationCard stamp={item} className="item-panel" />
          </aside>
        </div>
      </article>
    </AppShell>
  );
}
