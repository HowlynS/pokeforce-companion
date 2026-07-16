import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { deleteProfessionAction } from "../../actions";

export const dynamic = "force-dynamic";

type DeleteProfessionPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
};

function describeLinkedRecipes(count: number): string {
  return count === 1 ? "1 recipe" : `${count} recipes`;
}

export default async function DeleteProfessionPage({
  params,
  searchParams,
}: DeleteProfessionPageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { slug } = await params;
  const { error } = await searchParams;

  const profession = await prisma.profession.findUnique({
    where: { slug },
    include: { _count: { select: { recipes: true } } },
  });

  if (!profession) {
    notFound();
  }

  const recipeCount = profession._count.recipes;
  const canDelete = recipeCount === 0;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Admin"
        title="Delete Profession"
        description={`Review before permanently deleting "${profession.name}".`}
      />

      <p className="admin-toolbar">
        <a href="/admin/professions" className="link-accent">
          &larr; Back to Profession Management
        </a>
      </p>

      {error ? (
        <p role="alert" className="banner banner-error">
          {error === "linked_recipes"
            ? `This profession cannot be deleted because it is assigned to ${describeLinkedRecipes(
                recipeCount
              )}.`
            : "Something went wrong."}
        </p>
      ) : null}

      <div className="confirm-card">
        <p>
          You are about to permanently delete{" "}
          <strong>{profession.name}</strong> ({profession.slug}). This action
          cannot be undone.
        </p>

        <p className="text-muted">Linked recipes: {recipeCount}</p>

        {!canDelete ? (
          <p className="text-danger">
            This profession cannot be deleted because it is assigned to{" "}
            {describeLinkedRecipes(recipeCount)}. Reassign or remove those
            recipes first.
          </p>
        ) : null}

        <div className="form-actions">
          {canDelete ? (
            <form action={deleteProfessionAction}>
              <input type="hidden" name="id" value={profession.id} />
              <input type="hidden" name="slug" value={profession.slug} />
              <button type="submit" className="btn btn-danger">
                Delete Permanently
              </button>
            </form>
          ) : null}

          <a href="/admin/professions" className="btn btn-secondary">
            Cancel
          </a>
        </div>
      </div>
    </AppShell>
  );
}
