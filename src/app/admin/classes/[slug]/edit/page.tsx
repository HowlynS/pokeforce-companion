import { notFound } from "next/navigation";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { EditorHeader } from "@/components/admin/editor-header";
import { EditorTabs } from "@/components/admin/editor-tabs";
import { EditorSection } from "@/components/admin/editor-section";
import { ImagePanel } from "@/components/admin/image-panel";
import { VerificationPanel } from "@/components/admin/verification-panel";
import { TimestampsPanel } from "@/components/admin/timestamps-panel";
import { AdminFormGuard } from "@/components/admin/admin-form-guard";
import { DangerZonePanel } from "@/components/admin/danger-zone-panel";
import { RichDescriptionEditor } from "@/components/admin/rich-description-editor";
import { PlayerClassWorkspace } from "@/components/admin/player-class-workspace";
import {
  PLAYER_CLASS_LIST_PATH,
  normalizePlayerClassSearchQuery,
  playerClassEditorTabs,
  withPlayerClassSearchQuery,
} from "@/lib/admin/player-class-workspace";
import { prisma } from "@/lib/db";
import { getImagePublicUrl } from "@/lib/storage/images";
import { RecordIdentityFields } from "@/components/admin/record-identity-fields";
import { SECTION_ICONS } from "@/lib/admin/section-icons";
import { updatePlayerClassAction, deletePlayerClassAction } from "../../actions";
import { checkPlayerClassNameAvailability } from "../../name-availability";
import { checkPlayerClassSlugAvailability } from "../../slug-availability";

export const dynamic = "force-dynamic";

// Associates the image and verification controls — both rendered in the
// aside column, outside this <form> element — with this form via the
// standard HTML `form` attribute, so every field still submits together
// with one ordinary form submission.
const PLAYER_CLASS_EDIT_FORM_ID = "player-class-edit-form";

const errorMessages: Record<string, string> = {
  no_current_version:
    "No Game Version is marked as current, so gameplay data cannot be marked as verified. Set the current version under Admin - Settings - Game Versions.",
  invalid_game_version:
    "The selected Game Version no longer exists, so gameplay data cannot be marked as verified. Refresh the page and try again.",
  missing_name: "Class name is required.",
  invalid_slug:
    "Enter a valid slug using lowercase letters, numbers, and hyphens.",
  duplicate: "A class with that name or slug already exists.",
  duplicate_name: "A class with that name already exists.",
  invalid_rich_description:
    "The formatted description could not be validated. Review it and try again.",
  image_too_large: "The image must be 5 MB or smaller.",
  invalid_image_type: "Only PNG, JPEG, and WebP images are allowed.",
  upload_failed: "The image could not be uploaded. Please try again.",
  conflicting_image_input:
    "Choose either a replacement image or Remove current image, not both.",
};

type EditPlayerClassPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; error?: string }>;
};

