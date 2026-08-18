import Link from "next/link";
import { CollapsibleSection } from "@/components/content/collapsible-section";
import { ContentImage } from "@/components/content/content-image";
import { LocationDetailDirectory } from "@/components/content/location-detail-directory";
import { LocationDirectoryFold } from "@/components/content/location-directory-fold";
import { RichTextContent } from "@/components/content/rich-text-content";
import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { prisma } from "@/lib/db";
import {
  loadLocationAncestors,
  type LocationAncestor,
} from "@/lib/locations/location-hierarchy";
import { resolveRichTextValue } from "@/lib/rich-text";
import { formatInventoryListingCount } from "@/lib/shops/public-shop";
import { groupObtainableItemsByType } from "@/lib/validation/acquisition-source";
import {
  LOCATION_TYPES,
  LOCATION_TYPE_LABELS,
} from "@/lib/validation/location";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type LocationDetailPageProps = {
  params: Promise<{ slug: string }>;
};

function locationBreadcrumbSegments(ancestors: readonly LocationAncestor[]) {
  return [
    { name: "Home", href: "/" },
    { name: "Locations", href: "/locations" },
    ...ancestors.map((ancestor) => ({
      name: ancestor.name,
      href: `/locations/${ancestor.slug}`,
    })),
  ];
}

