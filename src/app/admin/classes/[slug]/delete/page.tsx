import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { PlayerClassWorkspace } from "@/components/admin/player-class-workspace";
import { DeleteRecordDialog } from "@/components/admin/delete-record-dialog";
import {
  PLAYER_CLASS_LIST_PATH,
  describeLinkedRecipes,
  normalizePlayerClassSearchQuery,
  playerClassCanDelete,
  withPlayerClassSearchQuery,
} from "@/lib/admin/player-class-workspace";
import { prisma } from "@/lib/db";
import { deletePlayerClassAction } from "../../actions";

export const dynamic = "force-dynamic";

type DeletePlayerClassPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; error?: string }>;
};

export default async function DeletePlayerClassPage({
  params,
  searchParams,
}: DeletePlayerClassPageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { slug } = await params;
  const { q, error } = await searchParams;
  const query = normalizePlayerClassSearchQuery(q);

  const playerClass = await prisma.playerClass.findUnique({
    where: { slug },
    include: { _count: { select: { recipes: true } } },
  });

  if (!playerClass) {
    notFound();
  }

  const recipeCount = playerClass._count.recipes;
  const canDelete = playerClassCanDelete(recipeCount);

  // The delete confirmation inside the Player Class workspace, mirroring
  // the Profession workspace's own dedicated /delete route precedent: the
  // record list marks this class selected. This route is the fallback
  // every delete server action's blocked/failed redirect lands on, and
  // stays reachable directly even though the in-editor DangerZonePanel
  // dialog is the everyday path.
  return (
    <PlayerClassWorkspace
      rawQuery={q}
      selectedSlug={playerClass.slug}
      header={
        <>
          <PageHeader
            eyebrow="Admin"
            title="Delete Class"
            description={`Review before permanently deleting "${playerClass.name}".`}
          />

          <p className="admin-toolbar">
            <a
              href={withPlayerClassSearchQuery(PLAYER_CLASS_LIST_PATH, query)}
              className="link-accent"
            >
              &larr; Back to Class Management
            </a>
          </p>

          {error ? (
            <p role="alert" className="banner banner-error">
              {error === "linked_recipes"
                ? `This class cannot be deleted because it is required by ${describeLinkedRecipes(
                    recipeCount
                  )}.`
                : "Something went wrong."}
            </p>
          ) : null}
        </>
      }
    >
      <DeleteRecordDialog
        title="Delete Class"
        description={
          <>
            You are about to permanently delete{" "}
            <strong>{playerClass.name}</strong> ({playerClass.slug}). This
            action cannot be undone.
          </>
        }
        canDelete={canDelete}
        formAction={deletePlayerClassAction}
        hiddenFields={{ id: playerClass.id, slug: playerClass.slug }}
        cancelHref={withPlayerClassSearchQuery(PLAYER_CLASS_LIST_PATH, query)}
      >
        <p className="text-muted">Recipes requiring this class: {recipeCount}</p>

        {!canDelete ? (
          <p className="text-danger">
            This class cannot be deleted because it is required by{" "}
            {describeLinkedRecipes(recipeCount)}. Reassign or remove those
            recipes first.
          </p>
        ) : null}
      </DeleteRecordDialog>
    </PlayerClassWorkspace>
  );
}
