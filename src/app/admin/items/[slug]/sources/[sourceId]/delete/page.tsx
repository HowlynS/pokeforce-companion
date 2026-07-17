import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { ACQUISITION_TYPE_LABELS } from "@/lib/validation/acquisition-source";
import { deleteAcquisitionSourceAction } from "../../actions";

export const dynamic = "force-dynamic";

type DeleteAcquisitionSourcePageProps = {
  params: Promise<{ slug: string; sourceId: string }>;
};

export default async function DeleteAcquisitionSourcePage({
  params,
}: DeleteAcquisitionSourcePageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { slug, sourceId } = await params;

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

  return (
    <AppShell>
      <PageHeader
        eyebrow="Admin"
        title="Delete Acquisition Source"
        description={`Review before permanently deleting this source for "${item.name}".`}
      />

      <p className="admin-toolbar">
        <a href={`/admin/items/${item.slug}/sources`} className="link-accent">
          &larr; Back to Acquisition Sources
        </a>
      </p>

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

          <a href={`/admin/items/${item.slug}/sources`} className="btn btn-secondary">
            Cancel
          </a>
        </div>
      </div>
    </AppShell>
  );
}
