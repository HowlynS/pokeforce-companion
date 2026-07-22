import { notFound } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { EditorHeader } from "@/components/admin/editor-header";
import { EditorTabs } from "@/components/admin/editor-tabs";
import { EditorActions } from "@/components/admin/editor-actions";
import { ContextPanel } from "@/components/admin/context-panel";
import { prisma } from "@/lib/db";
import { LocationWorkspace } from "@/components/admin/location-workspace";
import {
  LOCATION_LIST_PATH,
  hierarchyRelationshipCount,
  locationEditorTabs,
  locationHierarchyHref,
  normalizeLocationSearchQuery,
  withLocationSearchQuery,
} from "@/lib/admin/location-workspace";
import { LOCATION_TYPE_LABELS, type LocationType } from "@/lib/validation/location";
import { updateLocationHierarchyAction } from "../../actions";

export const dynamic = "force-dynamic";

// Errors updateLocationHierarchyAction can actually produce (Slice 9F.3):
// every other Location error belongs to the General editor's own action
// and route.
const errorMessages: Record<string, string> = {
  invalid_parent: "Select an existing location, or choose No parent.",
  cyclic_parent:
    "A location cannot be its own parent or one of its own sub-locations.",
  missing_location: "That location no longer exists.",
};

type LocationHierarchyPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; error?: string }>;
};

/** One sub-location row: the type label as concise context, linking to
    the EXISTING General edit route — no inline editing, no Hierarchy `q`
    carried onto that link (mirroring the Profession Recipes tab's own
    Recipe-name-cell precedent). */
function ChildLocationRow({
  slug,
  name,
  type,
}: {
  slug: string;
  name: string;
  type: LocationType;
}) {
  return (
    <tr>
      <td>
        <a href={`/admin/locations/${slug}/edit`} className="link-accent">
          {name}
        </a>
      </td>
      <td>{LOCATION_TYPE_LABELS[type]}</td>
    </tr>
  );
}

export default async function LocationHierarchyPage({
  params,
  searchParams,
}: LocationHierarchyPageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { slug } = await params;
  const { q, error } = await searchParams;
  const errorMessage = error ? errorMessages[error] ?? "Something went wrong." : null;
  const query = normalizeLocationSearchQuery(q);

  // One restrained query: this location's own identity plus its DIRECT
  // children only (never a recursive descendant walk), ordered
  // alphabetically — the same ordering the public Sub-locations section
  // and every other converted resource's own relationship tab use. No
  // acquisitionSources include — that relation belongs to a later slice.
  const [location, allLocations] = await Promise.all([
    prisma.location.findUnique({
      where: { slug },
      include: {
        children: { orderBy: { name: "asc" } },
        // Count only — feeds the Acquisition Sources tab's own badge;
        // this page never needs the actual source rows themselves.
        _count: { select: { acquisitionSources: true } },
      },
    }),
    prisma.location.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!location) {
    notFound();
  }

  // A location can never usefully be its own parent — filtered out here for
  // a cleaner picker. Its descendants are NOT filtered from this list (that
  // would need a tree walk just to build the options); choosing one is
  // still rejected server-side by the same cycle guard the submission uses.
  const parentOptions = allLocations.filter(
    (candidate) => candidate.id !== location.id
  );

  const hasChildren = location.children.length > 0;
  const tabs = locationEditorTabs(location.slug, query, "hierarchy", {
    hierarchy: hierarchyRelationshipCount({
      parentId: location.parentId,
      childrenCount: location.children.length,
    }),
    acquisitionSources: location._count.acquisitionSources,
  });

  // The Hierarchy tab (Slice 9F.3): parent assignment, moved out of
  // General, plus a read-only view of this location's direct children.
  // updateLocationHierarchyAction touches ONLY parentId — name, slug,
  // type, description, access note, image, and verification metadata are
  // never read from this form and never written by this action. No
  // ImagePanel/VerificationPanel/TimestampsPanel — this tab has nothing
  // to do with any of them. Danger Zone was removed from this
  // relationship tab (Visual Pass II Section 7: General tab only) —
  // Delete stays reachable via the General tab's own unconditional
  // DangerZonePanel.
  return (
    <LocationWorkspace
      rawQuery={q}
      selectedSlug={location.slug}
      recordHref={locationHierarchyHref}
      editorHeader={
        <>
          <EditorHeader
            eyebrow="Location"
            title={location.name}
            subtitle={location.slug}
          />

          <EditorTabs label="Location editor sections" tabs={tabs} />

          {errorMessage ? (
            <p role="alert" className="banner banner-error">
              {errorMessage}
            </p>
          ) : null}
        </>
      }
    >
      <div className="admin-editor-surface">
      <form
        action={updateLocationHierarchyAction}
        className="form-grid form-grid-responsive"
      >
        <input type="hidden" name="id" value={location.id} />
        <input type="hidden" name="originalSlug" value={location.slug} />

        {/* Visual Pass II correction pass (Section 9): the old
            <fieldset><legend>Parent Location</legend> wrapper duplicated
            this same fact twice — the uppercase legend and the smaller
            "Parent location" field label right beneath it said the same
            thing. A single ordinary field (matching every ungrouped field
            elsewhere in this form) is the one clear heading now; removing
            the fieldset's own border also removes the extra divider it
            created immediately above the sticky Save Hierarchy/Cancel
            row, leaving only that row's own standard top border. */}
        <label className="form-field">
          <span className="form-field-label">Parent location</span>
          <select
            name="parentId"
            defaultValue={location.parentId ?? ""}
            className="form-input"
          >
            <option value="">No parent</option>
            {parentOptions.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </select>
        </label>

        <EditorActions
          submitLabel="Save Hierarchy"
          cancelHref={withLocationSearchQuery(LOCATION_LIST_PATH, query)}
        />
      </form>
      </div>

      {!hasChildren ? (
        <EmptyState
          title="No sub-locations yet"
          description="Locations that use this one as their parent will appear here."
        />
      ) : (
        <ContextPanel
          title="Sub-locations"
          description={`${location.children.length} ${
            location.children.length === 1 ? "sub-location" : "sub-locations"
          }`}
        >
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  {["Name", "Type"].map((heading) => (
                    <th key={heading}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {location.children.map((child) => (
                  <ChildLocationRow
                    key={child.id}
                    slug={child.slug}
                    name={child.name}
                    type={child.type}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </ContextPanel>
      )}
    </LocationWorkspace>
  );
}
