import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { LocationWorkspace } from "@/components/admin/location-workspace";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Create-form validation errors now surface on /admin/locations/new,
// where the form lives; this landing state only reports outcomes that
// redirect back to the list itself.
const errorMessages: Record<string, string> = {
  missing_location: "That location no longer exists.",
  linked_locations:
    "That location cannot be deleted while sub-locations are still assigned to it.",
};

// Successful create/update/delete outcomes no longer land here at all
// (create redirects straight to the new location's own editor, update/
// hierarchy saves stay on that same editor, and delete's own toast is
// shown by the shared AdminSuccessToast — Admin Polish Pass 2) — this
// landing state has no success banner of its own anymore.
type AdminLocationsPageProps = {
  searchParams: Promise<{ q?: string; error?: string }>;
};

export default async function AdminLocationsPage({
  searchParams,
}: AdminLocationsPageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { q, error } = await searchParams;
  const errorMessage = error ? errorMessages[error] ?? "Something went wrong." : null;

  // Distinguishes "no locations exist at all" from "locations exist,
  // none selected" for the landing state's own copy — independent of the
  // list's own (client-side, Phase B1) filter.
  const totalLocationCount = await prisma.location.count();
  const hasNoLocations = totalLocationCount === 0;

  // The workspace landing state: the searchable record list beside a
  // restrained guidance region — the create form lives on
  // /admin/locations/new, following the Item/Recipe/Profession/Category
  // workspaces' navigation-foundation precedent.
  return (
    <LocationWorkspace
      rawQuery={q}
      header={
        <>
          <PageHeader
            eyebrow="Admin"
            title="Location Management"
            description="Select a location to edit, or create a new one."
          />

          {errorMessage ? (
            <p role="alert" className="banner banner-error">
              {errorMessage}
            </p>
          ) : null}
        </>
      }
    >
      {hasNoLocations ? (
        <EmptyState
          title="No locations yet"
          description="Create the first location to start building out the wiki's route hubs."
          action={
            <a href="/admin/locations/new" className="btn btn-primary">
              Create Location
            </a>
          }
        />
      ) : (
        <EmptyState
          title="Select a location"
          description="Choose a location from the list to edit its details — or create a new one."
          action={
            <a href="/admin/locations/new" className="btn btn-primary">
              Create Location
            </a>
          }
        />
      )}
    </LocationWorkspace>
  );
}