export default async function EditPlayerClassPage({
  params,
  searchParams,
}: EditPlayerClassPageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { slug } = await params;
  const { q, error } = await searchParams;
  const errorMessage = error ? errorMessages[error] ?? "Something went wrong." : null;
  const query = normalizePlayerClassSearchQuery(q);

  const playerClass = await prisma.playerClass.findUnique({
    where: { slug },
    include: {
      // Admin-only visibility of the verification stamp: the related
      // Game Version's name is shown in the aside's VerificationPanel
      // below.
      verifiedGameVersion: true,
    },
  });

  if (!playerClass) {
    notFound();
  }

  // Derived from the trusted database path; null when no image is stored.
  const imageUrl = await getImagePublicUrl(playerClass.image);

  // Current version first, then newest — the same ordering the
  // settings list uses; feeds the shared verification picker.
  const gameVersions = await prisma.gameVersion.findMany({
    orderBy: [{ isCurrent: "desc" }, { createdAt: "desc" }],
  });

  const tabs = playerClassEditorTabs(playerClass.slug, query, "general");

  // Feeds the in-editor delete dialog — the exact same count and rule the
  // dedicated /delete route uses, reusing the tab-badge query above rather
  // than a second query.

  return (
    <PlayerClassWorkspace
      // Forces a full remount of the record list, form, and aside whenever
      // this class's own updatedAt actually changes — matching the
      // Profession General editor's own identical pattern.
      key={playerClass.updatedAt.toISOString()}
      rawQuery={q}
      selectedSlug={playerClass.slug}
      editorHeader={
        <>
          <EditorHeader
            eyebrow="Class"
            title={playerClass.name}
            subtitle={playerClass.slug}
          />

          <EditorTabs label="Class editor sections" tabs={tabs} />

          {errorMessage ? (
            <p role="alert" className="banner banner-error">
              {errorMessage}
            </p>
          ) : null}
        </>
      }
      aside={
        <>
          <ImagePanel
            imageUrl={imageUrl}
            imageAlt={`Current image for ${playerClass.name}`}
            formId={PLAYER_CLASS_EDIT_FORM_ID}
          />

          <VerificationPanel
            verificationPermission="content.classes.verify"
            gameVersions={gameVersions}
            verifiedAt={playerClass.verifiedAt}
            verifiedGameVersion={playerClass.verifiedGameVersion}
            formId={PLAYER_CLASS_EDIT_FORM_ID}
          />

          <TimestampsPanel
            createdAt={playerClass.createdAt}
            updatedAt={playerClass.updatedAt}
          />

          <DangerZonePanel
            deletePermission="content.classes.delete"
            resourceLabel="class"
            deleteLabel="Delete Class"
            dialogTitle="Delete Class"
            dialogDescription={
              <>
                You are about to permanently delete{" "}
                <strong>{playerClass.name}</strong> ({playerClass.slug}). This
                action cannot be undone.
              </>
            }
            canDelete
            formAction={deletePlayerClassAction}
            hiddenFields={{ id: playerClass.id, slug: playerClass.slug }}
          />
        </>
      }
    >
      <div className="admin-editor-surface">
      <form
        id={PLAYER_CLASS_EDIT_FORM_ID}
        action={updatePlayerClassAction}
        className="form-grid form-grid-responsive"
      >
        <input type="hidden" name="id" value={playerClass.id} />
        <input type="hidden" name="originalSlug" value={playerClass.slug} />

        <div className="admin-editor-sections">
          <EditorSection title="Identity" icon={SECTION_ICONS.identity}>
            {/* Client-enhanced Name + Page address fields. Both saved
                values count as "current" (never queried against
                themselves), and the record's own id is excluded
                server-side so it cannot conflict with itself;
                updatePlayerClassAction stays the authoritative check for
                both. */}
            <RecordIdentityFields
              checkNameAvailabilityAction={checkPlayerClassNameAvailability}
              nameTakenText="A class with that name already exists."
              nameRegionId="player-class-name-availability"
              originalName={playerClass.name}
              checkSlugAvailabilityAction={checkPlayerClassSlugAvailability}
              slugTakenText="A class with that page address already exists."
              slugRegionId="player-class-slug-availability"
              initialSlug={playerClass.slug}
              excludeId={playerClass.id}
            />
          </EditorSection>

          <EditorSection title="Description" icon={SECTION_ICONS.content}>
              <RichDescriptionEditor
                initialValue={playerClass.descriptionRich}
                fallbackText={playerClass.description}
                error={
                  error === "invalid_rich_description"
                    ? errorMessages.invalid_rich_description
                    : null
                }
              />
          </EditorSection>
        </div>

        {/* Guarded actions row: unsaved-changes protection, draft
            persistence, Ctrl/Cmd+S, and save-state feedback, all scoped
            to this form. The record id, its original slug, and the
            verification picker (a no-op unless the opt-in checkbox is
            checked) are excluded from dirty comparison. */}
        <AdminFormGuard
          submitLabel="Save Changes"
          cancelHref={withPlayerClassSearchQuery(PLAYER_CLASS_LIST_PATH, query)}
          excludeFields={["id", "originalSlug", "verifiedGameVersionId"]}
          draftKey={`player-class:edit:${playerClass.id}:player-class-edit-form`}
          serverUpdatedAt={playerClass.updatedAt.toISOString()}
        />
      </form>
      </div>
    </PlayerClassWorkspace>
  );
}
