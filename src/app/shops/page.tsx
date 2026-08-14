import type { Metadata } from "next";
import Link from "next/link";
import { ContentImage } from "@/components/content/content-image";
import { DirectorySearchField } from "@/components/content/directory-search-field";
import { LiveLocationDirectory } from "@/components/content/live-location-directory";
import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { LiveResetLink } from "@/components/content/live-filter-reset";
import { EmptyState } from "@/components/ui/empty-state";
import { prisma } from "@/lib/db";
import { formatPublicVerification } from "@/lib/public-verification";
import { buildLiveSearchText } from "@/lib/search/live-filter";
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

  // Shops are filtered live in the browser, so `?q=` only seeds the field.
  // The live filter matches the same three fields this query used to search —
  // name, description, and the owning Location's name — so the two surfaces
  // never disagree about what "matches".
  const [shops, locations] = await Promise.all([
    prisma.shop.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
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

  const liveGroups = groups.map(({ root, shops: rootShops }) => ({
    key: root.id,
    title: root.name,
    href: `/locations/${root.slug}`,
    countNoun: "shop",
    subGroups: LOCATION_TYPES.map((type) => ({
      key: type,
      title: `${LOCATION_TYPE_LABELS[type]} Shops`,
      entries: rootShops
        .filter((shop) => shop.location.type === type)
        .map((shop, index) => {
          const verification = formatPublicVerification(shop);
          return {
            key: shop.id,
            text: buildLiveSearchText(
              shop.name,
              shop.description,
              shop.location.name,
            ),
            node: (
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
                    size="row"
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
            ),
          };
        }),
    })).filter((group) => group.entries.length > 0),
  }));

  const noMatchesState = (
    <div className="directory-empty-state">
      <p className="directory-empty-title">No shops found</p>
      <p className="directory-empty-body">
        Try a different search term or reset your search.
      </p>
      <LiveResetLink href="/shops" className="directory-empty-reset" queryOnly>
        Reset search
      </LiveResetLink>
    </div>
  );

  return (
    <AppShell catalogue scenic="catalogue" wide>
      <div className="directory-page shops-directory-page">
        <Breadcrumb segments={[{ name: "Home", href: "/" }]} current="Shops" />
        <h1 className="directory-title">Shops</h1>

        <div className="directory-content">
          {shops.length > 0 ? (
            <LiveLocationDirectory
              search={{
                basePath: "/shops",
                placeholder: "Find a shop by name...",
                ariaLabel: "Search shops",
                submitLabel: "Search Shops",
                initialQuery: query,
              }}
              showClearLink
              summaryNoun="shop"
              toolbarClassName="directory-toolbar shops-directory-toolbar"
              groupsClassName="location-directory-groups shops-directory-groups"
              gridClassName="shop-directory-grid"
              groups={liveGroups}
              emptyState={noMatchesState}
            />
          ) : (
            <>
              <div className="directory-toolbar shops-directory-toolbar">
                <div className="directory-toolbar-left">
                  <DirectorySearchField
                    basePath="/shops"
                    placeholder="Find a shop by name..."
                    defaultValue={query}
                    ariaLabel="Search shops"
                    submitLabel="Search Shops"
                  />
                </div>
              </div>
              <EmptyState
                title="No shops yet"
                description="Shops will appear here as fixed in-game inventories are documented."
              />
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
