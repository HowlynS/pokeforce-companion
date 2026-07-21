import { notFound } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { ContentImage } from "@/components/content/content-image";
import { Card } from "@/components/ui/card";
import { ContentGrid } from "@/components/ui/content-grid";
import { designTokens } from "@/lib/design-tokens";
import { prisma } from "@/lib/db";
import { LOCATION_TYPE_LABELS } from "@/lib/validation/location";
import { groupObtainableItemsByType } from "@/lib/validation/acquisition-source";
import {
  loadLocationAncestors,
  type LocationAncestor,
} from "@/lib/locations/location-hierarchy";

export const dynamic = "force-dynamic";

type LocationDetailPageProps = {
  params: Promise<{ slug: string }>;
};

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        margin: "0 0 16px",
        fontSize: "24px",
        lineHeight: 1.2,
      }}
    >
      {children}
    </h2>
  );
}

// Semantic breadcrumb navigation (Slice 10C): a labeled <nav> around an
// <ol>, so the hierarchy is understandable to assistive technology without
// relying on the decorative "/" separators (each marked aria-hidden) or on
// color alone. "Locations" is a stable root entry point; every ancestor is
// a real link; the current Location is the final, non-linked item with
// aria-current="page" — never itself a link, matching every other
// "current page" convention already used in this codebase (e.g. the admin
// nav's own aria-current="page"). Ancestor links are muted and underlined
// so they read as interactive independent of hover; the current item is
// full-strength text with no underline, the same non-color distinction.
function LocationBreadcrumb({
  ancestors,
  currentName,
}: {
  ancestors: readonly LocationAncestor[];
  currentName: string;
}) {
  return (
    <nav aria-label="Breadcrumb" style={{ marginBottom: "16px" }}>
      <ol
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "6px",
          margin: 0,
          padding: 0,
          listStyle: "none",
          fontSize: "14px",
        }}
      >
        <li>
          <Link
            href="/locations"
            style={{
              color: designTokens.colors.textMuted,
              textDecoration: "underline",
            }}
          >
            Locations
          </Link>
        </li>

        {ancestors.map((ancestor) => (
          <li
            key={ancestor.slug}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <span aria-hidden="true" style={{ color: designTokens.colors.textMuted }}>
              /
            </span>
            <a
              href={`/locations/${ancestor.slug}`}
              style={{
                color: designTokens.colors.textMuted,
                textDecoration: "underline",
              }}
            >
              {ancestor.name}
            </a>
          </li>
        ))}

        <li style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span aria-hidden="true" style={{ color: designTokens.colors.textMuted }}>
            /
          </span>
          <span aria-current="page" style={{ color: designTokens.colors.text }}>
            {currentName}
          </span>
        </li>
      </ol>
    </nav>
  );
}

export default async function LocationDetailPage({
  params,
}: LocationDetailPageProps) {
  const { slug } = await params;

  const location = await prisma.location.findUnique({
    where: { slug },
    include: {
      // Only the fields the Sub-locations section needs — never
      // verification/Game Version fields, and never a database id.
      // Ordered by name first, slug second: a deterministic tie-breaker
      // for the (rare) case of two children sharing a name, since name
      // alone is not guaranteed unique.
      children: {
        select: { name: true, slug: true, type: true },
        orderBy: [{ name: "asc" }, { slug: "asc" }],
      },
      // Only the fields the public "Obtainable Items" section needs —
      // never verification/Game Version fields, and never a database id.
      // Navigating this to-many relation from the Location itself already
      // guarantees every row's own locationId is this Location's id, so a
      // source referencing a different Location (or none at all) can
      // never appear here.
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

  if (!location) {
    notFound();
  }

  // Full ancestor chain (Slice 10C), root-first — empty for a root
  // Location. This is the breadcrumb's only source of parent context; the
  // page no longer also shows a separate "Parent location" card, since
  // that would repeat the exact same fact the breadcrumb already states
  // right above the title.
  const ancestors = location.parentId
    ? await loadLocationAncestors(prisma, location.parentId)
    : [];

  // Grouped by type (enum order) and deduplicated by item — a single item
  // can have more than one source of the same type at this location, and
  // must render as one card, not several. Any type with zero matching
  // items is omitted entirely, and the whole section below is skipped
  // when there are no groups at all.
  const obtainableGroups = groupObtainableItemsByType(location.acquisitionSources);

  // Only meaningful metadata is shown: unset optional fields are omitted
  // rather than rendered as placeholder values.
  const details = [`Type: ${LOCATION_TYPE_LABELS[location.type]}`];

  return (
    <AppShell>
      <LocationBreadcrumb ancestors={ancestors} currentName={location.name} />

      <PageHeader
        title={location.name}
        description={location.description ?? undefined}
      />

      <section className="detail-hero">
        <ContentImage
          imagePath={location.image}
          alt={`Image of ${location.name}`}
          size="detail"
        />

        <div className="detail-hero-facts">
          <Card title="Details" description={details.join(" · ")} />

          {location.accessNote ? (
            <Card title="Access" description={location.accessNote} />
          ) : null}

          {/* Verification metadata is deliberately NOT rendered here:
              since Slice 9A, Game Version and verification information is
              admin-only and never appears on public pages. */}
        </div>
      </section>

      {/* The entire section is omitted when there are no children — no
          heading, no empty state — rather than announcing an absence that
          is not (yet) meaningful information for a location page. */}
      {location.children.length > 0 ? (
        <section style={{ marginBottom: designTokens.layout.sectionGap }}>
          <SectionHeading>Sub-locations</SectionHeading>

          <ContentGrid>
            {location.children.map((child) => (
              <Card
                key={child.slug}
                title={child.name}
                description={LOCATION_TYPE_LABELS[child.type]}
                href={`/locations/${child.slug}`}
              />
            ))}
          </ContentGrid>
        </section>
      ) : null}

      {/* Route Hub foundation (Slice 10A): omitted entirely (heading
          included) when no Acquisition Source references this location —
          never a public empty state. Grouped by type so a location with
          several acquisition methods never repeats the type on every
          card; the heading makes no claim that the list is complete,
          mirroring the Item page's own "How to obtain" section. */}
      {obtainableGroups.length > 0 ? (
        <section>
          <SectionHeading>Obtainable Items</SectionHeading>

          {obtainableGroups.map((group) => (
            <div key={group.type} style={{ marginBottom: "16px" }}>
              <p
                style={{
                  margin: "0 0 8px",
                  fontWeight: 700,
                  fontSize: "16px",
                }}
              >
                {group.label}
              </p>

              <ContentGrid>
                {group.items.map((entry) => (
                  <Card
                    key={entry.item.slug}
                    title={entry.item.name}
                    description={entry.description}
                    href={`/items/${entry.item.slug}`}
                    media={
                      <ContentImage
                        imagePath={entry.item.image}
                        alt={`Image of ${entry.item.name}`}
                        size="card"
                      />
                    }
                  />
                ))}
              </ContentGrid>
            </div>
          ))}
        </section>
      ) : null}
    </AppShell>
  );
}
