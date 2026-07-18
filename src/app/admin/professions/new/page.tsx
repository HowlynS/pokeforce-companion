import { PageHeader } from "@/components/layout/page-header";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { GameVersionVerificationControls } from "@/components/admin/game-version-verification-controls";
import { ProfessionWorkspace } from "@/components/admin/profession-workspace";
import {
  PROFESSION_LIST_PATH,
  normalizeProfessionSearchQuery,
  withProfessionSearchQuery,
} from "@/lib/admin/profession-workspace";
import { prisma } from "@/lib/db";
import { RecordNameField } from "@/components/admin/record-name-field";
import { createProfessionAction } from "../actions";
import { checkProfessionNameAvailability } from "../name-availability";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  no_current_version:
    "No Game Version is marked as current, so gameplay data cannot be marked as verified. Set the current version under Admin - Settings - Game Versions.",
  invalid_game_version:
    "The selected Game Version no longer exists, so gameplay data cannot be marked as verified. Refresh the page and try again.",
  missing_name: "Profession name is required.",
  invalid_slug:
    "Enter a valid slug using lowercase letters, numbers, and hyphens.",
  duplicate: "A profession with that name or slug already exists.",
  duplicate_name: "A profession with that name already exists.",
  image_too_large: "The image must be 5 MB or smaller.",
  invalid_image_type: "Only PNG, JPEG, and WebP images are allowed.",
  upload_failed: "The image could not be uploaded. Please try again.",
};

type NewProfessionPageProps = {
  searchParams: Promise<{ q?: string; error?: string }>;
};

export default async function NewProfessionPage({
  searchParams,
}: NewProfessionPageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { q, error } = await searchParams;
  const errorMessage = error ? errorMessages[error] ?? "Something went wrong." : null;
  const query = normalizeProfessionSearchQuery(q);

  // Current version first, then newest — the same ordering the settings
  // list uses; feeds the shared verification picker.
  const gameVersions = await prisma.gameVersion.findMany({
    orderBy: [{ isCurrent: "desc" }, { createdAt: "desc" }],
  });

  // The dedicated creation page (Slice 9D.1, following the Item
  // workspace's Slice 9B.4 and Recipe workspace's Slice 9C.1 precedent):
  // the form previously embedded at the bottom of /admin/professions,
  // moved here with unchanged action, validation, image handling, and
  // verification controls. No row is selected in the list while
  // creating. Field grouping, EditorHeader/tabs/ImagePanel/
  // VerificationPanel/sticky EditorActions are deliberately NOT adopted
  // in this pass — only the navigation/wrapper moved.
  return (
    <ProfessionWorkspace
      rawQuery={q}
      header={
        <>
          <PageHeader
            eyebrow="Admin"
            title="Create Profession"
            description="Add a new profession to the wiki."
          />

          <p className="admin-toolbar">
            <a
              href={withProfessionSearchQuery(PROFESSION_LIST_PATH, query)}
              className="link-accent"
            >
              &larr; Back to Profession Management
            </a>
          </p>

          {errorMessage ? (
            <p role="alert" className="banner banner-error">
              {errorMessage}
            </p>
          ) : null}
        </>
      }
    >
      <form action={createProfessionAction} className="form-grid">
        {/* Client-enhanced Name field with live duplicate feedback; the
            submission-time duplicate check in createProfessionAction
            remains the authoritative protection. */}
        <RecordNameField
          checkAvailabilityAction={checkProfessionNameAvailability}
          takenText="A profession with that name already exists."
          regionId="profession-name-availability"
        />

        <label className="form-field">
          <span className="form-field-label">
            Slug (optional — generated from name if left blank)
          </span>
          <input type="text" name="slug" className="form-input" />
        </label>

        <label className="form-field">
          <span className="form-field-label">Description (optional)</span>
          <textarea name="description" rows={3} className="form-input" />
        </label>

        <label className="form-field">
          <span className="form-field-label">
            Image (optional — PNG, JPEG, or WebP, up to 5 MB)
          </span>
          <input
            type="file"
            name="image"
            accept="image/png,image/jpeg,image/webp"
            className="form-input"
          />
        </label>

        <GameVersionVerificationControls gameVersions={gameVersions} />

        <div className="form-actions">
          <button type="submit" className="btn btn-primary">
            Create Profession
          </button>

          <a
            href={withProfessionSearchQuery(PROFESSION_LIST_PATH, query)}
            className="btn btn-secondary"
          >
            Cancel
          </a>
        </div>
      </form>
    </ProfessionWorkspace>
  );
}
