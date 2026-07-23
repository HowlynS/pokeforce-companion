import { requireAdminUser } from "@/lib/auth/require-admin";
import { EditorHeader } from "@/components/admin/editor-header";
import { EditorTabs, type EditorTab } from "@/components/admin/editor-tabs";
import { EditorSection } from "@/components/admin/editor-section";
import { ImagePanel } from "@/components/admin/image-panel";
import { VerificationPanel } from "@/components/admin/verification-panel";
import { AdminFormGuard } from "@/components/admin/admin-form-guard";
import { ProfessionWorkspace } from "@/components/admin/profession-workspace";
import {
  PROFESSION_LIST_PATH,
  normalizeProfessionSearchQuery,
  withProfessionSearchQuery,
} from "@/lib/admin/profession-workspace";
import { prisma } from "@/lib/db";
import { RecordIdentityFields } from "@/components/admin/record-identity-fields";
import { AutosizeTextarea } from "@/components/admin/autosize-textarea";
import { SECTION_ICONS } from "@/lib/admin/section-icons";
import { createProfessionAction } from "../actions";
import { checkProfessionNameAvailability } from "../name-availability";
import { checkProfessionSlugAvailability } from "../slug-availability";

export const dynamic = "force-dynamic";

// Associates the image and verification controls — both rendered in the
// aside column, outside this <form> element — with this form via the
// standard HTML `form` attribute, so every field still submits together
// with one ordinary form submission.
const PROFESSION_CREATE_FORM_ID = "profession-create-form";

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

  // Only General makes sense before a record exists — Recipes and
  // Metadata both describe an existing Profession's relations and
  // history, so they are omitted here rather than shown as disabled
  // placeholders (matching the Item/Recipe General editors' create-page
  // precedent exactly).
  const tabs: EditorTab[] = [
    {
      label: "General",
      href: withProfessionSearchQuery("/admin/professions/new", query),
      active: true,
    },
  ];

  // The dedicated creation page (Slice 9D.1), now composed from the
  // shared editor primitives (Slice 9D.2): the form previously plain,
  // moved here unchanged in field/action/validation terms — only the
  // presentation now uses EditorHeader/EditorTabs/ImagePanel/
  // VerificationPanel/EditorActions. Recipes and Metadata tabs, and
  // TimestampsPanel, do not apply to a record that doesn't exist yet.
  return (
    <ProfessionWorkspace
      rawQuery={q}
      editorHeader={
        <>
          <EditorHeader
            eyebrow="Profession"
            title="Create Profession"
            subtitle="Add a new profession to the wiki."
          />

          <EditorTabs label="Profession editor sections" tabs={tabs} />

          {errorMessage ? (
            <p role="alert" className="banner banner-error">
              {errorMessage}
            </p>
          ) : null}
        </>
      }
      aside={
        <>
          <ImagePanel imageUrl={null} formId={PROFESSION_CREATE_FORM_ID} />

          {/* No fake existing verification state on create: both fields
              are null, so the panel renders Unverified with no stamp
              rows — exactly the state a brand-new Profession actually
              has. */}
          <VerificationPanel
            gameVersions={gameVersions}
            verifiedAt={null}
            verifiedGameVersion={null}
            formId={PROFESSION_CREATE_FORM_ID}
          />
        </>
      }
    >
      <div className="admin-editor-surface">
      <form
        id={PROFESSION_CREATE_FORM_ID}
        action={createProfessionAction}
        className="form-grid form-grid-responsive"
      >
        <div className="admin-editor-sections">
          <EditorSection title="Identity" icon={SECTION_ICONS.identity}>
            {/* Client-enhanced Name + Page address fields (Phase B1); the
                submission-time checks in createProfessionAction remain
                the authoritative protection for both. */}
            <RecordIdentityFields
              checkNameAvailabilityAction={checkProfessionNameAvailability}
              nameTakenText="A profession with that name already exists."
              nameRegionId="profession-name-availability"
              checkSlugAvailabilityAction={checkProfessionSlugAvailability}
              slugTakenText="A profession with that page address already exists."
              slugRegionId="profession-slug-availability"
            />
          </EditorSection>

          <EditorSection title="Description" icon={SECTION_ICONS.content}>
            <label className="form-field">
              <span className="form-field-label">Description (optional)</span>
              <AutosizeTextarea name="description" className="form-input" />
            </label>
          </EditorSection>
        </div>

        {/* Sonnet Rollout Pass: guarded actions row (see the Item create
            page). No id/originalSlug hidden fields exist on create; the
            verification picker is excluded (no-op unless the opt-in
            checkbox is checked). Draft key is create-scoped, isolated
            from every edit record. */}
        <AdminFormGuard
          submitLabel="Create Profession"
          cancelHref={withProfessionSearchQuery(PROFESSION_LIST_PATH, query)}
          excludeFields={["verifiedGameVersionId"]}
          draftKey="profession:new:profession-create-form"
        />
      </form>
      </div>
    </ProfessionWorkspace>
  );
}
