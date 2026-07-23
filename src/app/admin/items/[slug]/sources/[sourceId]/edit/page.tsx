import { notFound } from "next/navigation";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { EditorHeader } from "@/components/admin/editor-header";
import { EditorTabs } from "@/components/admin/editor-tabs";
import { EditorSection } from "@/components/admin/editor-section";
import { VerificationPanel } from "@/components/admin/verification-panel";
import { AdminFormGuard } from "@/components/admin/admin-form-guard";
import { DangerZonePanel } from "@/components/admin/danger-zone-panel";
import { AutosizeTextarea } from "@/components/admin/autosize-textarea";
import { ItemWorkspace } from "@/components/admin/item-workspace";
import {
  itemEditorTabs,
  itemSourceDeleteHref,
  itemSourcesHref,
  normalizeItemSearchQuery,
} from "@/lib/admin/item-workspace";
import { prisma } from "@/lib/db";
import {
  ACQUISITION_TYPES,
  ACQUISITION_TYPE_LABELS,
} from "@/lib/validation/acquisition-source";
import { updateAcquisitionSourceAction } from "../../actions";
import { SECTION_ICONS } from "@/lib/admin/section-icons";

export const dynamic = "force-dynamic";

// Associates the verification controls — rendered in the aside column,
// outside this <form> element — with this form via the standard HTML
// `form` attribute, so every field still submits together with one
// ordinary form submission (the same pattern the Item General editor
// uses, Slice 9B.5).
const SOURCE_EDIT_FORM_ID = "acquisition-source-edit-form";

const errorMessages: Record<string, string> = {
  missing_type: "Select an acquisition type.",
  invalid_type: "Select a valid acquisition type.",
  invalid_location: "Select an existing location, or choose No location.",
  invalid_profession: "Select an existing profession, or choose No profession.",
  no_current_version:
    "No Game Version is marked as current, so gameplay data cannot be marked as verified. Set the current version under Admin - Settings - Game Versions.",
  invalid_game_version:
    "The selected Game Version no longer exists, so gameplay data cannot be marked as verified. Refresh the page and try again.",
};

type EditAcquisitionSourcePageProps = {
  params: Promise<{ slug: string; sourceId: string }>;
  searchParams: Promise<{ q?: string; error?: string }>;
};

