import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { ContentImage } from "@/components/content/content-image";
import { ShopListingCard } from "@/components/content/shop-listing-card";
import { RichTextContent } from "@/components/content/rich-text-content";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { SECTION_ICONS } from "@/lib/admin/section-icons";
import { designTokens } from "@/lib/design-tokens";
import { prisma } from "@/lib/db";
import {
  loadLocationAncestors,
  type LocationAncestor,
} from "@/lib/locations/location-hierarchy";
import { formatPublicVerification } from "@/lib/public-verification";
import { resolveRichTextValue } from "@/lib/rich-text";
import { LOCATION_TYPE_LABELS } from "@/lib/validation/location";
import { canExposePublicContent } from "@/lib/access/require-site-access";

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
            select: { name: true, slug: true, image: true },
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
  })
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

function ShopBreadcrumb({
  ancestors,
  location,
  shopName,
}: {
  ancestors: readonly LocationAncestor[];
  location: { name: string; slug: string };
  shopName: string;
}) {
  const locationEntries = [
    ...ancestors,
    { name: location.name, slug: location.slug },
  ];

  return (
    <nav aria-label="Breadcrumb" className="public-breadcrumb">
      <ol>
        <li>
          <Link href="/shops" className="breadcrumb-link">
            Shops
          </Link>
        </li>
        {locationEntries.map((entry) => (
          <li key={entry.slug}>
            <span aria-hidden="true">/</span>
            <a
              href={`/locations/${entry.slug}`}
              className="breadcrumb-link"
            >
              {entry.name}
            </a>
          </li>
        ))}
        <li>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{shopName}</span>
        </li>
      </ol>
    </nav>
  );
}

export default async function ShopDetailPage({
  params,
}: ShopDetailPageProps) {
  const { slug } = await params;
  const shop = await loadPublicShop(slug);

  if (!shop) {
    notFound();
  }

  const ancestors = shop.location.parentId
    ? await loadLocationAncestors(prisma, shop.location.parentId)
    : [];
  const verification = formatPublicVerification(shop);
  const description = resolveRichTextValue(
    shop.descriptionRich,
    shop.description
  );

  return (
    <AppShell>
      <ShopBreadcrumb
        ancestors={ancestors}
        location={shop.location}
        shopName={shop.name}
      />

      <PageHeader
        title={shop.name}
        descriptionContent={description ? (
          <RichTextContent value={description} />
        ) : undefined}
      />

      <section className="detail-hero">
        <ContentImage
          imagePath={shop.image}
          alt={`Image of ${shop.name}`}
          size="detail"
        />

        <div className="detail-hero-facts">
          <Card
            title="Location"
            description={`${shop.location.name} · ${
              LOCATION_TYPE_LABELS[shop.location.type]
            }`}
            href={`/locations/${shop.location.slug}`}
          />
          {verification ? (
            <Card title="Verification" description={verification} />
          ) : null}
        </div>
      </section>

      {shop.listings.length > 0 ? (
        <section style={{ marginBottom: designTokens.layout.sectionGap }}>
          <SectionHeading icon={SECTION_ICONS.inventory}>
            Inventory
          </SectionHeading>
          <div className="public-shop-inventory">
            {shop.listings.map((listing) => (
              <ShopListingCard
                key={`${listing.item.slug}-${listing.currency.slug}`}
                item={listing.item}
                currency={listing.currency}
                priceAmount={listing.priceAmount}
                notes={listing.notes}
                verifiedAt={listing.verifiedAt}
                verifiedGameVersion={listing.verifiedGameVersion}
              />
            ))}
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}
