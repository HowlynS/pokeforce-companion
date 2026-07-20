import { notFound } from "next/navigation";
import { designTokens } from "@/lib/design-tokens";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { EditorHeader } from "@/components/admin/editor-header";
import { EditorTabs } from "@/components/admin/editor-tabs";
import { ImagePanel } from "@/components/admin/image-panel";
import { VerificationPanel } from "@/components/admin/verification-panel";
import { TimestampsPanel } from "@/components/admin/timestamps-panel";
import { EditorActions } from "@/components/admin/editor-actions";
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
import { updateLocationAction } from "../../actions";
import { checkLocationNameAvailability } from "../../name-availability";

export const dynamic = "force-dynamic";

// Associates the image and verification controls — both rendered in the
// aside column, outside this <form> element — with this form via the
// standard HTML `form` attribute, so every field still submits together
// with one ordinary form submission.
const LOCATION_EDIT_FORM_ID = "location-edit-form";

const errorMessages: Record<string, string> = {
  missing_name: "Location name is required.",
  invalid_slug:
    "Enter a valid slug using lowercase letters, numbers, and hyphens.",
  missing_type: "Select a location type.",
  invalid_type: "Select a valid location type.",
  invalid_parent: "Select an existing location, or choose No parent.",
  cyclic_parent:
    "A location cannot be its own parent or one of its own sub-locations.",
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

  const [location, allLocations] = await Promise.all([
    prisma.location.findUnique({
      where: { slug },
      // Admin-only visibility of the verification stamp: the related Game
      // Version's name is shown in the aside's VerificationPanel below. No
      // children or acquisitionSources include — General never touches or
      // displays those relations (Hierarchy and Acquisition Sources tabs
      // are later slices).
      include: { verifiedGameVersion: true },
    }),
    prisma.location.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!location) {
    notFound();
  }

  // A location can never usefully be its own parent — filtered out here for
  // a cleaner picker. Its descendants are NOT filtered from this list (that
  // would need a tree walk just to build the options); choosing one is
  // still rejected server-side by the same cycle guard the submission uses.
  const parentOptions = allLocations.filter((candidate) => candidate.id !== location.id);

  // Derived from the trusted database path; null when no image is stored.
  const imageUrl = await getImagePublicUrl(location.image);

  // Current version first, then newest — the same ordering the
  // settings list uses; feeds the shared verification picker.
  const gameVersions = await prisma.gameVersion.findMany({
    orderBy: [{ isCurrent: "desc" }, { createdAt: "desc" }],
  });

  const tabs = locationEditorTabs(location.slug, query);

  // The General edit route inside the Location workspace (Slice 9F.1),
  // now composed from the shared editor primitives (Slice 9F.2): the
  // record list marks this location selected and keeps the active search
  // applied for quick switching. Every field, redirect, server action,
  // image behavior, verification rule, and hierarchy/cycle guard is
  // unchanged — only the presentation moved. Hierarchy, Acquisition
  // Sources, and Metadata remain disabled placeholders. Delete lives in
  // `EditorActions`' own `deleteHref` since Locations carry no capacity
  // guard that would ever need to hide the form.
  return (
    <LocationWorkspace
      rawQuery={q}
      selectedSlug={location.slug}
      header={
        <>
          <EditorHeader
            title={location.name}
            subtitle={location.slug}
            backHref={withLocationSearchQuery(LOCATION_LIST_PATH, query)}
            backLabel="Back to Location Management"
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
          <ImagePanel>
            {imageUrl ? (
              <div style={{ position: "relative", justifySelf: "start" }}>
                <input
                  type="checkbox"
                  name="removeImage"
                  id="removeImage"
                  form={LOCATION_EDIT_FORM_ID}
                  className="admin-image-remove-checkbox"
                />
                <div className="admin-image-remove-frame">
                  {/* eslint-disable-next-line @next/next/no-img-element -- admin-only preview; remote next/image configuration is deferred to the public-display slice */}
                  <img
                    src={imageUrl}
                    alt={`Current image for ${location.name}`}
                    style={{
                      maxWidth: "128px",
                      height: "auto",
                      border: `1px solid ${designTokens.colors.border}`,
                      borderRadius: designTokens.radius.sm,
                      background: designTokens.colors.surface,
                      padding: "8px",
                      display: "block",
                    }}
                  />
                  <label
                    htmlFor="removeImage"
                    title="Remove current image"
                    className="admin-image-remove-toggle"
                  >
                    <span aria-hidden="true">&times;</span>
                    <span className="admin-image-remove-hidden-text">
                      Remove current image
                    </span>
                  </label>
                </div>
                <p className="admin-image-remove-note">
                  Image will be removed when saved.
                </p>
              </div>
            ) : (
              <span className="form-field-label">No image uploaded.</span>
            )}

            <label className="form-field">
              <span className="form-field-label">
                {location.image
                  ? "Replacement image (optional — PNG, JPEG, or WebP, up to 5 MB)"
                  : "Image (optional — PNG, JPEG, or WebP, up to 5 MB)"}
              </span>
              <input
                type="file"
                name="image"
                accept="image/png,image/jpeg,image/webp"
                form={LOCATION_EDIT_FORM_ID}
                className="form-input"
              />
            </label>
          </ImagePanel>

          <VerificationPanel
            gameVersions={gameVersions}
            verifiedAt={location.verifiedAt}
            verifiedGameVersion={location.verifiedGameVersion}
            formId={LOCATION_EDIT_FORM_ID}
          />

          <TimestampsPanel
            createdAt={location.createdAt}
            updatedAt={location.updatedAt}
            verifiedAt={location.verifiedAt}
          />
        </>
      }
    >
      <form
        id={LOCATION_EDIT_FORM_ID}
        action={updateLocationAction}
        className="form-grid"
      >
        <input type="hidden" name="id" value={location.id} />
        <input type="hidden" name="originalSlug" value={location.slug} />

        {/* Client-enhanced Name field with live duplicate feedback. The
            saved name counts as "current" (never queried), and the record's
            own id is excluded server-side so it cannot conflict with
            itself; updateLocationAction stays the authoritative check. */}
        <RecordNameField
          checkAvailabilityAction={checkLocationNameAvailability}
          takenText="A location with that name already exists."
          regionId="location-name-availability"
          originalName={location.name}
          excludeId={location.id}
        />

        <label className="form-field">
          <span className="form-field-label">Slug</span>
          <input
            type="text"
            name="slug"
            defaultValue={location.slug}
            className="form-input"
          />
        </label>

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

        <label className="form-field">
          <span className="form-field-label">Parent location</span>
          <select
            name="parentId"
            defaultValue={location.parentId ?? ""}
            className="form-input"
          >
            <option value="">No parent</option>
            {parentOptions.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </select>
        </label>

        <label className="form-field">
          <span className="form-field-label">Description (optional)</span>
          <textarea
            name="description"
            rows={3}
            defaultValue={location.description ?? ""}
            className="form-input"
          />
        </label>

        <label className="form-field">
          <span className="form-field-label">
            Access or unlock note (optional)
          </span>
          <textarea
            name="accessNote"
            rows={3}
            defaultValue={location.accessNote ?? ""}
            className="form-input"
          />
        </label>

        <EditorActions
          submitLabel="Save Changes"
          cancelHref={withLocationSearchQuery(LOCATION_LIST_PATH, query)}
          deleteHref={locationDeleteHref(location.slug, query)}
          deleteLabel="Delete Location"
        />
      </form>
    </LocationWorkspace>
  );
}
