import { requireAdminUser } from "@/lib/auth/require-admin";
import { EditorHeader } from "@/components/admin/editor-header";
import { EditorTabs, type EditorTab } from "@/components/admin/editor-tabs";
import { EditorSection } from "@/components/admin/editor-section";
import { ImagePanel } from "@/components/admin/image-panel";
import { VerificationPanel } from "@/components/admin/verification-panel";
import { AdminFormGuard } from "@/components/admin/admin-form-guard";
import { LocationWorkspace } from "@/components/admin/location-workspace";
import {
  LOCATION_LIST_PATH,
  normalizeLocationSearchQuery,
  withLocationSearchQuery,
} from "@/lib/admin/location-workspace";
import { prisma } from "@/lib/db";
import { RecordIdentityFields } from "@/components/admin/record-identity-fields";
import { AutosizeTextarea } from "@/components/admin/autosize-textarea";
import { LOCATION_TYPES, LOCATION_TYPE_LABELS } from "@/lib/validation/location";
import { SECTION_ICONS } from "@/lib/admin/section-icons";
import { createLocationAction } from "../actions";
import { checkLocationNameAvailability } from "../name-availability";
import { checkLocationSlugAvailability } from "../slug-availability";

export const dynamic = "force-dynamic";

// Associates the image and verification controls — both rendered in the
// aside column, outside this <form> element — with this form via the
// standard HTML `form` attribute, so every field still submits together
// with one ordinary form submission.
const LOCATION_CREATE_FORM_ID = "location-create-form";

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

  // Only General makes sense before a record exists — Hierarchy,
  // Acquisition Sources, and Metadata all describe an existing Location's
  // relations and history, so they are omitted here rather than shown as
  // disabled placeholders (matching the Item/Recipe/Profession General
  // editors' create-page precedent exactly).
  const tabs: EditorTab[] = [
    {
      label: "General",
      href: withLocationSearchQuery("/admin/locations/new", query),
      active: true,
    },
  ];

  // The dedicated creation page (Slice 9F.1), now composed from the
  // shared editor primitives (Slice 9F.2): the form previously plain,
  // moved here unchanged in field/action/validation terms — only the
  // presentation now uses EditorHeader/EditorTabs/ImagePanel/
  // VerificationPanel/EditorActions. Hierarchy, Acquisition Sources, and
  // Metadata tabs, and TimestampsPanel, do not apply to a record that
  // doesn't exist yet. Parent selection stays right here in General for
  // this slice — a dedicated Hierarchy tab is later work.
  return (
    <LocationWorkspace
      rawQuery={q}
      editorHeader={
        <>
          <EditorHeader
            eyebrow="Location"
            title="Create Location"
            subtitle="Add a new location to the wiki."
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
          <ImagePanel imageUrl={null} formId={LOCATION_CREATE_FORM_ID} />

          {/* No fake existing verification state on create: both fields
              are null, so the panel renders Unverified with no stamp
              rows — exactly the state a brand-new Location actually
              has. */}
          <VerificationPanel
            gameVersions={gameVersions}
            verifiedAt={null}
            verifiedGameVersion={null}
            formId={LOCATION_CREATE_FORM_ID}
          />
        </>
      }
    >
      <div className="admin-editor-surface">
      <form
        id={LOCATION_CREATE_FORM_ID}
        action={createLocationAction}
        className="form-grid form-grid-responsive"
      >
        <div className="admin-editor-sections">
          <EditorSection title="Identity" icon={SECTION_ICONS.identity}>
            {/* Client-enhanced Name + Page address fields (Phase B1);
                the submission-time checks in createLocationAction remain
                the authoritative protection for both. */}
            <div className="location-identity-row">
              <RecordIdentityFields
                checkNameAvailabilityAction={checkLocationNameAvailability}
                nameTakenText="A location with that name already exists."
                nameRegionId="location-name-availability"
                checkSlugAvailabilityAction={checkLocationSlugAvailability}
                slugTakenText="A location with that page address already exists."
                slugRegionId="location-slug-availability"
              />
            </div>
          </EditorSection>

          <EditorSection
            title="Classification"
            icon={SECTION_ICONS.classification}
          >
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
          </EditorSection>

          <EditorSection title="Content" icon={SECTION_ICONS.content}>
            <label className="form-field">
              <span className="form-field-label">Description (optional)</span>
              <AutosizeTextarea name="description" className="form-input" />
            </label>

            <label className="form-field">
              <span className="form-field-label">
                Extra information (optional)
              </span>
              <AutosizeTextarea name="accessNote" className="form-input" />
            </label>
          </EditorSection>
        </div>

        {/* Sonnet Rollout Pass: guarded actions row (see the Item create
            page). No id/originalSlug hidden fields exist on create; the
            verification picker is excluded (no-op unless the opt-in
            checkbox is checked). Draft key is create-scoped, isolated
            from every edit record. */}
        <AdminFormGuard
          submitLabel="Create Location"
          cancelHref={withLocationSearchQuery(LOCATION_LIST_PATH, query)}
          excludeFields={["verifiedGameVersionId"]}
          draftKey="location:new:location-create-form"
        />
      </form>
      </div>
    </LocationWorkspace>
  );
}
