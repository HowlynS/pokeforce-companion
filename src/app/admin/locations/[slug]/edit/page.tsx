import { notFound } from "next/navigation";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { EditorHeader } from "@/components/admin/editor-header";
import { EditorTabs } from "@/components/admin/editor-tabs";
import { EditorSection } from "@/components/admin/editor-section";
import { ImagePanel } from "@/components/admin/image-panel";
import { VerificationPanel } from "@/components/admin/verification-panel";
import { TimestampsPanel } from "@/components/admin/timestamps-panel";
import { AdminFormGuard } from "@/components/admin/admin-form-guard";
import { AdminSelect } from "@/components/admin/admin-select";
import { DangerZonePanel } from "@/components/admin/danger-zone-panel";
import { AutosizeTextarea } from "@/components/admin/autosize-textarea";
import { prisma } from "@/lib/db";
import { getImagePublicUrl } from "@/lib/storage/images";
import { LocationWorkspace } from "@/components/admin/location-workspace";
import {
  LOCATION_LIST_PATH,
  hierarchyRelationshipCount,
  locationDeleteHref,
  locationEditorTabs,
  normalizeLocationSearchQuery,
  withLocationSearchQuery,
} from "@/lib/admin/location-workspace";
import { RecordIdentityFields } from "@/components/admin/record-identity-fields";
import { LOCATION_TYPES, LOCATION_TYPE_LABELS } from "@/lib/validation/location";
import { SECTION_ICONS } from "@/lib/admin/section-icons";
import { updateLocationGeneralAction } from "../../actions";
import { checkLocationNameAvailability } from "../../name-availability";
import { checkLocationSlugAvailability } from "../../slug-availability";

export const dynamic = "force-dynamic";

// Associates the image and verification controls — both rendered in the
// aside column, outside this <form> element — with this form via the
// standard HTML `form` attribute, so every field still submits together
// with one ordinary form submission.
const LOCATION_EDIT_FORM_ID = "location-edit-form";

// Errors updateLocationGeneralAction can actually produce (Slice 9F.3):
// parent-specific errors (invalid_parent, cyclic_parent) belong to the
// Hierarchy tab's own action and route now.
const errorMessages: Record<string, string> = {
  missing_name: "Location name is required.",
  invalid_slug:
    "Enter a valid slug using lowercase letters, numbers, and hyphens.",
  missing_type: "Select a location type.",
  invalid_type: "Select a valid location type.",
  duplicate: "A location with that name or slug already exists.",
  duplicate_name: "A location with that name already exists.",
  image_too_large: "The image must be 5 MB or smaller.",
  invalid_image_type: "Only PNG, JPEG, and WebP images are allowed.",
  upload_failed: "The image could not be uploaded. Please try again.",
  conflicting_image_input:
    "Choose either a replacement image or Remove current image, not both.",
  no_current_version:
    "No Game Version is marked as current, so gameplay data cannot be marked as verified. Set the current version under Admin - Settings - Game Versions.",
  invalid_game_version:
    "The selected Game Version no longer exists, so gameplay data cannot be marked as verified. Refresh the page and try again.",
};

type EditLocationPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; error?: string }>;
};

