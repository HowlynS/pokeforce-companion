import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ContentImage } from "@/components/content/content-image";
import { CurrencyPrice } from "@/components/content/currency-price";
import { RichTextContent } from "@/components/content/rich-text-content";
import { ShopInventory } from "@/components/content/shop-inventory";
import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { canExposePublicContent } from "@/lib/access/require-site-access";
import { prisma } from "@/lib/db";
import {
  loadLocationAncestors,
  type LocationAncestor,
} from "@/lib/locations/location-hierarchy";
import { formatPublicVerification } from "@/lib/public-verification";
import { resolveRichTextValue } from "@/lib/rich-text";
import { LOCATION_TYPE_LABELS } from "@/lib/validation/location";

export const dynamic = "force-dynamic";

type ShopDetailPageProps = {
  params: Promise<{ slug: string }>;
};

const loadPublicShop = cache((slug: string) =>
  prisma.shop.findUnique({
    where: { slug },
    select: {
      name: true,
      slug: true,
      description: true,
      descriptionRich: true,
      image: true,
      verifiedAt: true,
      verifiedGameVersion: { select: { name: true } },
      location: {
        select: {
          name: true,
          slug: true,
          type: true,
          parentId: true,
        },
      },
      listings: {
        select: {
          priceAmount: true,
          notes: true,
          verifiedAt: true,
          verifiedGameVersion: { select: { name: true } },
          item: {
            select: {
              name: true,
              slug: true,
              image: true,
              description: true,
            },
          },
          currency: {
            select: {
              name: true,
              slug: true,
              symbol: true,
              image: true,
            },
          },
        },
        orderBy: [
          { item: { name: "asc" } },
          { currency: { name: "asc" } },
          { priceAmount: "asc" },
        ],
      },
    },
  }),
);

export async function generateMetadata({
  params,
}: ShopDetailPageProps): Promise<Metadata> {
  if (!(await canExposePublicContent())) {
    return {
      title: "Merchants Codex — Private beta",
      description: "Restricted private beta access.",
      robots: { index: false, follow: false },
    };
  }

  const { slug } = await params;
  const shop = await loadPublicShop(slug);

  if (!shop) {
    return { title: "Shop not found | PokeForce Companion" };
  }

  return {
    title: `${shop.name} | Shops | PokeForce Companion`,
    description:
      shop.description ??
      `Inventory and location details for ${shop.name} in ${shop.location.name}.`,
  };
}

function shopBreadcrumbSegments(ancestors: readonly LocationAncestor[]) {
  return [
    { name: "Home", href: "/" },
    { name: "Shops", href: "/shops" },
    ...ancestors.map((ancestor) => ({
      name: ancestor.name,
      href: `/locations/${ancestor.slug}`,
    })),
  ];
}

export default async function ShopDetailPage({ params }: ShopDetailPageProps) {
  const { slug } = await params;
  const shop = await loadPublicShop(slug);

  if (!shop) notFound();

  const ancestors = shop.location.parentId
    ? await loadLocationAncestors(prisma, shop.location.parentId)
    : [];
  const rootLocation = ancestors[0] ?? shop.location;
  const verification = formatPublicVerification(shop);
  const description = resolveRichTextValue(
    shop.descriptionRich,
    shop.description,
  );

  return (
    <AppShell scenic="detail" wide>
      <article className="shop-detail-page">
        <Breadcrumb
          segments={[
            ...shopBreadcrumbSegments(ancestors),
            { name: shop.location.name, href: `/locations/${shop.location.slug}` },
          ]}
          current={shop.name}
        />

        <section className="detail-hero shop-detail-hero" aria-labelledby="shop-title">
          <div className="shop-detail-stage">
            <ContentImage
              imagePath={shop.image}
              alt={`Image of ${shop.name}`}
              size="hero"
            />
          </div>
          <div className="shop-detail-copy">
            <p className="shop-detail-eyebrow">Shop</p>
            <h1 id="shop-title" className="public-resource-title">
              {shop.name}
            </h1>
            {description ? (
              <RichTextContent
                value={description}
                className="shop-detail-description rich-text-content"
              />
            ) : null}
            <div className="shop-detail-chips" aria-label="Shop facts">
              <span className="shop-detail-chip">
                Type:&nbsp;<strong>Shop</strong>
              </span>
              {rootLocation.slug !== shop.location.slug ? (
                <Link
                  href={`/locations/${rootLocation.slug}`}
                  className="shop-detail-chip"
                >
                  Region:&nbsp;<strong>{rootLocation.name}</strong>
                </Link>
              ) : null}
              <Link
                href={`/locations/${shop.location.slug}`}
                className="shop-detail-chip"
              >
                <h3 className="shop-detail-location-label">Location</h3>
                Location:&nbsp;<strong>{shop.location.name}</strong>
              </Link>
              <span className="shop-detail-chip">
                Location type:&nbsp;
                <strong>{LOCATION_TYPE_LABELS[shop.location.type]}</strong>
              </span>
            </div>
            {verification ? (
              <p className="shop-detail-verification">{verification}</p>
            ) : null}
          </div>
        </section>

        {shop.listings.length > 0 ? (
          <ShopInventory
            listings={shop.listings.map((listing) => ({
              id: `${listing.item.slug}-${listing.currency.slug}`,
              item: {
                name: listing.item.name,
                slug: listing.item.slug,
                description: listing.item.description,
              },
              previewImage: (
                <ContentImage
                  imagePath={listing.item.image}
                  alt={`Image of ${listing.item.name}`}
                  size="grid"
                />
              ),
              rowImage: (
                <ContentImage
                  imagePath={listing.item.image}
                  alt={`Image of ${listing.item.name}`}
                  size="row"
                />
              ),
              price: (
                <CurrencyPrice
                  amount={listing.priceAmount}
                  currency={listing.currency}
                  className="shop-detail-inventory-price"
                />
              ),
              notes: listing.notes,
              verification: formatPublicVerification(listing),
            }))}
          />
        ) : null}
      </article>
    </AppShell>
  );
}
