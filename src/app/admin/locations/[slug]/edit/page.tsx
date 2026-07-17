import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { designTokens } from "@/lib/design-tokens";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { getImagePublicUrl } from "@/lib/storage/images";
import { RecordNameField } from "@/components/admin/record-name-field";
import { LOCATION_TYPES, LOCATION_TYPE_LABELS } from "@/lib/validation/location";
import { updateLocationAction } from "../../actions";
import { checkLocationNameAvailability } from "../../name-availability";

export const dynamic = "force-dynamic";

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
  missing_build_id:
    "The current game build is not configured on the server, so gameplay data cannot be marked as verified.",
};

type EditLocationPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function EditLocationPage({
  params,
  searchParams,
}: EditLocationPageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { slug } = await params;
  const { error } = await searchParams;
  const errorMessage = error ? errorMessages[error] ?? "Something went wrong." : null;

  const [location, allLocations] = await Promise.all([
    prisma.location.findUnique({ where: { slug } }),
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

  return (
    <AppShell>
      <PageHeader
        eyebrow="Admin"
        title="Edit Location"
        description={`Update details for "${location.name}".`}
      />

      <p className="admin-toolbar">
        <a href="/admin/locations" className="link-accent">
          &larr; Back to Location Management
        </a>
      </p>

      {errorMessage ? (
        <p role="alert" className="banner banner-error">
          {errorMessage}
        </p>
      ) : null}

      <form action={updateLocationAction} className="form-grid">
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

        <div className="form-field">
          <span className="form-field-label">Current image</span>
          {imageUrl ? (
            <div style={{ position: "relative", justifySelf: "start" }}>
              <style>{`
                .remove-image-checkbox,
                .remove-image-hidden-text {
                  position: absolute;
                  width: 1px;
                  height: 1px;
                  margin: -1px;
                  padding: 0;
                  overflow: hidden;
                  clip: rect(0 0 0 0);
                  white-space: nowrap;
                  border: 0;
                }
                .remove-image-frame {
                  position: relative;
                  display: inline-block;
                }
                .remove-image-toggle {
                  position: absolute;
                  top: 4px;
                  right: 4px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  width: 22px;
                  height: 22px;
                  border-radius: 9999px;
                  background: ${designTokens.colors.danger};
                  color: ${designTokens.colors.background};
                  font-size: 14px;
                  font-weight: 700;
                  line-height: 1;
                  cursor: pointer;
                  user-select: none;
                }
                .remove-image-checkbox:focus-visible ~ .remove-image-frame .remove-image-toggle {
                  outline: 2px solid ${designTokens.colors.accent};
                  outline-offset: 2px;
                }
                .remove-image-checkbox:checked ~ .remove-image-frame img {
                  opacity: 0.35;
                }
                .remove-image-note {
                  display: none;
                  margin: 6px 0 0;
                  color: ${designTokens.colors.danger};
                }
                .remove-image-checkbox:checked ~ .remove-image-note {
                  display: block;
                }
              `}</style>
              <input
                type="checkbox"
                name="removeImage"
                id="removeImage"
                className="remove-image-checkbox"
              />
              <div className="remove-image-frame">
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
                  className="remove-image-toggle"
                >
                  <span aria-hidden="true">&times;</span>
                  <span className="remove-image-hidden-text">
                    Remove current image
                  </span>
                </label>
              </div>
              <p className="remove-image-note">
                Image will be removed when saved.
              </p>
            </div>
          ) : (
            <span className="form-field-label">No image uploaded.</span>
          )}
        </div>

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
            className="form-input"
          />
        </label>

        {/* Explicit per-save action, deliberately never pre-checked (even
            when the record is already verified): the stamped timestamp and
            build id come from the server, and an unchecked box leaves
            existing verification metadata untouched. */}
        <label className="form-checkbox-field">
          <input type="checkbox" name="markVerified" />
          <span>Mark gameplay data as verified for the current build.</span>
        </label>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary">
            Save Changes
          </button>

          <a href="/admin/locations" className="btn btn-secondary">
            Cancel
          </a>
        </div>
      </form>
    </AppShell>
  );
}
