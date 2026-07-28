import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { PlayerClassWorkspace } from "@/components/admin/player-class-workspace";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Create-form validation errors surface on /admin/classes/new, where the
// form lives; this landing state only reports outcomes that redirect back
// to the list itself.
const errorMessages: Record<string, string> = {
  missing_player_class: "That class no longer exists.",
  linked_recipes:
    "That class cannot be deleted while recipes still require it.",
};

// Successful create/update/delete outcomes redirect straight to the
// relevant editor or show their own toast — this landing state has no
// success banner of its own.
type AdminClassesPageProps = {
  searchParams: Promise<{ q?: string; error?: string }>;
};

export default async function AdminClassesPage({
  searchParams,
}: AdminClassesPageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { q, error } = await searchParams;
  const errorMessage = error ? errorMessages[error] ?? "Something went wrong." : null;

  // Distinguishes "no classes exist at all" from "classes exist, none
  // selected" for the landing state's own copy — independent of the
  // list's own (client-side) filter.
  const totalPlayerClassCount = await prisma.playerClass.count();
  const hasNoPlayerClasses = totalPlayerClassCount === 0;

  // The workspace landing state: the searchable record list beside a
  // restrained guidance region — the create form lives on
  // /admin/classes/new, mirroring every other converted resource's own
  // navigation-foundation precedent.
  return (
    <PlayerClassWorkspace
      rawQuery={q}
      header={
        <>
          <PageHeader
            eyebrow="Admin"
            title="Class Management"
            description="Select a class to edit, or create a new one."
          />

          {errorMessage ? (
            <p role="alert" className="banner banner-error">
              {errorMessage}
            </p>
          ) : null}
        </>
      }
    >
      {hasNoPlayerClasses ? (
        <EmptyState
          title="No classes yet"
          description="Create the first class to start assigning them to recipes."
          action={
            <a href="/admin/classes/new" className="btn btn-primary">
              Create Class
            </a>
          }
        />
      ) : (
        <EmptyState
          title="Select a class"
          description="Choose a class from the list to edit its details — or create a new one."
          action={
            <a href="/admin/classes/new" className="btn btn-primary">
              Create Class
            </a>
          }
        />
      )}
    </PlayerClassWorkspace>
  );
}