export default async function EditAcquisitionSourcePage({
  params,
  searchParams,
}: EditAcquisitionSourcePageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { slug, sourceId } = await params;
  const { q, error } = await searchParams;
  const errorMessage = error ? errorMessages[error] ?? "Something went wrong." : null;
  const query = normalizeItemSearchQuery(q);

  const [item, locations, professions] = await Promise.all([
    prisma.item.findUnique({
      where: { slug },
      // Counts only — feed the tab strip's own relationship-count
      // badges; this page never needs the actual relation rows.
      include: {
        _count: {
          select: {
            acquisitionSources: true,
            recipesProduced: true,
            recipeIngredients: true,
          },
        },
      },
    }),
    prisma.location.findMany({ orderBy: { name: "asc" } }),
    prisma.profession.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!item) {
    notFound();
  }

  const source = await prisma.acquisitionSource.findUnique({
    where: { id: sourceId },
    // Admin-only visibility of the verification stamp: the related Game
    // Version's name is shown next to the opt-in checkbox below.
    include: { verifiedGameVersion: true },
  });

  // The source must exist AND belong to this exact item — a source id from
  // a different item's URL is treated the same as a missing one.
  if (!source || source.itemId !== item.id) {
    notFound();
  }

  // Current version first, then newest — the same ordering the
  // settings list uses; feeds the shared verification picker.
  const gameVersions = await prisma.gameVersion.findMany({
    orderBy: [{ isCurrent: "desc" }, { createdAt: "desc" }],
  });

  const tabs = itemEditorTabs(item.slug, query, "sources", {
    acquisitionSources: item._count.acquisitionSources,
    usedInRecipes:
      item._count.recipesProduced + item._count.recipeIngredients,
  });

  // Inside the Item workspace (Slice 9B.6): the record list marks this
  // item selected and keeps quick switching on the Acquisition Sources
  // tab. The source itself has no name of its own, so the page's title
  // stays the existing task-oriented heading; the item's name is the
  // subtitle context underneath.
  return (
    <ItemWorkspace
      rawQuery={q}
      selectedSlug={item.slug}
      recordHref={itemSourcesHref}
      editorHeader={
        <>
          <EditorHeader
            eyebrow="Acquisition Source"
            title="Edit Acquisition Source"
            subtitle={item.name}
          />

          <EditorTabs label="Item editor sections" tabs={tabs} />

          {errorMessage ? (
            <p role="alert" className="banner banner-error">
              {errorMessage}
            </p>
          ) : null}
        </>
      }
      aside={
        <>
          <VerificationPanel
            gameVersions={gameVersions}
            verifiedAt={source.verifiedAt}
            verifiedGameVersion={source.verifiedGameVersion}
            formId={SOURCE_EDIT_FORM_ID}
          />

          <DangerZonePanel
            resourceLabel="acquisition source"
            deleteHref={itemSourceDeleteHref(item.slug, source.id, query)}
            deleteLabel="Delete Source"
          />
        </>
      }
    >
      <div className="admin-editor-surface">
      <form
        id={SOURCE_EDIT_FORM_ID}
        action={updateAcquisitionSourceAction}
        className="form-grid form-grid-responsive"
      >
        <input type="hidden" name="id" value={source.id} />
        <input type="hidden" name="itemSlug" value={item.slug} />

        <div className="admin-editor-sections">
          <EditorSection title="Source" icon={SECTION_ICONS.source}>
            <label className="form-field form-field-narrow">
              <span className="form-field-label">Type</span>
              <select
                name="type"
                required
                defaultValue={source.type}
                className="form-input"
              >
                {ACQUISITION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {ACQUISITION_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </label>
          </EditorSection>

          <EditorSection
            title="Linked Context"
            icon={SECTION_ICONS.linkedContext}
          >
            <label className="form-field">
              <span className="form-field-label">Location (optional)</span>
              <select
                name="locationId"
                defaultValue={source.locationId ?? ""}
                className="form-input"
              >
                <option value="">No location</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span className="form-field-label">Profession (optional)</span>
              <select
                name="professionId"
                defaultValue={source.professionId ?? ""}
                className="form-input"
              >
                <option value="">No profession</option>
                {professions.map((profession) => (
                  <option key={profession.id} value={profession.id}>
                    {profession.name}
                  </option>
                ))}
              </select>
            </label>
          </EditorSection>

          <EditorSection title="Details" icon={SECTION_ICONS.details}>
            <div className="form-row-details">
              <label className="form-field">
                <span className="form-field-label">
                  Source label (optional — e.g. &quot;Seed Merchant&quot; or
                  &quot;Vendor on Route 4&quot;)
                </span>
                <input
                  type="text"
                  name="sourceLabel"
                  defaultValue={source.sourceLabel ?? ""}
                  className="form-input"
                />
              </label>

              <label className="form-field">
                <span className="form-field-label">Quantity (optional)</span>
                <input
                  type="text"
                  name="quantity"
                  defaultValue={source.quantity ?? ""}
                  className="form-input"
                />
              </label>
            </div>

            <label className="form-field">
              <span className="form-field-label">Notes (optional)</span>
              <AutosizeTextarea
                name="notes"
                defaultValue={source.notes ?? ""}
                className="form-input"
              />
            </label>
          </EditorSection>
        </div>

        {/* Sonnet Rollout Pass: the guarded actions row replaces the plain
            EditorActions. The record id, the owning item's slug (context,
            never edited here), and the verification picker (a no-op
            unless the opt-in checkbox is checked) are excluded from dirty
            comparison. */}
        <AdminFormGuard
          submitLabel="Save Changes"
          cancelHref={itemSourcesHref(item.slug, query)}
          excludeFields={["id", "itemSlug", "verifiedGameVersionId"]}
          draftKey={`acquisition-source:edit:${source.id}:source-edit-form`}
          serverUpdatedAt={source.updatedAt.toISOString()}
        />
      </form>
      </div>
    </ItemWorkspace>
  );
}
