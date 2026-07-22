// The Location workspace wrapper — the FIFTH production composition of
// the shared workspace pieces, following the Item
// (src/components/admin/item-workspace.tsx), Recipe
// (src/components/admin/recipe-workspace.tsx), Profession
// (src/components/admin/profession-workspace.tsx), and Category
// (src/components/admin/category-workspace.tsx) workspaces' precedent
// exactly: AdminWorkspace with the shared RecordList in its recordList
// slot and the page's own content in the primary region. This is
// deliberately the only Location-specific layer: it owns the Location
// list query (loads the complete list; filtering by name, Page address,
// and type label happens entirely client-side via the shared RecordList,
// Phase B1) and the Location URL construction (via the pure helpers in
// src/lib/admin/location-workspace.ts); the shared components underneath
// stay resource-agnostic. Not a generic resource-query framework — this
// is a fifth, independent thin wrapper, not a shared base class.
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
import { getImagePublicUrl } from "@/lib/storage/images";
import {
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
  /** The page's header region (PageHeader plus any toolbar/banners) for
      list/landing pages. Editor pages (create/edit/tab routes) no longer
      pass this — their own EditorHeader/EditorTabs/error content now
      renders as the first children instead (Visual Pass II Section 3). */
  header?: React.ReactNode;
  /** The selected location's own EditorHeader/EditorTabs/error banner
      (Visual Pass II correction pass, Section 3) — passed straight
      through to AdminWorkspace's editorHeader slot. */
  editorHeader?: React.ReactNode;
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
  editorHeader,
  children,
  aside,
  recordHref = locationEditHref,
}: LocationWorkspaceProps) {
  const query = normalizeLocationSearchQuery(rawQuery);

  // The COMPLETE list, always — filtering is now instant and client-side
  // (Phase B1, System A), so there is no server-side `where`/`q` filter
  // and no pagination `skip`/`take` here at all. Alphabetical, matching
  // the previous admin table's own ordering. The parent relation is
  // loaded alongside (never a per-row follow-up query) so the secondary
  // row context below never triggers an N+1 query.
  //
  // The previous server-side search additionally matched a Location TYPE
  // label (e.g. "Town") — restored below via RecordListRow's own optional
  // `searchTerms`, the shared filter's resource-agnostic escape hatch for
  // exactly this kind of already-displayed, already-loaded short metadata
  // (never a Location-specific branch inside the shared matcher itself).
  const locations = await prisma.location.findMany({
    include: { parent: true },
    orderBy: { name: "asc" },
  });

  // Resolved concurrently — image is already a scalar field on every row
  // from the query above (include only adds the parent relation), so
  // this is pure URL construction, never a second database query.
  const imageUrls = await Promise.all(
    locations.map((location) => getImagePublicUrl(location.image))
  );

  const rows = locations.map((location, index) => ({
    href: recordHref(location.slug, query),
    primary: location.name,
    slug: location.slug,
    // The type label alone (not the combined "Type · Parent" secondary
    // string below) — matches exactly what the row already visibly shows
    // via its own type, restoring the previous server-side behavior.
    searchTerms: [LOCATION_TYPE_LABELS[location.type]],
    secondary: locationSecondaryContext(location),
    selected: location.slug === selectedSlug,
    image: imageUrls[index],
  }));

  return (
    <AdminWorkspace
      header={header}
      editorHeader={editorHeader}
      aside={aside}
      recordList={
        <RecordList
          label="Locations"
          listPath={LOCATION_LIST_PATH}
          initialQuery={query}
          searchLabel="Search locations"
          createHref={withLocationSearchQuery(LOCATION_CREATE_PATH, query)}
          createLabel="+ New location"
          rows={rows}
          showImages
          noun={{ singular: "location", plural: "locations" }}
          empty={
            <p>
              No locations yet. Use &ldquo;+ New location&rdquo; to
              create the first one.
            </p>
          }
        />
      }
    >
      {children}
    </AdminWorkspace>
  );
}
