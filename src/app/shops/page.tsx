import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { ContentImage } from "@/components/content/content-image";
import { Card } from "@/components/ui/card";
import { ContentGrid } from "@/components/ui/content-grid";
import { EmptyState } from "@/components/ui/empty-state";
import { prisma } from "@/lib/db";
import { formatPublicVerification } from "@/lib/public-verification";
import { normalizeSearchQuery } from "@/lib/search/global-search";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shops | PokeForce Companion",
  description:
    "Browse PokeForce shops, their locations, and documented inventory.",
};

type ShopsPageProps = {
  searchParams: Promise<{ q?: string | string[] }>;
};

function describeInventoryCount(count: number): string {
  return count === 1 ? "1 inventory listing" : `${count} inventory listings`;
}

export default async function ShopsPage({ searchParams }: ShopsPageProps) {
  const { q } = await searchParams;
  const query = normalizeSearchQuery(q);
  const contains = { contains: query, mode: "insensitive" as const };

  const shops = await prisma.shop.findMany({
    where: query
      ? {
          OR: [
            { name: contains },
            { description: contains },
            { location: { name: contains } },
          ],
        }
      : undefined,
    select: {
      slug: true,
      name: true,
      description: true,
      image: true,
      location: { select: { name: true } },
      verifiedAt: true,
      verifiedGameVersion: { select: { name: true } },
      _count: { select: { listings: true } },
    },
    orderBy: [{ name: "asc" }, { slug: "asc" }],
  });

  return (
    <AppShell>
      <PageHeader
        title="Shops"
        description="Find fixed in-game shops, where they are located, and what they sell."
      />

      <form
        action="/shops"
        method="get"
        role="search"
        aria-label="Search shops"
        className="public-resource-search"
      >
        <label>
          <span>Search shops</span>
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Shop, description, or location"
          />
        </label>
        <button type="submit" className="btn btn-primary">
          Search Shops
        </button>
        {query ? (
          <Link href="/shops" className="btn btn-secondary">
            Clear
          </Link>
        ) : null}
      </form>

      {shops.length > 0 ? (
        <>
          {query ? (
            <p
              className="public-results-summary"
              aria-live="polite"
            >
              Showing {shops.length} {shops.length === 1 ? "shop" : "shops"}{" "}
              matching &quot;{query}&quot;.
            </p>
          ) : null}

          <ContentGrid>
            {shops.map((shop) => {
              const verification = formatPublicVerification(shop);
              const details = [
                shop.location.name,
                describeInventoryCount(shop._count.listings),
                ...(verification ? [verification] : []),
              ].join(" · ");
              const description = shop.description
                ? `${shop.description} (${details})`
                : details;

              return (
                <Card
                  key={shop.slug}
                  title={shop.name}
                  description={description}
                  href={`/shops/${shop.slug}`}
                  media={
                    <ContentImage
                      imagePath={shop.image}
                      alt={`Image of ${shop.name}`}
                      size="card"
                    />
                  }
                />
              );
            })}
          </ContentGrid>
        </>
      ) : query ? (
        <EmptyState
          title="No matching shops"
          description={`No shops matched "${query}". Try a shop name, description, or location.`}
          action={
            <Link href="/shops" className="btn btn-primary">
              Show all Shops
            </Link>
          }
        />
      ) : (
        <EmptyState
          title="No shops yet"
          description="Shops will appear here as fixed in-game inventories are documented."
        />
      )}

    </AppShell>
  );
}
