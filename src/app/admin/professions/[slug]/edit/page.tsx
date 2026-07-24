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
import { AutosizeTextarea } from "@/components/admin/autosize-textarea";
import { ProfessionWorkspace } from "@/components/admin/profession-workspace";
import {
  PROFESSION_LIST_PATH,
  describeLinkedRecipes,
  normalizeProfessionSearchQuery,
  professionCanDelete,
  professionEditorTabs,
  withProfessionSearchQuery,
} from "@/lib/admin/profession-workspace";
import { prisma } from "@/lib/db";
import { getImagePublicUrl } from "@/lib/storage/images";
import { RecordIdentityFields } from "@/components/admin/record-identity-fields";
import { SECTION_ICONS } from "@/lib/admin/section-icons";
import { updateProfessionAction, deleteProfessionAction } from "../../actions";
import { checkProfessionNameAvailability } from "../../name-availability";
import { checkProfessionSlugAvailability } from "../../slug-availability";

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
    include: {
      // Admin-only visibility of the verification stamp: the related
      // Game Version's name is shown in the aside's VerificationPanel
      // below.
      verifiedGameVersion: true,
      // Count only — feeds the Recipes tab's own badge. No recipes
      // include — General never touches or displays the rows themselves.
      _count: { select: { recipes: true } },
    },
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

  const tabs = professionEditorTabs(profession.slug, query, "general", {
    recipes: profession._count.recipes,
  });

  // Feeds the in-editor delete dialog (Admin Polish Pass 1, Part 5) — the
  // exact same count and rule the dedicated /delete route uses, reusing
  // the tab-badge query above rather than a second query.
  const recipeCount = profession._count.recipes;
  const canDeleteProfession = professionCanDelete(recipeCount);

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
      // Admin Polish Pass 2, Part 5: forces a full remount of the record
      // list, form, and aside whenever this profession's own updatedAt
      // actually changes — see the Item General editor's own identical
      // comment (src/app/admin/items/[slug]/edit/page.tsx) for the full
      // reasoning.
      key={profession.updatedAt.toISOString()}
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
            deleteLabel="Delete Profession"
            dialogTitle="Delete Profession"
            dialogDescription={
              <>
                You are about to permanently delete{" "}
                <strong>{profession.name}</strong> ({profession.slug}). This
                action cannot be undone.
              </>
            }
            canDelete={canDeleteProfession}
            formAction={deleteProfessionAction}
            hiddenFields={{ id: profession.id, slug: profession.slug }}
          >
            <p className="text-muted">Linked recipes: {recipeCount}</p>

            {!canDeleteProfession ? (
              <p className="text-danger">
                This profession cannot be deleted because it is assigned to{" "}
                {describeLinkedRecipes(recipeCount)}. Reassign or remove
                those recipes first.
              </p>
            ) : null}
          </DangerZonePanel>
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

        <div className="admin-editor-sections">
          <EditorSection title="Identity" icon={SECTION_ICONS.identity}>
            {/* Client-enhanced Name + Page address fields (Phase B1).
                Both saved values count as "current" (never queried
                against themselves), and the record's own id is excluded
                server-side so it cannot conflict with itself;
                updateProfessionAction stays the authoritative check for
                both. Page address starts showing the persisted value
                and tracks Name live until the contributor manually
                edits it themselves (Part 11) — the same one-way
                auto/manual behavior create forms already had. */}
            <RecordIdentityFields
              checkNameAvailabilityAction={checkProfessionNameAvailability}
              nameTakenText="A profession with that name already exists."
              nameRegionId="profession-name-availability"
              originalName={profession.name}
              checkSlugAvailabilityAction={checkProfessionSlugAvailability}
              slugTakenText="A profession with that page address already exists."
              slugRegionId="profession-slug-availability"
              initialSlug={profession.slug}
              excludeId={profession.id}
            />
          </EditorSection>

          <EditorSection title="Description" icon={SECTION_ICONS.content}>
            <label className="form-field">
              <span className="form-field-label">Description (optional)</span>
              <AutosizeTextarea
                name="description"
                defaultValue={profession.description ?? ""}
                className="form-input"
              />
            </label>
          </EditorSection>
        </div>

        {/* Sonnet Rollout Pass: the guarded actions row replaces the plain
            EditorActions — unsaved-changes protection, draft persistence,
            Ctrl/Cmd+S, and save-state feedback, all scoped to this form.
            The record id, its original slug, and the verification picker
            (a no-op unless the opt-in checkbox is checked) are excluded
            from dirty comparison. */}
        <AdminFormGuard
          submitLabel="Save Changes"
          cancelHref={withProfessionSearchQuery(PROFESSION_LIST_PATH, query)}
          excludeFields={["id", "originalSlug", "verifiedGameVersionId"]}
          draftKey={`profession:edit:${profession.id}:profession-edit-form`}
          serverUpdatedAt={profession.updatedAt.toISOString()}
        />
      </form>
      </div>
    </ProfessionWorkspace>
  );
}
