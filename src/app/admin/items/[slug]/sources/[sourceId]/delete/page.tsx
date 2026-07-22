import { notFound } from "next/navigation";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { EditorHeader } from "@/components/admin/editor-header";
import { EditorTabs } from "@/components/admin/editor-tabs";
import { ItemWorkspace } from "@/components/admin/item-workspace";
import {
  itemEditorTabs,
  itemSourcesHref,
  normalizeItemSearchQuery,
} from "@/lib/admin/item-workspace";
import { prisma } from "@/lib/db";
import { ACQUISITION_TYPE_LABELS } from "@/lib/validation/acquisition-source";
import { deleteAcquisitionSourceAction } from "../../actions";

export const dynamic = "force-dynamic";

type DeleteAcquisitionSourcePageProps = {
  params: Promise<{ slug: string; sourceId: string }>;
  searchParams: Promise<{ q?: string }>;
};

export default async function DeleteAcquisitionSourcePage({
  params,
  searchParams,
}: DeleteAcquisitionSourcePageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { slug, sourceId } = await params;
  const { q } = await searchParams;
  const query = normalizeItemSearchQuery(q);

  const item = await prisma.item.findUnique({ where: { slug } });

  if (!item) {
    notFound();
  }

  const source = await prisma.acquisitionSource.findUnique({
    where: { id: sourceId },
    include: { location: true, profession: true },
  });

  // The source must exist AND belong to this exact item — a source id from
  // a different item's URL is treated the same as a missing one.
  if (!source || source.itemId !== item.id) {
    notFound();
  }

  const tabs = itemEditorTabs(item.slug, query, "sources");

  // Inside the Item workspace (Slice 9B.6): the record list marks this
  // item selected and keeps quick switching on the Acquisition Sources
  // tab. Matches the Item's own delete-confirmation page precedent
  // (Slice 9B.4/9B.5): no aside, no sticky EditorActions — the confirm
  // card's own Delete/Cancel pair is unchanged.
  return (
    <ItemWorkspace
      rawQuery={q}
      selectedSlug={item.slug}
      recordHref={itemSourcesHref}
      header={
        <>
          <EditorHeader
            eyebrow="Acquisition Source"
            title="Delete Acquisition Source"
            subtitle={item.name}
            backHref={itemSourcesHref(item.slug, query)}
            backLabel="Back to Acquisition Sources"
          />

          <EditorTabs label="Item editor sections" tabs={tabs} />
        </>
      }
    >
      <div className="confirm-card">
        <p>
          You are about to permanently delete this{" "}
          <strong>{ACQUISITION_TYPE_LABELS[source.type]}</strong> source for{" "}
          <strong>{item.name}</strong>. This action cannot be undone.
        </p>

        <p className="text-muted">
          Source label: {source.sourceLabel ?? "None"}
        </p>
        <p className="text-muted">
          Location: {source.location?.name ?? "None"}
        </p>
        <p className="text-muted">
          Profession: {source.profession?.name ?? "None"}
        </p>

        <div className="form-actions">
          <form action={deleteAcquisitionSourceAction}>
            <input type="hidden" name="id" value={source.id} />
            <input type="hidden" name="itemSlug" value={item.slug} />
            <button type="submit" className="btn btn-danger">
              Delete Permanently
            </button>
          </form>

          <a
            href={itemSourcesHref(item.slug, query)}
            className="btn btn-secondary"
          >
            Cancel
          </a>
        </div>
      </div>
    </ItemWorkspace>
  );
}
