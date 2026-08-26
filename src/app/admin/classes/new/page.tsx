import { requireAdminUser } from "@/lib/auth/require-admin";
import { EditorHeader } from "@/components/admin/editor-header";
import { EditorTabs, type EditorTab } from "@/components/admin/editor-tabs";
import { EditorSection } from "@/components/admin/editor-section";
import { ImagePanel } from "@/components/admin/image-panel";
import { VerificationPanel } from "@/components/admin/verification-panel";
import { AdminFormGuard } from "@/components/admin/admin-form-guard";
import { PlayerClassWorkspace } from "@/components/admin/player-class-workspace";
import {
  PLAYER_CLASS_LIST_PATH,
  normalizePlayerClassSearchQuery,
  withPlayerClassSearchQuery,
} from "@/lib/admin/player-class-workspace";
import { prisma } from "@/lib/db";
import { RecordIdentityFields } from "@/components/admin/record-identity-fields";
import { RichDescriptionEditor } from "@/components/admin/rich-description-editor";
import { SECTION_ICONS } from "@/lib/admin/section-icons";
import { createPlayerClassAction } from "../actions";
import { checkPlayerClassNameAvailability } from "../name-availability";
import { checkPlayerClassSlugAvailability } from "../slug-availability";

export const dynamic = "force-dynamic";

// Associates the image and verification controls — both rendered in the
// aside column, outside this <form> element — with this form via the
// standard HTML `form` attribute, so every field still submits together
// with one ordinary form submission.
const PLAYER_CLASS_CREATE_FORM_ID = "player-class-create-form";

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
};

type NewPlayerClassPageProps = {
  searchParams: Promise<{ q?: string; error?: string }>;
};

export default async function NewPlayerClassPage({
  searchParams,
}: NewPlayerClassPageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { q, error } = await searchParams;
  const errorMessage = error ? errorMessages[error] ?? "Something went wrong." : null;
  const query = normalizePlayerClassSearchQuery(q);

  // Current version first, then newest — the same ordering the settings
  // list uses; feeds the shared verification picker.
  const gameVersions = await prisma.gameVersion.findMany({
    orderBy: [{ isCurrent: "desc" }, { createdAt: "desc" }],
  });

  // Only General makes sense before a record exists — Recipes describes an
  // existing Class's own relations, so it is omitted here rather than
  // shown as a disabled placeholder (matching the Profession General
  // editor's create-page precedent exactly).
  const tabs: EditorTab[] = [
    {
      label: "General",
      href: withPlayerClassSearchQuery("/admin/classes/new", query),
      active: true,
    },
  ];

  return (
    <PlayerClassWorkspace
      rawQuery={q}
      editorHeader={
        <>
          <EditorHeader
            eyebrow="Class"
            title="Create Class"
            subtitle="Add a new player class to the wiki."
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
          <ImagePanel imageUrl={null} formId={PLAYER_CLASS_CREATE_FORM_ID} />

          {/* No fake existing verification state on create: both fields
              are null, so the panel renders Unverified with no stamp
              rows — exactly the state a brand-new Class actually has. */}
          <VerificationPanel
            verificationPermission="content.classes.verify"
            gameVersions={gameVersions}
            verifiedAt={null}
            verifiedGameVersion={null}
            formId={PLAYER_CLASS_CREATE_FORM_ID}
          />
        </>
      }
    >
      <div className="admin-editor-surface">
      <form
        id={PLAYER_CLASS_CREATE_FORM_ID}
        action={createPlayerClassAction}
        className="form-grid form-grid-responsive"
      >
        <div className="admin-editor-sections">
          <EditorSection title="Identity" icon={SECTION_ICONS.identity}>
            {/* Client-enhanced Name + Page address fields; the
                submission-time checks in createPlayerClassAction remain
                the authoritative protection for both. */}
            <RecordIdentityFields
              checkNameAvailabilityAction={checkPlayerClassNameAvailability}
              nameTakenText="A class with that name already exists."
              nameRegionId="player-class-name-availability"
              checkSlugAvailabilityAction={checkPlayerClassSlugAvailability}
              slugTakenText="A class with that page address already exists."
              slugRegionId="player-class-slug-availability"
            />
          </EditorSection>

          <EditorSection title="Description" icon={SECTION_ICONS.content}>
            <RichDescriptionEditor
              error={
                error === "invalid_rich_description"
                  ? errorMessages.invalid_rich_description
                  : null
              }
            />
          </EditorSection>
        </div>

        {/* Guarded actions row: unsaved-changes protection, draft
            persistence, Ctrl/Cmd+S, and save-state feedback. No id/
            originalSlug hidden fields exist on create; the verification
            picker is excluded (a no-op unless the opt-in checkbox is
            checked). Draft key is create-scoped, isolated from every edit
            record. */}
        <AdminFormGuard
          submitLabel="Create Class"
          cancelHref={withPlayerClassSearchQuery(PLAYER_CLASS_LIST_PATH, query)}
          excludeFields={["verifiedGameVersionId"]}
          draftKey="player-class:new:player-class-create-form"
        />
      </form>
      </div>
    </PlayerClassWorkspace>
  );
}
