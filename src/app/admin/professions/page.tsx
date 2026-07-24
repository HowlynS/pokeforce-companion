import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ProfessionWorkspace } from "@/components/admin/profession-workspace";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Create-form validation errors now surface on /admin/professions/new,
// where the form lives; this landing state only reports outcomes that
// redirect back to the list itself.
const errorMessages: Record<string, string> = {
  missing_profession: "That profession no longer exists.",
  linked_recipes:
    "That profession cannot be deleted while recipes are still assigned to it.",
};

// Successful create/update/delete outcomes no longer land here at all
// (create redirects straight to the new profession's own editor, update
// stays on that same editor, and delete's own toast is shown by the
// shared AdminSuccessToast — Admin Polish Pass 2) — this landing state
// has no success banner of its own anymore.
type AdminProfessionsPageProps = {
  searchParams: Promise<{ q?: string; error?: string }>;
};

export default async function AdminProfessionsPage({
  searchParams,
}: AdminProfessionsPageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { q, error } = await searchParams;
  const errorMessage = error ? errorMessages[error] ?? "Something went wrong." : null;

  // Distinguishes "no professions exist at all" from "professions exist,
  // none selected" for the landing state's own copy — independent of the
  // list's own (client-side, Phase B1) filter.
  const totalProfessionCount = await prisma.profession.count();
  const hasNoProfessions = totalProfessionCount === 0;

  // The workspace landing state: the searchable record list beside a
  // restrained guidance region — the create form lives on
  // /admin/professions/new (Slice 9D.1, following the Item workspace's
  // Slice 9B.4 and Recipe workspace's Slice 9C.1 precedent).
  return (
    <ProfessionWorkspace
      rawQuery={q}
      header={
        <>
          <PageHeader
            eyebrow="Admin"
            title="Profession Management"
            description="Select a profession to edit, or create a new one."
          />

          {errorMessage ? (
            <p role="alert" className="banner banner-error">
              {errorMessage}
            </p>
          ) : null}
        </>
      }
    >
      {hasNoProfessions ? (
        <EmptyState
          title="No professions yet"
          description="Create the first profession to start building out the wiki's crafting data."
          action={
            <a href="/admin/professions/new" className="btn btn-primary">
              Create Profession
            </a>
          }
        />
      ) : (
        <EmptyState
          title="Select a profession"
          description="Choose a profession from the list to edit its details — or create a new one."
          action={
            <a href="/admin/professions/new" className="btn btn-primary">
              Create Profession
            </a>
          }
        />
      )}
    </ProfessionWorkspace>
  );
}
