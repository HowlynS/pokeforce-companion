import { notFound } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { EditorHeader } from "@/components/admin/editor-header";
import { EditorTabs } from "@/components/admin/editor-tabs";
import { ContextPanel } from "@/components/admin/context-panel";
import { prisma } from "@/lib/db";
import { LocationWorkspace } from "@/components/admin/location-workspace";
import {
  locationEditorTabs,
  locationSourcesHref,
  normalizeLocationSearchQuery,
  sortLocationAcquisitionSourcesByType,
} from "@/lib/admin/location-workspace";
import {
  ACQUISITION_TYPE_LABELS,
  type AcquisitionType,
} from "@/lib/validation/acquisition-source";

export const dynamic = "force-dynamic";

type LocationSourcesPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
};

/**
 * One Acquisition Source row: the linked Item is the primary identifying
 * fact — this location is already the page's own context, so it is never
 * repeated — linking to the EXISTING Item-owned source editor (no
 * Location `q` carried onto that link, since it is a different
 * workspace's own route). The type label is a concise, always-present
 * column (Location type is required on every source's own record); every
 * other optional fact (source label, profession, quantity, notes) renders
 * as a detail line beneath the item name only when present, in ONE
 * wrapper — no placeholder dash, no empty label, no blank cell.
 */
function SourceRow({
  source,
}: {
  source: {
    id: string;
    type: AcquisitionType;
    sourceLabel: string | null;
    quantity: string | null;
    notes: string | null;
    item: { slug: string; name: string };
    profession: { name: string } | null;
  };
}) {
  const details: string[] = [];

  if (source.sourceLabel) {
    details.push(`Source: ${source.sourceLabel}`);
  }
  if (source.profession) {
    details.push(`Profession: ${source.profession.name}`);
  }
  if (source.quantity) {
    details.push(`Quantity: ${source.quantity}`);
  }
  if (source.notes) {
    details.push(`Notes: ${source.notes}`);
  }

  return (
    <tr>
      <td>
        <a
          href={`/admin/items/${source.item.slug}/sources/${source.id}/edit`}
          className="link-accent"
        >
          {source.item.name}
        </a>
        {details.length > 0 ? (
          <div className="admin-table-meta">
            {details.map((detail) => (
              <div key={detail}>{detail}</div>
            ))}
          </div>
        ) : null}
      </td>
      <td>{ACQUISITION_TYPE_LABELS[source.type]}</td>
    </tr>
  );
}

export default async function LocationSourcesPage({
  params,
  searchParams,
}: LocationSourcesPageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { slug } = await params;
  const { q } = await searchParams;
  const query = normalizeLocationSearchQuery(q);

  // One restrained query: this location's own identity plus its linked
  // Acquisition Sources, each with the Item/Profession fields the row
  // needs already included — no per-row follow-up query. Ordered by item
  // name at the database level; grouped by type (the enum's declared
  // order, via the shared sort helper) in plain JS below — the stable
  // sort preserves that per-item-name order within each type group. No
  // verifiedGameVersion include: verification detail belongs to a later
  // Metadata tab, matching every other relationship tab's own restraint.
  const location = await prisma.location.findUnique({
    where: { slug },
    include: {
      acquisitionSources: {
        include: { item: true, profession: true },
        orderBy: { item: { name: "asc" } },
      },
    },
  });

  if (!location) {
    notFound();
  }

  const sources = sortLocationAcquisitionSourcesByType(
    location.acquisitionSources
  );
  const hasSources = sources.length > 0;
  const tabs = locationEditorTabs(location.slug, query, "sources");

  // The Acquisition Sources tab (Slice 9F.4): strictly read-only,
  // navigational content inside the Location workspace — no create-source
  // form, no inline source editing, no unlink control, no delete control.
  // Every row links to the EXISTING Item-owned source editor; Acquisition
  // Sources remain managed entirely from the Item workspace, exactly as
  // before this slice.
  return (
    <LocationWorkspace
      rawQuery={q}
      selectedSlug={location.slug}
      recordHref={locationSourcesHref}
      header={
        <>
          <EditorHeader
            eyebrow="Location"
            title={location.name}
            subtitle={location.slug}
          />

          <EditorTabs label="Location editor sections" tabs={tabs} />
        </>
      }
    >
      {!hasSources ? (
        <EmptyState
          title="No acquisition sources reference this location yet"
          description="Acquisition sources that name this location will appear here. Manage them from the item's own Acquisition Sources tab."
        />
      ) : (
        <ContextPanel
          title="Acquisition Sources"
          description={`${sources.length} ${
            sources.length === 1 ? "source" : "sources"
          }`}
        >
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  {["Item", "Type"].map((heading) => (
                    <th key={heading}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sources.map((source) => (
                  <SourceRow key={source.id} source={source} />
                ))}
              </tbody>
            </table>
          </div>
        </ContextPanel>
      )}
    </LocationWorkspace>
  );
}
