// The Location workspace wrapper — the FIFTH production composition of
// the shared workspace pieces, following the Item
// (src/components/admin/item-workspace.tsx), Recipe
// (src/components/admin/recipe-workspace.tsx), Profession
// (src/components/admin/profession-workspace.tsx), and Category
// (src/components/admin/category-workspace.tsx) workspaces' precedent
// exactly: AdminWorkspace with the shared RecordList in its recordList
// slot and the page's own content in the primary region. This is
// deliberately the only Location-specific layer: it owns the Location
// list query (name/slug/type-label search, server-side,
// case-insensitive) and the Location URL construction (via the pure
// helpers in src/lib/admin/location-workspace.ts); the shared components
// underneath stay resource-agnostic. Not a generic resource-query
// framework — this is a fifth, independent thin wrapper, not a shared
// base class.
//
// Locations are the only converted resource with a self-referencing
// hierarchy. This slice deliberately does NOT build a tree control,
// expandable hierarchy, or nested navigation — the record list stays a
// single flat, alphabetically ordered list (matching every other
// workspace's own ordering exactly), with the parent's name surfacing as
// concise secondary context only. `include: { parent: true }` loads that
// context in the same query — never a per-row follow-up — so showing it
// introduces no N+1 behavior.
//
// Slice 9F.3 added the optional `recordHref` prop, mirroring
// `ProfessionWorkspace`'s own (Slice 9D.3): the Hierarchy tab route
// passes `locationHierarchyHref` so quick switching stays on that tab.

import { prisma } from "@/lib/db";
import { AdminWorkspace } from "@/components/admin/admin-workspace";
import { RecordList } from "@/components/admin/record-list";
import {
  LOCATION_TYPES,
  LOCATION_TYPE_LABELS,
  type LocationType,
} from "@/lib/validation/location";
import {
  LOCATION_CREATE_PATH,
  LOCATION_LIST_PATH,
  locationEditHref,
  normalizeLocationSearchQuery,
  withLocationSearchQuery,
} from "@/lib/admin/location-workspace";

type LocationWorkspaceProps = {
  /** Raw ?q= value from the page's searchParams; normalized here. */
  rawQuery?: string;
  /** Slug of the location open in the editor (edit/delete routes) —
      marks the selected row. Landing and create pages pass nothing. */
  selectedSlug?: string;
  /** The page's header region (PageHeader plus any toolbar/banners). */
  header: React.ReactNode;
  /** The page's main content (guidance state, create form, edit form, or
      delete confirmation). */
  children: React.ReactNode;
  /** Optional contextual side panel, unused in this pass — reserved for
      a later editor-conversion slice, matching the slot AdminWorkspace
      already exposes. */
  aside?: React.ReactNode;
  /** Builds each record row's link (Slice 9F.3) — defaults to the
      General edit route. The Hierarchy tab route passes
      `locationHierarchyHref` so quick switching between locations stays
      on the Hierarchy tab instead of dropping back to General, mirroring
      `ProfessionWorkspace`'s own `recordHref` prop. */
  recordHref?: (slug: string, query: string) => string;
};

/** Concise secondary row context: the type label, plus the parent's name
    when one exists — a single readable line, never a placeholder dash
    when there is no parent (a root location simply shows its type
    alone). */
function locationSecondaryContext(location: {
  type: LocationType;
  parent: { name: string } | null;
}): string {
  const typeLabel = LOCATION_TYPE_LABELS[location.type];
  return location.parent ? `${typeLabel} · ${location.parent.name}` : typeLabel;
}

export async function LocationWorkspace({
  rawQuery,
  selectedSlug,
  header,
  children,
  aside,
  recordHref = locationEditHref,
}: LocationWorkspaceProps) {
  const query = normalizeLocationSearchQuery(rawQuery);

  // Type-label matching only when it can stay clean and predictable: a
  // fixed, seven-entry lookup against the same LOCATION_TYPE_LABELS the
  // form and public pages already use — never a second query, and never
  // guesswork about enum spelling.
  const matchedTypes = query
    ? LOCATION_TYPES.filter((type) =>
        LOCATION_TYPE_LABELS[type].toLowerCase().includes(query.toLowerCase())
      )
    : [];

  // Server-side filtering on name OR slug OR type label, case-insensitive
  // — the same trimmed-query posture the Item/Recipe/Profession/Category
  // workspaces use. No query means the full list, alphabetical like the
  // previous admin table. The parent relation is loaded alongside (never
  // a per-row follow-up query) so the secondary row context below never
  // triggers an N+1 query.
  const locations = await prisma.location.findMany({
    where: query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { slug: { contains: query, mode: "insensitive" } },
            ...(matchedTypes.length > 0 ? [{ type: { in: matchedTypes } }] : []),
          ],
        }
      : undefined,
    include: { parent: true },
    orderBy: { name: "asc" },
  });

  const rows = locations.map((location) => ({
    href: recordHref(location.slug, query),
    primary: location.name,
    secondary: locationSecondaryContext(location),
    selected: location.slug === selectedSlug,
  }));

  const countLabel = query
    ? `${locations.length} ${locations.length === 1 ? "match" : "matches"}`
    : `${locations.length} ${
        locations.length === 1 ? "location" : "locations"
      }`;

  return (
    <AdminWorkspace
      header={header}
      aside={aside}
      recordList={
        <RecordList
          label="Locations"
          searchAction={LOCATION_LIST_PATH}
          searchValue={query}
          searchLabel="Search locations"
          createHref={withLocationSearchQuery(LOCATION_CREATE_PATH, query)}
          createLabel="+ New location"
          rows={rows}
          countLabel={countLabel}
          empty={
            query ? (
              // Distinct no-match state: the applied query is shown, and
              // the list's own Clear link (rendered because a query is
              // active) is the way out.
              <p>No locations match &ldquo;{query}&rdquo;.</p>
            ) : (
              <p>
                No locations yet. Use &ldquo;+ New location&rdquo; to
                create the first one.
              </p>
            )
          }
        />
      }
    >
      {children}
    </AdminWorkspace>
  );
}
