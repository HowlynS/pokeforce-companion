import { notFound } from "next/navigation";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { EditorHeader } from "@/components/admin/editor-header";
import { EditorTabs } from "@/components/admin/editor-tabs";
import { ImagePanel } from "@/components/admin/image-panel";
import { VerificationPanel } from "@/components/admin/verification-panel";
import { TimestampsPanel } from "@/components/admin/timestamps-panel";
import { EditorActions } from "@/components/admin/editor-actions";
import { DangerZonePanel } from "@/components/admin/danger-zone-panel";
import { ProfessionWorkspace } from "@/components/admin/profession-workspace";
import {
  PROFESSION_LIST_PATH,
  normalizeProfessionSearchQuery,
  professionDeleteHref,
  professionEditorTabs,
  withProfessionSearchQuery,
} from "@/lib/admin/profession-workspace";
import { prisma } from "@/lib/db";
import { getImagePublicUrl } from "@/lib/storage/images";
import { RecordNameField } from "@/components/admin/record-name-field";
import { updateProfessionAction } from "../../actions";
import { checkProfessionNameAvailability } from "../../name-availability";

export const dynamic = "force-dynamic";

// Associates the image and verification controls — both rendered in the
// aside column, outside this <form> element — with this form via the
// standard HTML `form` attribute, so every field still submits together
// with one ordinary form submission.
const PROFESSION_EDIT_FORM_ID = "profession-edit-form";

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
  conflicting_image_input:
    "Choose either a replacement image or Remove current image, not both.",
};

type EditProfessionPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; error?: string }>;
};

export default async function EditProfessionPage({
  params,
  searchParams,
}: EditProfessionPageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { slug } = await params;
  const { q, error } = await searchParams;
  const errorMessage = error ? errorMessages[error] ?? "Something went wrong." : null;
  const query = normalizeProfessionSearchQuery(q);

  const profession = await prisma.profession.findUnique({
    where: { slug },
    // Admin-only visibility of the verification stamp: the related Game
    // Version's name is shown in the aside's VerificationPanel below. No
    // recipes include — General never touches or displays that relation
    // (a Recipes relationship tab is a later slice).
    include: { verifiedGameVersion: true },
  });

  if (!profession) {
    notFound();
  }

  // Derived from the trusted database path; null when no image is stored.
  const imageUrl = await getImagePublicUrl(profession.image);

  // Current version first, then newest — the same ordering the
  // settings list uses; feeds the shared verification picker.
  const gameVersions = await prisma.gameVersion.findMany({
    orderBy: [{ isCurrent: "desc" }, { createdAt: "desc" }],
  });

  const tabs = professionEditorTabs(profession.slug, query, "general");

  // The General edit route inside the Profession workspace (Slice 9D.1),
  // now composed from the shared editor primitives (Slice 9D.2): the
  // record list marks this profession selected and keeps the active
  // search applied for quick switching. Every field, redirect, server
  // action, image behavior, and verification rule is unchanged — only
  // the presentation moved. Recipes is a real tab since Slice 9D.3;
  // Metadata remains a disabled placeholder. Delete lives in
  // `EditorActions`' own `deleteHref` since Professions carry no capacity
  // guard that would ever need to hide the form.
  return (
    <ProfessionWorkspace
      rawQuery={q}
      selectedSlug={profession.slug}
      editorHeader={
        <>
          <EditorHeader
            eyebrow="Profession"
            title={profession.name}
            subtitle={profession.slug}
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
          <ImagePanel
            imageUrl={imageUrl}
            imageAlt={`Current image for ${profession.name}`}
            formId={PROFESSION_EDIT_FORM_ID}
          />

          <VerificationPanel
            gameVersions={gameVersions}
            verifiedAt={profession.verifiedAt}
            verifiedGameVersion={profession.verifiedGameVersion}
            formId={PROFESSION_EDIT_FORM_ID}
          />

          <TimestampsPanel
            createdAt={profession.createdAt}
            updatedAt={profession.updatedAt}
          />

          <DangerZonePanel
            resourceLabel="profession"
            deleteHref={professionDeleteHref(profession.slug, query)}
            deleteLabel="Delete Profession"
          />
        </>
      }
    >
      <div className="admin-editor-surface">
      <form
        id={PROFESSION_EDIT_FORM_ID}
        action={updateProfessionAction}
        className="form-grid form-grid-responsive"
      >
        <input type="hidden" name="id" value={profession.id} />
        <input type="hidden" name="originalSlug" value={profession.slug} />

        {/* Client-enhanced Name field with live duplicate feedback. The
            saved name counts as "current" (never queried), and the record's
            own id is excluded server-side so it cannot conflict with
            itself; updateProfessionAction stays the authoritative check. */}
        <RecordNameField
          checkAvailabilityAction={checkProfessionNameAvailability}
          takenText="A profession with that name already exists."
          regionId="profession-name-availability"
          originalName={profession.name}
          excludeId={profession.id}
        />

        <div className="form-field">
          <label className="form-field">
            <span className="form-field-label">Page address</span>
            <input
              type="text"
              name="slug"
              defaultValue={profession.slug}
              className="form-input"
            />
          </label>
          <p className="form-field-feedback" aria-hidden="true"></p>
        </div>

        <label className="form-field">
          <span className="form-field-label">Description (optional)</span>
          <textarea
            name="description"
            rows={4}
            defaultValue={profession.description ?? ""}
            className="form-input"
          />
        </label>

        <EditorActions
          submitLabel="Save Changes"
          cancelHref={withProfessionSearchQuery(PROFESSION_LIST_PATH, query)}
        />
      </form>
      </div>
    </ProfessionWorkspace>
  );
}
