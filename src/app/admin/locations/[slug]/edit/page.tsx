import { notFound } from "next/navigation";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { EditorHeader } from "@/components/admin/editor-header";
import { EditorTabs } from "@/components/admin/editor-tabs";
import { ImagePanel } from "@/components/admin/image-panel";
import { VerificationPanel } from "@/components/admin/verification-panel";
import { TimestampsPanel } from "@/components/admin/timestamps-panel";
import { EditorActions } from "@/components/admin/editor-actions";
import { DangerZonePanel } from "@/components/admin/danger-zone-panel";
import { prisma } from "@/lib/db";
import { getImagePublicUrl } from "@/lib/storage/images";
import { LocationWorkspace } from "@/components/admin/location-workspace";
import {
  LOCATION_LIST_PATH,
  locationDeleteHref,
  locationEditorTabs,
  normalizeLocationSearchQuery,
  withLocationSearchQuery,
} from "@/lib/admin/location-workspace";
import { RecordNameField } from "@/components/admin/record-name-field";
import { LOCATION_TYPES, LOCATION_TYPE_LABELS } from "@/lib/validation/location";
import { updateLocationGeneralAction } from "../../actions";
import { checkLocationNameAvailability } from "../../name-availability";

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
  // parent, children, or acquisitionSources include — General never
  // touches or displays those relations (parent assignment moved to the
  // Hierarchy tab in Slice 9F.3; Acquisition Sources is a later slice).
  const location = await prisma.location.findUnique({
    where: { slug },
    include: { verifiedGameVersion: true },
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

  const tabs = locationEditorTabs(location.slug, query, "general");

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

        <p className="form-section-heading">Identity</p>

        {/* Client-enhanced Name field with live duplicate feedback. The
            saved name counts as "current" (never queried), and the record's
            own id is excluded server-side so it cannot conflict with
            itself; updateLocationGeneralAction stays the authoritative
            check. */}
        <RecordNameField
          checkAvailabilityAction={checkLocationNameAvailability}
          takenText="A location with that name already exists."
          regionId="location-name-availability"
          originalName={location.name}
          excludeId={location.id}
        />

        <div className="form-field">
          <label className="form-field">
            <span className="form-field-label">Page address</span>
            <input
              type="text"
              name="slug"
              defaultValue={location.slug}
              className="form-input"
            />
          </label>
          <p className="form-field-feedback" aria-hidden="true"></p>
        </div>

        <label className="form-field">
          <span className="form-field-label">Type</span>
          <select
            name="type"
            required
            defaultValue={location.type}
            className="form-input"
          >
            {LOCATION_TYPES.map((type) => (
              <option key={type} value={type}>
                {LOCATION_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>

        <p className="form-section-heading">Content</p>

        <label className="form-field">
          <span className="form-field-label">Description (optional)</span>
          <textarea
            name="description"
            rows={4}
            defaultValue={location.description ?? ""}
            className="form-input"
          />
        </label>

        <label className="form-field">
          <span className="form-field-label">
            Extra information (optional)
          </span>
          <textarea
            name="accessNote"
            rows={4}
            defaultValue={location.accessNote ?? ""}
            className="form-input"
          />
        </label>

        <EditorActions
          submitLabel="Save Changes"
          cancelHref={withLocationSearchQuery(LOCATION_LIST_PATH, query)}
        />
      </form>
      </div>
    </LocationWorkspace>
  );
}
