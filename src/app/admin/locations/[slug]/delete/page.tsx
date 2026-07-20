import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { LOCATION_TYPE_LABELS } from "@/lib/validation/location";
import { LocationWorkspace } from "@/components/admin/location-workspace";
import {
  LOCATION_LIST_PATH,
  normalizeLocationSearchQuery,
  withLocationSearchQuery,
} from "@/lib/admin/location-workspace";
import { deleteLocationAction } from "../../actions";

export const dynamic = "force-dynamic";

type DeleteLocationPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; error?: string }>;
};

function describeLinkedLocations(count: number): string {
  return count === 1 ? "1 sub-location" : `${count} sub-locations`;
}

export default async function DeleteLocationPage({
  params,
  searchParams,
}: DeleteLocationPageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { slug } = await params;
  const { q, error } = await searchParams;
  const query = normalizeLocationSearchQuery(q);

  const location = await prisma.location.findUnique({
    where: { slug },
    include: {
      parent: true,
      _count: { select: { children: true } },
    },
  });

  if (!location) {
    notFound();
  }

  const childCount = location._count.children;
  const canDelete = childCount === 0;

  // The delete confirmation inside the Location workspace, mirroring the
  // edit route exactly: the record list marks this location selected and
  // keeps the active search applied. Every field, redirect, server action,
  // and the child-location delete-protection rule are unchanged — only the
  // navigation wrapper moved.
  return (
    <LocationWorkspace
      rawQuery={q}
      selectedSlug={location.slug}
      header={
        <>
          <PageHeader
            eyebrow="Admin"
            title="Delete Location"
            description={`Review before permanently deleting "${location.name}".`}
          />

          <p className="admin-toolbar">
            <a
              href={withLocationSearchQuery(LOCATION_LIST_PATH, query)}
              className="link-accent"
            >
              &larr; Back to Location Management
            </a>
          </p>

          {error ? (
            <p role="alert" className="banner banner-error">
              {error === "linked_locations"
                ? `This location cannot be deleted because it is assigned to ${describeLinkedLocations(
                    childCount
                  )}.`
                : "Something went wrong."}
            </p>
          ) : null}
        </>
      }
    >
      <div className="confirm-card">
        <p>
          You are about to permanently delete <strong>{location.name}</strong>{" "}
          ({location.slug}). This action cannot be undone.
        </p>

        <p className="text-muted">
          Type: {LOCATION_TYPE_LABELS[location.type]}
        </p>

        <p className="text-muted">
          Parent location: {location.parent?.name ?? "None"}
        </p>

        <p className="text-muted">Sub-locations: {childCount}</p>

        {!canDelete ? (
          <p className="text-danger">
            This location cannot be deleted because it is assigned to{" "}
            {describeLinkedLocations(childCount)}. Move or remove those
            sub-locations first.
          </p>
        ) : null}

        <div className="form-actions">
          {canDelete ? (
            <form action={deleteLocationAction}>
              <input type="hidden" name="id" value={location.id} />
              <input type="hidden" name="slug" value={location.slug} />
              <button type="submit" className="btn btn-danger">
                Delete Permanently
              </button>
            </form>
          ) : null}

          <a
            href={withLocationSearchQuery(LOCATION_LIST_PATH, query)}
            className="btn btn-secondary"
          >
            Cancel
          </a>
        </div>
      </div>
    </LocationWorkspace>
  );
}
