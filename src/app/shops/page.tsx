import type { Metadata } from "next";
import Link from "next/link";
import { ContentImage } from "@/components/content/content-image";
import { DirectorySearchField } from "@/components/content/directory-search-field";
import { LocationDirectoryFold } from "@/components/content/location-directory-fold";
import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { EmptyState } from "@/components/ui/empty-state";
import { prisma } from "@/lib/db";
import { formatPublicVerification } from "@/lib/public-verification";
import { normalizeSearchQuery } from "@/lib/search/global-search";
import { formatInventoryListingCount } from "@/lib/shops/public-shop";
import {
  LOCATION_TYPES,
  LOCATION_TYPE_LABELS,
  type LocationType,
} from "@/lib/validation/location";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shops | PokeForce Companion",
  description: "Browse PokeForce shops, their locations, and documented inventory.",
};

type ShopsPageProps = {
  searchParams: Promise<{ q?: string | string[] }>;
};

type ShopDirectoryLocation = {
  id: string;
  name: string;
  slug: string;
  type: LocationType;
  parentId: string | null;
};

export default async function ShopsPage({ searchParams }: ShopsPageProps) {
  const { q } = await searchParams;
  const query = normalizeSearchQuery(q);
  const contains = { contains: query, mode: "insensitive" as const };

  const [shops, locations] = await Promise.all([
    prisma.shop.findMany({
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
        id: true,
        slug: true,
        name: true,
        image: true,
        location: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
            parentId: true,
          },
        },
        verifiedAt: true,
        verifiedGameVersion: { select: { name: true } },
        _count: { select: { listings: true } },
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
    prisma.location.findMany({
      select: { id: true, name: true, slug: true, type: true, parentId: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
  ]);

  const locationsById = new Map<string, ShopDirectoryLocation>(
    locations.map((location) => [location.id, location]),
  );
  function findRoot(location: ShopDirectoryLocation): ShopDirectoryLocation {
    let current = location;
    const visited = new Set<string>();
    while (current.parentId && !visited.has(current.id)) {
      visited.add(current.id);
      const parent = locationsById.get(current.parentId);
      if (!parent) break;
      current = parent;
    }
    return current;
  }

  const groupMap = new Map<
    string,
    { root: ShopDirectoryLocation; shops: typeof shops }
  >();
  for (const shop of shops) {
    const root = findRoot(shop.location);
    const group = groupMap.get(root.id) ?? { root, shops: [] };
    group.shops.push(shop);
    groupMap.set(root.id, group);
  }
  const groups = [...groupMap.values()].sort((left, right) =>
    left.root.name.localeCompare(right.root.name),
  );

  return (
    <AppShell catalogue scenic="catalogue" wide>
      <div className="directory-page shops-directory-page">
        <Breadcrumb segments={[{ name: "Home", href: "/" }]} current="Shops" />
        <h1 className="directory-title">Shops</h1>

        <div className="directory-content">
          <div className="directory-toolbar shops-directory-toolbar">
            <div className="directory-toolbar-left">
              <DirectorySearchField
                basePath="/shops"
                placeholder="Find a shop by name..."
                defaultValue={query}
                ariaLabel="Search shops"
                submitLabel="Search Shops"
              />
              {query ? (
                <Link href="/shops" className="shops-directory-clear">
                  Clear
                </Link>
              ) : null}
            </div>
          </div>

          {query && shops.length > 0 ? (
            <p className="shops-directory-summary" aria-live="polite">
              Showing {shops.length} {shops.length === 1 ? "shop" : "shops"}{" "}
              matching &quot;{query}&quot;.
            </p>
          ) : null}

          {groups.length > 0 ? (
            <div className="location-directory-groups shops-directory-groups">
              {groups.map(({ root, shops: rootShops }) => {
                const typeGroups = LOCATION_TYPES.map((type) => ({
                  type,
                  shops: rootShops.filter((shop) => shop.location.type === type),
                })).filter((group) => group.shops.length > 0);

                return (
                  <LocationDirectoryFold
                    key={root.id}
                    title={root.name}
                    variant="region"
                    href={`/locations/${root.slug}`}
                    count={rootShops.length}
                    countNoun="shop"
                  >
                    {typeGroups.map((typeGroup) => (
                      <LocationDirectoryFold
                        key={typeGroup.type}
                        title={`${LOCATION_TYPE_LABELS[typeGroup.type]} Shops`}
                        variant="type"
                      >
                        <div className="shop-directory-grid">
                          {typeGroup.shops.map((shop, index) => {
                            const verification = formatPublicVerification(shop);
                            return (
                              <Link
                                href={`/shops/${shop.slug}`}
                                className="shop-directory-card cx-item-in"
                                style={{ animationDelay: `${Math.min(index * 30, 330)}ms` }}
                                key={shop.id}
                              >
                                <span className="shop-directory-card-media">
                                  <ContentImage
                                    imagePath={shop.image}
                                    alt={`Image of ${shop.name}`}
                                    size="card"
                                  />
                                </span>
                                <span className="shop-directory-card-copy">
                                  <h3 title={shop.name}>{shop.name}</h3>
                                  <span className="shop-directory-card-type">Shop</span>
                                  <span className="shop-directory-card-location">
                                    {shop.location.name}
                                  </span>
                                  <span className="shop-directory-card-facts">
                                    {formatInventoryListingCount(shop._count.listings)}
                                    {verification ? ` · ${verification}` : ""}
                                  </span>
                                </span>
                              </Link>
                            );
                          })}
                        </div>
                      </LocationDirectoryFold>
                    ))}
                  </LocationDirectoryFold>
                );
              })}
            </div>
          ) : shops.length === 0 && query ? (
            <div className="directory-empty-state">
              <p className="directory-empty-title">No shops found</p>
              <p className="directory-empty-body">
                Try a different search term or reset your search.
              </p>
              <Link href="/shops" className="directory-empty-reset">
                Reset search
              </Link>
            </div>
          ) : (
            <EmptyState
              title="No shops yet"
              description="Shops will appear here as fixed in-game inventories are documented."
            />
          )}
        </div>
      </div>
    </AppShell>
  );
}
