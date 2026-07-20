import { PageHeader } from "@/components/layout/page-header";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { GameVersionVerificationControls } from "@/components/admin/game-version-verification-controls";
import { LocationWorkspace } from "@/components/admin/location-workspace";
import {
  LOCATION_LIST_PATH,
  normalizeLocationSearchQuery,
  withLocationSearchQuery,
} from "@/lib/admin/location-workspace";
import { prisma } from "@/lib/db";
import { RecordNameField } from "@/components/admin/record-name-field";
import { LOCATION_TYPES, LOCATION_TYPE_LABELS } from "@/lib/validation/location";
import { createLocationAction } from "../actions";
import { checkLocationNameAvailability } from "../name-availability";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  missing_name: "Location name is required.",
  invalid_slug:
    "Enter a valid slug using lowercase letters, numbers, and hyphens.",
  missing_type: "Select a location type.",
  invalid_type: "Select a valid location type.",
  invalid_parent: "Select an existing location, or choose No parent.",
  duplicate: "A location with that name or slug already exists.",
  duplicate_name: "A location with that name already exists.",
  image_too_large: "The image must be 5 MB or smaller.",
  invalid_image_type: "Only PNG, JPEG, and WebP images are allowed.",
  upload_failed: "The image could not be uploaded. Please try again.",
  no_current_version:
    "No Game Version is marked as current, so gameplay data cannot be marked as verified. Set the current version under Admin - Settings - Game Versions.",
  invalid_game_version:
    "The selected Game Version no longer exists, so gameplay data cannot be marked as verified. Refresh the page and try again.",
};

type NewLocationPageProps = {
  searchParams: Promise<{ q?: string; error?: string }>;
};

export default async function NewLocationPage({
  searchParams,
}: NewLocationPageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { q, error } = await searchParams;
  const errorMessage = error ? errorMessages[error] ?? "Something went wrong." : null;
  const query = normalizeLocationSearchQuery(q);

  // The full, unfiltered Location list feeds the Parent picker — deliberately
  // independent of the workspace's own (possibly search-filtered) record
  // list query. A brand-new location has no id yet, so every existing
  // Location is a valid candidate parent (no self/descendant exclusion is
  // needed here, unlike the edit page).
  const parentOptions = await prisma.location.findMany({
    orderBy: { name: "asc" },
  });

  // Current version first, then newest — the same ordering the settings
  // list uses; feeds the shared verification picker.
  const gameVersions = await prisma.gameVersion.findMany({
    orderBy: [{ isCurrent: "desc" }, { createdAt: "desc" }],
  });

  // The dedicated creation page, following the Item/Recipe/Profession/
  // Category workspaces' navigation-foundation precedent: the form
  // previously embedded at the bottom of /admin/locations, moved here
  // with unchanged action, fields, image handling, and verification
  // controls. EditorHeader/tabs/ImagePanel/VerificationPanel/sticky
  // EditorActions are deliberately NOT adopted this pass — only the
  // navigation/wrapper moved.
  return (
    <LocationWorkspace
      rawQuery={q}
      header={
        <>
          <PageHeader
            eyebrow="Admin"
            title="Create Location"
            description="Add a new location to the wiki."
          />

          <p className="admin-toolbar">
            <a
              href={withLocationSearchQuery(LOCATION_LIST_PATH, query)}
              className="link-accent"
            >
              &larr; Back to Location Management
            </a>
          </p>

          {errorMessage ? (
            <p role="alert" className="banner banner-error">
              {errorMessage}
            </p>
          ) : null}
        </>
      }
    >
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
            {parentOptions.map((location) => (
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

          <a
            href={withLocationSearchQuery(LOCATION_LIST_PATH, query)}
            className="btn btn-secondary"
          >
            Cancel
          </a>
        </div>
      </form>
    </LocationWorkspace>
  );
}
