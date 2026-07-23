import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { DateField } from "@/components/admin/date-field";
import { EditorSection } from "@/components/admin/editor-section";
import { AdminFormGuard } from "@/components/admin/admin-form-guard";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { formatDisplayDate } from "@/lib/format-date";
import { SECTION_ICONS } from "@/lib/admin/section-icons";
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

// Formatted through the shared formatDisplayDate helper ("DD MMM YYYY")
// so output never depends on the server locale; release dates are stored
// at UTC midnight by the parser.
function formatReleaseDate(releaseDate: Date | null): string {
  return formatDisplayDate(releaseDate) ?? "—";
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

      <div className="admin-gameversions-layout">
      <EditorSection
        title="Existing Game Versions"
        icon={SECTION_ICONS.gameVersions}
      >
        {versions.length > 0 ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Release date</th>
                  <th className="admin-table-col-compact">Current</th>
                  <th className="admin-table-col-compact">Set current</th>
                  <th className="admin-table-col-compact">Actions</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((version) => (
                  <tr key={version.id}>
                    <td>{version.name}</td>
                    <td>{formatReleaseDate(version.releaseDate)}</td>
                    <td className="admin-table-col-compact">
                      {version.isCurrent ? (
                        <strong className="text-accent">Current</strong>
                      ) : (
                        "No"
                      )}
                    </td>
                    <td className="admin-table-col-compact">
                      {version.isCurrent ? (
                        <span className="text-muted">&mdash;</span>
                      ) : (
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
                      )}
                    </td>
                    <td className="admin-table-col-compact">
                      <span className="row-actions">
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
      </EditorSection>

      <EditorSection
        id="create-game-version"
        title="Create Game Version"
        icon={SECTION_ICONS.gameVersions}
      >
        <form action={createGameVersionAction} className="form-grid">
          <label className="form-field">
            <span className="form-field-label">Name</span>
            <input type="text" name="name" required className="form-input" />
          </label>

          <DateField name="releaseDate" label="Release date (optional)" />

          {/* Sonnet Rollout Pass: only THIS form is guarded — the
              per-row "Mark as current" forms above are separate <form>
              elements the guard never attaches to (it scopes strictly to
              its own owning form), so they stay unaffected and Ctrl/Cmd+S
              always targets this Create form. No id/originalSlug hidden
              fields exist here, and Game Versions carry no verification
              picker of their own to exclude. layout="inline" (visual
              regression fix): this form lives directly inside its own
              EditorSection card rather than a dedicated
              .admin-editor-surface panel, so the default sticky/surface
              actions footer would read as a detached darker rectangle —
              the inline layout removes that surface/sticky treatment
              while keeping every button, status, and behavior identical. */}
          <AdminFormGuard
            submitLabel="Create Game Version"
            cancelHref="/admin/settings/game-versions"
            draftKey="game-version:new:game-version-create-form"
            layout="inline"
          />
        </form>
      </EditorSection>
      </div>
    </>
  );
}
