import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { countVerificationReferences } from "@/lib/game-versions";
import { deleteGameVersionAction } from "../../actions";

export const dynamic = "force-dynamic";

type DeleteGameVersionPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

function describeReferences(count: number): string {
  return count === 1
    ? "1 verified gameplay record"
    : `${count} verified gameplay records`;
}

export default async function DeleteGameVersionPage({
  params,
  searchParams,
}: DeleteGameVersionPageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { id } = await params;
  const { error } = await searchParams;

  const version = await prisma.gameVersion.findUnique({ where: { id } });

  if (!version) {
    notFound();
  }

  // Counted across every verifiable model (Item, Location, Acquisition
  // Source, Recipe, Profession). The action re-checks immediately before
  // deleting, and the database's ON DELETE RESTRICT backs both up.
  const referenceCount = await countVerificationReferences(prisma, id);
  const canDelete = referenceCount === 0;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Admin · Settings"
        title="Delete Game Version"
        description={`Review before permanently deleting "${version.name}".`}
      />

      <p className="admin-toolbar">
        <a href="/admin/settings/game-versions" className="link-accent">
          &larr; Back to Game Versions
        </a>
      </p>

      {error ? (
        <p role="alert" className="banner banner-error">
          {error === "referenced"
            ? `This game version cannot be deleted because ${describeReferences(
                referenceCount
              )} still reference it.`
            : "Something went wrong."}
        </p>
      ) : null}

      <div className="confirm-card">
        <p>
          You are about to permanently delete <strong>{version.name}</strong>.
          This action cannot be undone.
        </p>

        <p className="text-muted">
          Release date:{" "}
          {version.releaseDate
            ? version.releaseDate.toISOString().slice(0, 10)
            : "None"}
        </p>

        <p className="text-muted">
          Current version: {version.isCurrent ? "Yes" : "No"}
        </p>

        <p className="text-muted">
          Verified gameplay records referencing this version: {referenceCount}
        </p>

        {!canDelete ? (
          <p className="text-danger">
            This game version cannot be deleted because{" "}
            {describeReferences(referenceCount)} still reference it. Verified
            gameplay data keeps its history — re-verify those records against
            another version first if you really need to remove this one.
          </p>
        ) : null}

        {canDelete && version.isCurrent ? (
          <p className="text-danger">
            This is the current game version. After deleting it no version
            will be current until you mark another one, and gameplay data
            cannot be marked as verified in the meantime.
          </p>
        ) : null}

        <div className="form-actions">
          {canDelete ? (
            <form action={deleteGameVersionAction}>
              <input type="hidden" name="id" value={version.id} />
              <button type="submit" className="btn btn-danger">
                Delete Permanently
              </button>
            </form>
          ) : null}

          <a href="/admin/settings/game-versions" className="btn btn-secondary">
            Cancel
          </a>
        </div>
      </div>
    </AppShell>
  );
}
