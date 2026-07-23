import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { AdminFormGuard } from "@/components/admin/admin-form-guard";
import { EditorSection } from "@/components/admin/editor-section";
import { DateField } from "@/components/admin/date-field";
import { AutosizeTextarea } from "@/components/admin/autosize-textarea";
import { SECTION_ICONS } from "@/lib/admin/section-icons";
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

      {/* Action-strip consistency fix: EditorActions renders its own
          background matching .admin-editor-surface — the same surface
          every other resource's editor wraps its <form> in, with
          EditorActions as a SIBLING of the section card(s) rather than
          nested inside one. The previous structure put EditorActions
          INSIDE EditorSection's own card (a lighter --color-surface-raised
          tone), so EditorActions' own --color-surface background read as
          a separate, disconnected darker rectangle floating inside the
          card. Moving the form (and EditorActions with it) out to this
          shared .admin-editor-surface wrapper — exactly the Item/Recipe/
          Profession/Category/Location composition — fixes the mismatch
          without touching EditorActions' own component or CSS at all. */}
      <div className="admin-editor-surface">
        <form action={updateGameVersionAction} className="form-grid">
          <input type="hidden" name="id" value={version.id} />

          <EditorSection title="Game Version" icon={SECTION_ICONS.gameVersions}>
            <label className="form-field form-field-narrow">
              <span className="form-field-label">Name</span>
              <input
                type="text"
                name="name"
                required
                defaultValue={version.name}
                className="form-input"
              />
            </label>

            <div className="form-field-narrow">
              <DateField
                name="releaseDate"
                label="Release date (optional)"
                defaultValue={
                  version.releaseDate
                    ? version.releaseDate.toISOString().slice(0, 10)
                    : null
                }
              />
            </div>

            <label className="form-field">
              <span className="form-field-label">Description (optional)</span>
              <AutosizeTextarea
                name="description"
                defaultValue={version.description ?? ""}
                className="form-input"
                placeholder="Summarize the key features or gameplay changes introduced in this version."
              />
            </label>

            {/* The current flag is deliberately not editable here: it
                moves only through the explicit "Mark as current" action
                on the list page, so an edit can never accidentally
                change which version is current. */}
            <p className="text-muted">
              {version.isCurrent
                ? "This is the current game version."
                : "This is a historical game version. Use “Mark as current” on the Game Versions page to make it current."}
            </p>
          </EditorSection>

          {/* Sonnet Rollout Pass: the guarded actions row replaces the
              plain EditorActions. The record id is excluded from dirty
              comparison; Game Versions carry no verification picker of
              their own. */}
          <AdminFormGuard
            submitLabel="Save Changes"
            cancelHref="/admin/settings/game-versions"
            excludeFields={["id"]}
            draftKey={`game-version:edit:${version.id}:game-version-edit-form`}
            serverUpdatedAt={version.updatedAt.toISOString()}
          />
        </form>
      </div>
    </>
  );
}