export default async function EditLocationPage({
  params,
  searchParams,
}: EditLocationPageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { slug } = await params;
  const { q, error } = await searchParams;
  const errorMessage = error ? errorMessages[error] ?? "Something went wrong." : null;
  const query = normalizeLocationSearchQuery(q);

  // Admin-only visibility of the verification stamp: the related Game
  // Version's name is shown in the aside's VerificationPanel below. No
  // parent or children include — General never touches or displays
  // those relations (parent assignment moved to the Hierarchy tab in
  // Slice 9F.3). Counts only for children/acquisitionSources — they feed
  // the tab strip's own relationship-count badges without loading either
  // relation's actual rows; parentId is already a plain column on the
  // base result, needing no include of its own.
  const location = await prisma.location.findUnique({
    where: { slug },
    include: {
      verifiedGameVersion: true,
      _count: { select: { children: true, acquisitionSources: true } },
    },
  });

  if (!location) {
    notFound();
  }

  // Derived from the trusted database path; null when no image is stored.
  const imageUrl = await getImagePublicUrl(location.image);

  // Current version first, then newest — the same ordering the
  // settings list uses; feeds the shared verification picker.
  const gameVersions = await prisma.gameVersion.findMany({
    orderBy: [{ isCurrent: "desc" }, { createdAt: "desc" }],
  });

  const tabs = locationEditorTabs(location.slug, query, "general", {
    hierarchy: hierarchyRelationshipCount({
      parentId: location.parentId,
      childrenCount: location._count.children,
    }),
    acquisitionSources: location._count.acquisitionSources,
  });

  // The General edit route inside the Location workspace (Slice 9F.1),
  // composed from the shared editor primitives (Slice 9F.2). Slice 9F.3
  // moved parent assignment out of General and into the new Hierarchy
  // tab — General no longer submits or displays parentId at all, and
  // `updateLocationGeneralAction` never touches it, so a General save
  // always preserves the location's existing parent exactly. Every other
  // field, redirect, server action, and image/verification behavior is
  // unchanged — only the presentation moved. Hierarchy is now a real tab;
  // Acquisition Sources and Metadata remain disabled placeholders. Delete
  // lives in `EditorActions`' own `deleteHref` since Locations carry no
  // capacity guard that would ever need to hide the form.
  return (
    <LocationWorkspace
      rawQuery={q}
      selectedSlug={location.slug}
      editorHeader={
        <>
          <EditorHeader
            eyebrow="Location"
            title={location.name}
            subtitle={location.slug}
          />

          <EditorTabs label="Location editor sections" tabs={tabs} />

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
            imageAlt={`Current image for ${location.name}`}
            formId={LOCATION_EDIT_FORM_ID}
          />

          <VerificationPanel
            gameVersions={gameVersions}
            verifiedAt={location.verifiedAt}
            verifiedGameVersion={location.verifiedGameVersion}
            formId={LOCATION_EDIT_FORM_ID}
          />

          <TimestampsPanel
            createdAt={location.createdAt}
            updatedAt={location.updatedAt}
          />

          <DangerZonePanel
            resourceLabel="location"
            deleteHref={locationDeleteHref(location.slug, query)}
            deleteLabel="Delete Location"
          />
        </>
      }
    >

      <div className="admin-editor-surface">
      <form
        id={LOCATION_EDIT_FORM_ID}
        action={updateLocationGeneralAction}
        className="form-grid form-grid-responsive"
      >
        <input type="hidden" name="id" value={location.id} />
        <input type="hidden" name="originalSlug" value={location.slug} />

        <div className="admin-editor-sections">
          <EditorSection title="Identity" icon={SECTION_ICONS.identity}>
            {/* Client-enhanced Name + Page address fields (Phase B1).
                Both saved values count as "current" (never queried
                against themselves), and the record's own id is excluded
                server-side so it cannot conflict with itself;
                updateLocationGeneralAction stays the authoritative
                check for both. Page address starts showing the
                persisted value and tracks Name live until the
                contributor manually edits it themselves (Part 11) — the
                same one-way auto/manual behavior create forms already
                had. */}
            <div className="location-identity-row">
              <RecordIdentityFields
                checkNameAvailabilityAction={checkLocationNameAvailability}
                nameTakenText="A location with that name already exists."
                nameRegionId="location-name-availability"
                originalName={location.name}
                checkSlugAvailabilityAction={checkLocationSlugAvailability}
                slugTakenText="A location with that page address already exists."
                slugRegionId="location-slug-availability"
                initialSlug={location.slug}
                excludeId={location.id}
              />
            </div>
          </EditorSection>

          <EditorSection
            title="Classification"
            icon={SECTION_ICONS.classification}
          >
            <label className="form-field">
              <span className="form-field-label">Type</span>
              <AdminSelect
                name="type"
                required
                defaultValue={location.type}
                options={LOCATION_TYPES.map((type) => ({
                  value: type,
                  label: LOCATION_TYPE_LABELS[type],
                }))}
              />
            </label>
          </EditorSection>

          <EditorSection title="Content" icon={SECTION_ICONS.content}>
            <label className="form-field">
              <span className="form-field-label">Description (optional)</span>
              <AutosizeTextarea
                name="description"
                defaultValue={location.description ?? ""}
                className="form-input"
              />
            </label>

            <label className="form-field">
              <span className="form-field-label">
                Extra information (optional)
              </span>
              <AutosizeTextarea
                name="accessNote"
                defaultValue={location.accessNote ?? ""}
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
            from dirty comparison. General never submits parentId, so this
            form's own snapshot never touches Hierarchy's own field. */}
        <AdminFormGuard
          submitLabel="Save Changes"
          cancelHref={withLocationSearchQuery(LOCATION_LIST_PATH, query)}
          excludeFields={["id", "originalSlug", "verifiedGameVersionId"]}
          draftKey={`location:edit:${location.id}:location-edit-form`}
          serverUpdatedAt={location.updatedAt.toISOString()}
        />
      </form>
      </div>
    </LocationWorkspace>
  );
}
