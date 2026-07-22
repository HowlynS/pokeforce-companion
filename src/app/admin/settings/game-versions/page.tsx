import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { designTokens } from "@/lib/design-tokens";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import {
  createGameVersionAction,
  markGameVersionCurrentAction,
} from "./actions";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  missing_name: "Game Version name is required.",
  invalid_release_date: "Enter the release date as a valid calendar date.",
  duplicate_name: "A Game Version with that name already exists.",
  missing_version: "That Game Version no longer exists.",
  referenced:
    "That Game Version cannot be deleted while verified gameplay data still references it.",
};

const successMessages: Record<string, string> = {
  created: "Game Version created.",
  created_current:
    "Game Version created and marked as the current version (it is the first one).",
  updated: "Game Version updated.",
  marked_current: "Current Game Version updated.",
  deleted: "Game Version deleted.",
};

type GameVersionSettingsPageProps = {
  searchParams: Promise<{ error?: string; success?: string }>;
};

// Stable server-side YYYY-MM-DD so output never depends on the server
// locale; release dates are stored at UTC midnight by the parser.
function formatReleaseDate(releaseDate: Date | null): string {
  return releaseDate ? releaseDate.toISOString().slice(0, 10) : "—";
}

export default async function GameVersionSettingsPage({
  searchParams,
}: GameVersionSettingsPageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { error, success } = await searchParams;
  const errorMessage = error ? errorMessages[error] ?? "Something went wrong." : null;
  const successMessage = success ? successMessages[success] ?? null : null;

  // Current version first, then newest first — the version being worked
  // with is almost always at the top.
  const versions = await prisma.gameVersion.findMany({
    orderBy: [{ isCurrent: "desc" }, { createdAt: "desc" }],
  });

  return (
    <>
      <PageHeader
        eyebrow="Admin · Settings"
        title="Game Versions"
        description="Manage the game versions used to verify gameplay data. Exactly one version can be current; historical versions stay available."
      />

      <nav className="admin-toolbar" aria-label="Game Version management">
        <a href="/admin" className="link-accent">
          &larr; Back to Admin
        </a>

        <a href="#create-game-version" className="btn btn-secondary btn-compact">
          + New game version
        </a>
      </nav>

      {errorMessage ? (
        <p role="alert" className="banner banner-error">
          {errorMessage}
        </p>
      ) : null}

      {successMessage ? (
        <p role="status" className="banner banner-success">
          {successMessage}
        </p>
      ) : null}

      <section style={{ marginBottom: designTokens.layout.sectionGap }}>
        <h2 className="section-title">Existing Game Versions</h2>

        {versions.length > 0 ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  {["Name", "Release Date", "Current", "Actions"].map(
                    (heading) => (
                      <th key={heading}>{heading}</th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {versions.map((version) => (
                  <tr key={version.id}>
                    <td>{version.name}</td>
                    <td>{formatReleaseDate(version.releaseDate)}</td>
                    <td>
                      {version.isCurrent ? (
                        <strong className="text-accent">Current</strong>
                      ) : (
                        "No"
                      )}
                    </td>
                    <td>
                      <span className="row-actions">
                        {!version.isCurrent ? (
                          <form
                            action={markGameVersionCurrentAction}
                            style={{ display: "inline" }}
                          >
                            <input type="hidden" name="id" value={version.id} />
                            <button
                              type="submit"
                              className="btn btn-secondary btn-compact"
                            >
                              Mark as current
                            </button>
                          </form>
                        ) : null}
                        <a
                          href={`/admin/settings/game-versions/${version.id}/edit`}
                          className="btn btn-secondary btn-compact"
                        >
                          Edit
                        </a>
                        <a
                          href={`/admin/settings/game-versions/${version.id}/delete`}
                          className="btn btn-danger-outline btn-compact"
                        >
                          Delete
                        </a>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No game versions yet"
            description="Create the first game version using the form below. The first one automatically becomes the current version."
          />
        )}
      </section>

      <section id="create-game-version">
        <h2 className="section-title">Create Game Version</h2>

        <div className="admin-editor-surface">
        <form action={createGameVersionAction} className="form-grid">
          <label className="form-field">
            <span className="form-field-label">Name</span>
            <input type="text" name="name" required className="form-input" />
          </label>

          <label className="form-field">
            <span className="form-field-label">Release date (optional)</span>
            <input type="date" name="releaseDate" className="form-input" />
          </label>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              Create Game Version
            </button>
          </div>
        </form>
        </div>
      </section>
    </>
  );
}
