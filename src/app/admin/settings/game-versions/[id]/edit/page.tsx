import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { updateGameVersionAction } from "../../actions";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  missing_name: "Game Version name is required.",
  invalid_release_date: "Enter the release date as a valid calendar date.",
  duplicate_name: "A Game Version with that name already exists.",
};

type EditGameVersionPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function EditGameVersionPage({
  params,
  searchParams,
}: EditGameVersionPageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { id } = await params;
  const { error } = await searchParams;
  const errorMessage = error ? errorMessages[error] ?? "Something went wrong." : null;

  const version = await prisma.gameVersion.findUnique({ where: { id } });

  if (!version) {
    notFound();
  }

  return (
    <>
      <PageHeader
        eyebrow="Admin · Settings"
        title="Edit Game Version"
        description={`Update details for "${version.name}".`}
      />

      <p className="admin-toolbar">
        <a href="/admin/settings/game-versions" className="link-accent">
          &larr; Back to Game Versions
        </a>
      </p>

      {errorMessage ? (
        <p role="alert" className="banner banner-error">
          {errorMessage}
        </p>
      ) : null}

      <form action={updateGameVersionAction} className="form-grid">
        <input type="hidden" name="id" value={version.id} />

        <label className="form-field">
          <span className="form-field-label">Name</span>
          <input
            type="text"
            name="name"
            required
            defaultValue={version.name}
            className="form-input"
          />
        </label>

        <label className="form-field">
          <span className="form-field-label">Release date (optional)</span>
          <input
            type="date"
            name="releaseDate"
            defaultValue={
              version.releaseDate
                ? version.releaseDate.toISOString().slice(0, 10)
                : ""
            }
            className="form-input"
          />
        </label>

        {/* The current flag is deliberately not editable here: it moves only
            through the explicit "Mark as current" action on the list page,
            so an edit can never accidentally change which version is
            current. */}
        <p className="text-muted">
          {version.isCurrent
            ? "This is the current game version."
            : "This is a historical game version. Use “Mark as current” on the Game Versions page to make it current."}
        </p>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary">
            Save Changes
          </button>

          <a href="/admin/settings/game-versions" className="btn btn-secondary">
            Cancel
          </a>
        </div>
      </form>
    </>
  );
}
