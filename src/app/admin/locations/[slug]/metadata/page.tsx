import { notFound } from "next/navigation";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { EditorHeader } from "@/components/admin/editor-header";
import { EditorTabs } from "@/components/admin/editor-tabs";
import { ContextPanel } from "@/components/admin/context-panel";
import { VerificationPanel } from "@/components/admin/verification-panel";
import { TimestampsPanel } from "@/components/admin/timestamps-panel";
import { LocationWorkspace } from "@/components/admin/location-workspace";
import {
  LOCATION_LIST_PATH,
  locationEditorTabs,
  locationMetadataHref,
  normalizeLocationSearchQuery,
  withLocationSearchQuery,
} from "@/lib/admin/location-workspace";
import { prisma } from "@/lib/db";
import { LOCATION_TYPE_LABELS } from "@/lib/validation/location";

export const dynamic = "force-dynamic";

type LocationMetadataPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
};

export default async function LocationMetadataPage({
  params,
  searchParams,
}: LocationMetadataPageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { slug } = await params;
  const { q } = await searchParams;
  const query = normalizeLocationSearchQuery(q);

  const [location, gameVersions] = await Promise.all([
    prisma.location.findUnique({
      where: { slug },
      // One restrained query: the same verifiedGameVersion relation the
      // General edit page already loads, the parent relation (a single
      // row, never a tree walk), and _count for both relationship tabs'
      // own facts (children, acquisitionSources) — never the full
      // collections, which have nothing to do with this tab; the
      // Hierarchy and Acquisition Sources tabs already cover those
      // relationships in full.
      include: {
        parent: true,
        verifiedGameVersion: true,
        _count: { select: { children: true, acquisitionSources: true } },
      },
    }),
    // Current version first, then newest — the same ordering every other
    // verification surface uses, feeding the read-only status/current-
    // version rows below.
    prisma.gameVersion.findMany({
      orderBy: [{ isCurrent: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  if (!location) {
    notFound();
  }

  const tabs = locationEditorTabs(location.slug, query, "metadata");

  // The Metadata tab (Slice 9F.5, completing the Location workspace):
  // read-only administrative information only — no form, no picker, no
  // checkbox, no delete action, no image, hierarchy-mutation, or
  // Acquisition-Source-mutation control. The shared VerificationPanel
  // renders in its readOnly mode (status badge and stamp rows, no
  // composed picker/checkbox) and TimestampsPanel supplies created/
  // updated/verified dates; neither component ever surfaces the record's
  // database id or other internal details. The Location's own slug is
  // already visible via the header subtitle, exactly as on every other
  // Location tab. Description and access note are deliberately NOT
  // repeated here — both are editable General fields, and this tab
  // exists to show administrative facts General doesn't, not to
  // duplicate it. The Location context panel below adds the facts useful
  // here — type (always, since it is required), parent (only when
  // present — a root location simply omits the row), and the child/
  // Acquisition Source counts via `_count` (never the full collections)
  // — both always render, since zero is itself meaningful administrative
  // context.
  return (
    <LocationWorkspace
      rawQuery={q}
      selectedSlug={location.slug}
      recordHref={locationMetadataHref}
      header={
        <>
          <EditorHeader
            title={location.name}
            subtitle={location.slug}
            backHref={withLocationSearchQuery(LOCATION_LIST_PATH, query)}
            backLabel="Back to Location Management"
          />

          <EditorTabs label="Location editor sections" tabs={tabs} />
        </>
      }
    >
      <ContextPanel title="Location">
        <dl className="admin-panel-dl">
          <div className="admin-panel-row">
            <dt>Type</dt>
            <dd>{LOCATION_TYPE_LABELS[location.type]}</dd>
          </div>

          {location.parent ? (
            <div className="admin-panel-row">
              <dt>Parent location</dt>
              <dd>{location.parent.name}</dd>
            </div>
          ) : null}

          <div className="admin-panel-row">
            <dt>Sub-locations</dt>
            <dd>{location._count.children}</dd>
          </div>

          <div className="admin-panel-row">
            <dt>Acquisition Sources</dt>
            <dd>{location._count.acquisitionSources}</dd>
          </div>
        </dl>
      </ContextPanel>

      <VerificationPanel
        gameVersions={gameVersions}
        verifiedAt={location.verifiedAt}
        verifiedGameVersion={location.verifiedGameVersion}
        readOnly
      />

      <TimestampsPanel
        createdAt={location.createdAt}
        updatedAt={location.updatedAt}
        verifiedAt={location.verifiedAt}
      />
    </LocationWorkspace>
  );
}
