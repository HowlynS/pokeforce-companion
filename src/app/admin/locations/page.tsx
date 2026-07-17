import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { designTokens } from "@/lib/design-tokens";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { GameVersionVerificationControls } from "@/components/admin/game-version-verification-controls";
import { prisma } from "@/lib/db";
import { RecordNameField } from "@/components/admin/record-name-field";
import { LOCATION_TYPES, LOCATION_TYPE_LABELS } from "@/lib/validation/location";
import { createLocationAction } from "./actions";
import { checkLocationNameAvailability } from "./name-availability";

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
  missing_location: "That location no longer exists.",
  linked_locations:
    "That location cannot be deleted while sub-locations are still assigned to it.",
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

const successMessages: Record<string, string> = {
  created: "Location created.",
  updated: "Location updated.",
  updated_image_cleanup:
    "Location updated, but the previous image file could not be removed from storage and may need manual cleanup in Supabase.",
  deleted: "Location deleted.",
  deleted_image_cleanup:
    "Location deleted, but its image file could not be removed from storage and may need manual cleanup in Supabase.",
};

type AdminLocationsPageProps = {
  searchParams: Promise<{ error?: string; success?: string }>;
};

export default async function AdminLocationsPage({
  searchParams,
}: AdminLocationsPageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { error, success } = await searchParams;
  const errorMessage = error ? errorMessages[error] ?? "Something went wrong." : null;
  const successMessage = success ? successMessages[success] ?? null : null;

  const locations = await prisma.location.findMany({
    include: { parent: true },
    orderBy: { name: "asc" },
  });

  // Current version first, then newest — the same ordering the
  // settings list uses; feeds the shared verification picker.
  const gameVersions = await prisma.gameVersion.findMany({
    orderBy: [{ isCurrent: "desc" }, { createdAt: "desc" }],
  });

  return (
    <AppShell>
      <PageHeader
        eyebrow="Admin"
        title="Location Management"
        description="View existing locations and create new ones."
      />

      <nav className="admin-toolbar" aria-label="Location management">
        <a href="/admin" className="link-accent">
          &larr; Back to Admin
        </a>

        <a href="#create-location" className="btn btn-secondary btn-compact">
          + New location
        </a>
      </nav>

      {errorMessage ? (
        <p role="alert" className="banner banner-error">
          {errorMessage}
        </p>
      ) : null}

      {successMessage ? (
        <p role="status" className="banner banner-success">
          {successMessage}
        </p>
      ) : null}

      <section style={{ marginBottom: designTokens.layout.sectionGap }}>
        <h2 className="section-title">Existing Locations</h2>

        {locations.length > 0 ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  {["Name", "Slug", "Type", "Parent", "Actions"].map(
                    (heading) => (
                      <th key={heading}>{heading}</th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {locations.map((location) => (
                  <tr key={location.id}>
                    <td>{location.name}</td>
                    <td>{location.slug}</td>
                    <td>{LOCATION_TYPE_LABELS[location.type]}</td>
                    <td>{location.parent?.name ?? "—"}</td>
                    <td>
                      <span className="row-actions">
                        <a
                          href={`/admin/locations/${location.slug}/edit`}
                          className="link-accent"
                        >
                          Edit
                        </a>
                        <a
                          href={`/admin/locations/${location.slug}/delete`}
                          className="link-danger"
                        >
                          Delete
                        </a>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No locations yet"
            description="Create the first location using the form below."
          />
        )}
      </section>

      <section id="create-location">
        <h2 className="section-title">Create Location</h2>

        <form action={createLocationAction} className="form-grid">
          {/* Client-enhanced Name field with live duplicate feedback; the
              submission-time duplicate check in createLocationAction
              remains the authoritative protection. */}
          <RecordNameField
            checkAvailabilityAction={checkLocationNameAvailability}
            takenText="A location with that name already exists."
            regionId="location-name-availability"
          />

          <label className="form-field">
            <span className="form-field-label">
              Slug (optional — generated from name if left blank)
            </span>
            <input type="text" name="slug" className="form-input" />
          </label>

          <label className="form-field">
            <span className="form-field-label">Type</span>
            <select name="type" required defaultValue="" className="form-input">
              <option value="" disabled>
                Select a type
              </option>
              {LOCATION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {LOCATION_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span className="form-field-label">Parent location</span>
            <select name="parentId" defaultValue="" className="form-input">
              <option value="">No parent</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span className="form-field-label">Description (optional)</span>
            <textarea name="description" rows={3} className="form-input" />
          </label>

          <label className="form-field">
            <span className="form-field-label">
              Access or unlock note (optional)
            </span>
            <textarea name="accessNote" rows={3} className="form-input" />
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
              Create Location
            </button>
          </div>
        </form>
      </section>
    </AppShell>
  );
}
