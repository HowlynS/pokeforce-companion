import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { ContentImage } from "@/components/content/content-image";
import { WorldSidebar } from "@/components/content/world-tree";
import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { EmptyState } from "@/components/ui/empty-state";
import { readCatalogueQueryValue } from "@/lib/catalogue-query";
import { prisma } from "@/lib/db";
import { LOCATION_TYPE_LABELS } from "@/lib/validation/location";
import { buildWorldTree, selectWorldLocation } from "@/lib/world/world-tree";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "World Navigation | PokeForce Companion",
  description:
    "Browse the world by containment: regions, their nested locations, the shops that trade there, and the items obtainable at each place.",
};

type WorldPageProps = {
  searchParams: Promise<{
    location?: string | string[];
    q?: string | string[];
  }>;
};

function readSlug(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : null;
}

export default async function WorldPage({ searchParams }: WorldPageProps) {
  const { location: rawLocation, q: rawQuery } = await searchParams;
  const requestedSlug = readSlug(rawLocation);
  const query = readCatalogueQueryValue(rawQuery) ?? "";

  // One restrained query for the tree: only the fields the sidebar renders.
  const locations = await prisma.location.findMany({
    select: { id: true, name: true, slug: true, type: true, parentId: true },
    orderBy: [{ name: "asc" }, { slug: "asc" }],
  });

  const tree = buildWorldTree(locations);
  // Selection resolves against the full tree, so a filtered sidebar never
  // silently changes which Location the detail pane is describing.
  const selection = selectWorldLocation(tree, requestedSlug);

  // Only the selected Location's own relationships are loaded — never a
  // descendant walk, matching the Milestone 10 rule that a parent Location
  // never inherits or aggregates its children's acquisition data.
  const detail = selection
    ? await prisma.location.findUnique({
        where: { id: selection.selected.id },
        select: {
          name: true,
          slug: true,
          type: true,
          description: true,
          image: true,
          accessNote: true,
          _count: { select: { children: true, shops: true } },
          shops: {
            select: {
              id: true,
              name: true,
              slug: true,
              _count: { select: { listings: true } },
            },
            orderBy: [{ name: "asc" }, { slug: "asc" }],
          },
          acquisitionSources: {
            select: {
              id: true,
              item: { select: { name: true, slug: true, image: true } },
            },
          },
        },
      })
    : null;

  // One chip per Item, not per source row: an Item can be obtainable here
  // through more than one Acquisition Source.
  const obtainableItems = detail
    ? [
        ...new Map(
          detail.acquisitionSources.map((source) => [source.item.slug, source.item]),
        ).values(),
      ].sort((a, b) => a.name.localeCompare(b.name) || a.slug.localeCompare(b.slug))
    : [];

  // A restrained entrance stagger down the right pane, in the order the pane
  // is actually read: identity first, then each panel that is present. Panels
  // that are omitted (hide-empty) take no slot, so the last panel is never
  // waiting on a delay for something that never rendered.
  const hasShopsPanel = (detail?.shops.length ?? 0) > 0;
  const panelDelays = {
    shops: "30ms",
    facts: hasShopsPanel ? "60ms" : "30ms",
    items: hasShopsPanel ? "90ms" : "60ms",
  } as const;

  return (
    <AppShell catalogue scenic="catalogue">
      <div className="directory-page world-page">
        <Breadcrumb segments={[{ name: "Home", href: "/" }]} current="World Navigation" />
        <h1 className="directory-title">World Navigation</h1>

        {selection && detail ? (
          <div className="world-workspace">
            <div className="world-sidebar">
              {/* The whole tree is handed to the client so the filter can run
                  on the keystroke; `?q=` only seeds it, and the same pure
                  filterWorldTree the server used still decides what survives. */}
              <WorldSidebar
                nodes={tree}
                selectedId={selection.selected.id}
                selectedSlug={selection.selected.slug}
                expandedIds={[...selection.expandedIds]}
                initialQuery={query}
              />
            </div>

            <div className="world-detail">
              {/* Keyed by the selected Location so React mounts fresh nodes on
                  every selection change and the entrance replays — the same
                  narrow keyed-subtree approach CatalogueViewSwitch uses. The
                  key is scoped to this presentation content only: the tree's
                  open branches, the filter field, and the URL all live
                  outside it and keep their state. */}
              <div
                key={detail.slug}
                className="world-detail-content"
                data-world-location={detail.slug}
              >
                <p className="world-detail-path world-detail-in">
                  {selection.path.map((node, index) => (
                    <span key={node.id}>
                      {index > 0 ? (
                        <span className="world-detail-path-separator" aria-hidden="true">
                          /
                        </span>
                      ) : null}
                      <span
                        className={
                          index === selection.path.length - 1
                            ? "world-detail-path-current"
                            : undefined
                        }
                      >
                        {node.name}
                      </span>
                    </span>
                  ))}
                </p>

                <div className="world-detail-identity world-detail-in">
                  <span className="world-detail-stage">
                    <ContentImage
                      imagePath={detail.image}
                      alt={`Image of ${detail.name}`}
                      size="row"
                    />
                  </span>
                  <div className="world-detail-copy">
                    <p className="world-detail-eyebrow">
                      {LOCATION_TYPE_LABELS[detail.type]}
                    </p>
                    <div className="world-detail-title-row">
                      <h2>{detail.name}</h2>
                      <Link
                        className="world-detail-full-page"
                        href={`/locations/${detail.slug}`}
                      >
                        View full page <span aria-hidden="true">→</span>
                      </Link>
                    </div>
                    {detail.description ? (
                      <p className="world-detail-description">{detail.description}</p>
                    ) : null}
                  </div>
                </div>

                <div className="world-panels">
                  {detail.shops.length > 0 ? (
                    <section
                      className="world-panel world-detail-in"
                      style={{ "--world-detail-in-delay": panelDelays.shops } as CSSProperties}
                    >
                      <h3>Shops</h3>
                      <ul className="world-panel-list">
                        {detail.shops.map((shop) => (
                          <li key={shop.id}>
                            <Link href={`/shops/${shop.slug}`}>{shop.name}</Link>
                            <span className="world-panel-meta">
                              {shop._count.listings}{" "}
                              {shop._count.listings === 1 ? "listing" : "listings"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  {/* The handoff's second top panel is "NPCs Present". Production
                      has no NPC model, so that panel is omitted entirely rather
                      than faked; this factual panel keeps the two-up composition
                      using fields the Location detail page already exposes. When
                      a Location has no Shops it is the only panel on its row, so
                      it spans rather than leaving the handoff's grid half empty. */}
                  <section
                    className={
                      detail.shops.length > 0
                        ? "world-panel world-detail-in"
                        : "world-panel world-panel--wide world-detail-in"
                    }
                    style={{ "--world-detail-in-delay": panelDelays.facts } as CSSProperties}
                  >
                    <h3>Location facts</h3>
                    <dl className="world-panel-facts">
                      <div>
                        <dt>Type</dt>
                        <dd>{LOCATION_TYPE_LABELS[detail.type]}</dd>
                      </div>
                      <div>
                        <dt>Sub-locations</dt>
                        <dd>{detail._count.children}</dd>
                      </div>
                      <div>
                        <dt>Shops</dt>
                        <dd>{detail._count.shops}</dd>
                      </div>
                      <div>
                        <dt>Obtainable items</dt>
                        <dd>{obtainableItems.length}</dd>
                      </div>
                    </dl>
                    {detail.accessNote ? (
                      <p className="world-panel-note">{detail.accessNote}</p>
                    ) : null}
                  </section>

                  {obtainableItems.length > 0 ? (
                    <section
                      className="world-panel world-panel--wide world-detail-in"
                      style={{ "--world-detail-in-delay": panelDelays.items } as CSSProperties}
                    >
                      <h3>Obtainable items here</h3>
                      <ul className="world-item-chips">
                        {obtainableItems.map((item) => (
                          <li key={item.slug}>
                            <Link href={`/items/${item.slug}`}>
                              <span className="world-item-chip-stage">
                                <ContentImage
                                  imagePath={item.image}
                                  alt={`Image of ${item.name}`}
                                  size="row"
                                />
                              </span>
                              <span>{item.name}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState
            title="No locations yet"
            description="World Navigation builds its region tree from real Location records and their parent/child containment. Once locations exist, they appear here with the shops that trade there and the items obtainable at each place."
          />
        )}
      </div>
    </AppShell>
  );
}