export default async function LocationDetailPage({
  params,
}: LocationDetailPageProps) {
  const { slug } = await params;
  const location = await prisma.location.findUnique({
    where: { slug },
    include: {
      children: {
        select: {
          id: true,
          name: true,
          slug: true,
          type: true,
          image: true,
          _count: { select: { shops: true } },
        },
        orderBy: [{ name: "asc" }, { id: "asc" }],
      },
      shops: {
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          image: true,
          _count: { select: { listings: true } },
        },
        orderBy: [{ name: "asc" }, { id: "asc" }],
      },
      acquisitionSources: {
        select: {
          type: true,
          sourceLabel: true,
          quantity: true,
          notes: true,
          profession: { select: { name: true } },
          item: { select: { slug: true, name: true, image: true } },
        },
        orderBy: { item: { name: "asc" } },
      },
    },
  });

  if (!location) notFound();

  const ancestors = location.parentId
    ? await loadLocationAncestors(prisma, location.parentId)
    : [];
  const parent = ancestors[ancestors.length - 1];
  const description = resolveRichTextValue(
    location.descriptionRich,
    location.description,
  );
  const obtainableGroups = groupObtainableItemsByType(location.acquisitionSources);
  const obtainableItemCount = obtainableGroups.reduce(
    (total, group) => total + group.items.length,
    0,
  );

  const childTypeGroups = LOCATION_TYPES.map((type) => ({
    type,
    locations: location.children.filter((child) => child.type === type),
  })).filter((group) => group.locations.length > 0);

  const childGrid = (
    <div className="location-detail-type-groups">
      {childTypeGroups.map((group) => (
        <LocationDirectoryFold
          key={group.type}
          title={LOCATION_TYPE_LABELS[group.type]}
          variant="type"
        >
          <div className="location-detail-child-grid">
            {group.locations.map((child, index) => (
              <Link
                href={`/locations/${child.slug}`}
                className="location-directory-card location-detail-child-card cx-item-in"
                style={{ animationDelay: `${Math.min(index * 30, 330)}ms` }}
                key={child.id}
              >
                <span className="location-directory-card-media">
                  <ContentImage
                    imagePath={child.image}
                    alt={`Image of ${child.name}`}
                    size="row"
                  />
                </span>
                <span className="location-directory-card-copy">
                  <h4>{child.name}</h4>
                  <span className="location-directory-card-type">
                    {LOCATION_TYPE_LABELS[child.type]}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </LocationDirectoryFold>
      ))}
    </div>
  );

  const childList = (
    <div className="location-detail-type-groups">
      {childTypeGroups.map((group) => (
        <LocationDirectoryFold
          key={group.type}
          title={LOCATION_TYPE_LABELS[group.type]}
          variant="type"
        >
          <div className="location-detail-child-list">
            <div className="location-detail-child-list-header" aria-hidden="true">
              <span />
              <span>Location</span>
              <span>Type</span>
              <span>Details</span>
            </div>
            {group.locations.map((child, index) => (
              <Link
                href={`/locations/${child.slug}`}
                className="location-detail-child-list-row cx-item-in"
                style={{ animationDelay: `${Math.min(index * 30, 330)}ms` }}
                key={child.id}
              >
                <span className="location-detail-child-list-media">
                  <ContentImage
                    imagePath={child.image}
                    alt={`Image of ${child.name}`}
                    size="row"
                  />
                </span>
                <strong>{child.name}</strong>
                <span>{LOCATION_TYPE_LABELS[child.type]}</span>
                <span>
                  {child._count.shops === 0
                    ? "No shops"
                    : `${child._count.shops} ${
                        child._count.shops === 1 ? "shop" : "shops"
                      }`}
                </span>
              </Link>
            ))}
          </div>
        </LocationDirectoryFold>
      ))}
    </div>
  );

  return (
    <AppShell scenic="detail" wide>
      <article className="location-detail-page">
        <div className="location-detail-layout">
          <div className="location-detail-main">
            <Breadcrumb
              segments={locationBreadcrumbSegments(ancestors)}
              current={location.name}
            />

            <section
              className="profession-detail-hero location-detail-hero"
              aria-labelledby="location-title"
            >
              <div className="profession-detail-stage location-detail-stage">
                <ContentImage
                  imagePath={location.image}
                  alt={`Image of ${location.name}`}
                  size="hero"
                />
              </div>
              <div className="profession-detail-copy">
                <p className="profession-detail-eyebrow">
                  {LOCATION_TYPE_LABELS[location.type]}
                </p>
                <h1 id="location-title" className="public-resource-title">
                  {location.name}
                </h1>
                {description ? (
                  <RichTextContent
                    value={description}
                    className="profession-description rich-text-content"
                  />
                ) : null}
                <div className="profession-detail-chips" aria-label="Location facts">
                  <Link
                    href={`/locations?type=${location.type}`}
                    className="profession-detail-chip"
                  >
                    Type:&nbsp;
                    <strong>{LOCATION_TYPE_LABELS[location.type]}</strong>
                  </Link>
                  <span className="profession-detail-chip">
                    Sub-locations:&nbsp;<strong>{location.children.length}</strong>
                  </span>
                  <span className="profession-detail-chip">
                    Shops:&nbsp;<strong>{location.shops.length}</strong>
                  </span>
                </div>
              </div>
            </section>

            {location.children.length > 0 ? (
              <LocationDetailDirectory
                title="Sub-locations"
                grid={childGrid}
                list={childList}
              />
            ) : null}

            {location.shops.length > 0 ? (
              <CollapsibleSection title="Shops" className="location-detail-section">
                <div className="location-detail-related-grid">
                  {location.shops.map((shop, index) => (
                    <Link
                      href={`/shops/${shop.slug}`}
                      className="location-detail-related-card cx-item-in"
                      style={{ animationDelay: `${Math.min(index * 30, 330)}ms` }}
                      key={shop.id}
                    >
                      <ContentImage
                        imagePath={shop.image}
                        alt={`Image of ${shop.name}`}
                        size="row"
                      />
                      <span>
                        <h3>{shop.name}</h3>
                        <span className="location-detail-related-type">Shop</span>
                        {shop.description ? (
                          <span className="location-detail-related-meta">
                            {shop.description}
                          </span>
                        ) : null}
                        <span className="location-detail-related-meta">
                          {formatInventoryListingCount(shop._count.listings)}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              </CollapsibleSection>
            ) : null}

            {obtainableGroups.length > 0 ? (
              <CollapsibleSection
                title="Obtainable Items"
                className="location-detail-section"
              >
                <div className="location-detail-obtainable-groups">
                  {obtainableGroups.map((group) => (
                    <section className="location-detail-type-group" key={group.type}>
                      <h3>
                        {group.label}
                        <span aria-hidden="true" />
                      </h3>
                      <div className="location-detail-related-grid">
                        {group.items.map((entry, index) => (
                          <Link
                            href={`/items/${entry.item.slug}`}
                            className="location-detail-related-card cx-item-in"
                            style={{ animationDelay: `${Math.min(index * 30, 330)}ms` }}
                            key={entry.item.slug}
                          >
                            <ContentImage
                              imagePath={entry.item.image}
                              alt={`Image of ${entry.item.name}`}
                              size="row"
                            />
                            <span>
                              <h4>{entry.item.name}</h4>
                              <span className="location-detail-related-type">
                                Item
                              </span>
                              <span className="location-detail-related-meta">
                                {entry.description}
                              </span>
                            </span>
                          </Link>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </CollapsibleSection>
            ) : null}
          </div>

          <aside className="location-detail-sidebar" aria-label="Location details">
            <section className="location-detail-sidebar-panel">
              <h2>Location Details</h2>
              <dl>
                <div><dt>Type</dt><dd>{LOCATION_TYPE_LABELS[location.type]}</dd></div>
                <div><dt>Parent</dt><dd>{parent?.name ?? "Root location"}</dd></div>
                <div><dt>Sub-locations</dt><dd>{location.children.length}</dd></div>
                <div><dt>Shops</dt><dd>{location.shops.length}</dd></div>
                <div><dt>Obtainable Items</dt><dd>{obtainableItemCount}</dd></div>
              </dl>
            </section>
            {location.accessNote ? (
              <section className="location-detail-sidebar-panel">
                <h2>Traveler&apos;s Note</h2>
                <p>{location.accessNote}</p>
              </section>
            ) : null}
          </aside>
        </div>
      </article>
    </AppShell>
  );
}
