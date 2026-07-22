import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { ProfessionWorkspace } from "@/components/admin/profession-workspace";
import {
  PROFESSION_LIST_PATH,
  normalizeProfessionSearchQuery,
  withProfessionSearchQuery,
} from "@/lib/admin/profession-workspace";
import { prisma } from "@/lib/db";
import { deleteProfessionAction } from "../../actions";

export const dynamic = "force-dynamic";

type DeleteProfessionPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; error?: string }>;
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
  const { q, error } = await searchParams;
  const query = normalizeProfessionSearchQuery(q);

  const profession = await prisma.profession.findUnique({
    where: { slug },
    include: { _count: { select: { recipes: true } } },
  });

  if (!profession) {
    notFound();
  }

  const recipeCount = profession._count.recipes;
  const canDelete = recipeCount === 0;

  // The delete confirmation inside the Profession workspace (Slice
  // 9D.1, following the Item workspace's Slice 9B.4 and Recipe
  // workspace's Slice 9C.1 precedent): the record list marks this
  // profession selected. The confirmation card, its summary, and the
  // delete action are unchanged — only the navigation wrapper moved.
  return (
    <ProfessionWorkspace
      rawQuery={q}
      selectedSlug={profession.slug}
      header={
        <>
          <PageHeader
            eyebrow="Admin"
            title="Delete Profession"
            description={`Review before permanently deleting "${profession.name}".`}
          />

          <p className="admin-toolbar">
            <a
              href={withProfessionSearchQuery(PROFESSION_LIST_PATH, query)}
              className="link-accent"
            >
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
        </>
      }
    >
      <div className="confirm-card">
        <p className="confirm-card-eyebrow">Destructive action</p>
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

          <a
            href={withProfessionSearchQuery(PROFESSION_LIST_PATH, query)}
            className="btn btn-secondary"
          >
            Cancel
          </a>
        </div>
      </div>
    </ProfessionWorkspace>
  );
}
