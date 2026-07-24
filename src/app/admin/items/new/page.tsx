import { EditorHeader } from "@/components/admin/editor-header";
import { EditorTabs, type EditorTab } from "@/components/admin/editor-tabs";
import { EditorSection } from "@/components/admin/editor-section";
import { ImagePanel } from "@/components/admin/image-panel";
import { VerificationPanel } from "@/components/admin/verification-panel";
import { AdminFormGuard } from "@/components/admin/admin-form-guard";
import { AdminSelect } from "@/components/admin/admin-select";
import { RecordIdentityFields } from "@/components/admin/record-identity-fields";
import { AutosizeTextarea } from "@/components/admin/autosize-textarea";
import { ItemWorkspace } from "@/components/admin/item-workspace";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { SECTION_ICONS } from "@/lib/admin/section-icons";
import {
  ITEM_LIST_PATH,
  normalizeItemSearchQuery,
  withItemSearchQuery,
} from "@/lib/admin/item-workspace";
import { createItemAction } from "../actions";
import { checkItemNameAvailability } from "../name-availability";
import { checkItemSlugAvailability } from "../slug-availability";

export const dynamic = "force-dynamic";

// Associates the file input and the verification controls — both
// rendered in the aside column, outside this <form> element — with this
// form via the standard HTML `form` attribute, so every field still
// submits together with one ordinary form submission.
const ITEM_CREATE_FORM_ID = "item-create-form";

const errorMessages: Record<string, string> = {
  missing_name: "Item name is required.",
  invalid_slug:
    "Enter a valid slug using lowercase letters, numbers, and hyphens.",
  invalid_base_value: "Base value must be a whole number of zero or more.",
  duplicate: "An item with that name or slug already exists.",
  duplicate_name: "An item with that name already exists.",
  invalid_category: "Select an existing category, or choose No category.",
  image_too_large: "The image must be 5 MB or smaller.",
  invalid_image_type: "Only PNG, JPEG, and WebP images are allowed.",
  upload_failed: "The image could not be uploaded. Please try again.",
  no_current_version:
    "No Game Version is marked as current, so gameplay data cannot be marked as verified. Set the current version under Admin - Settings - Game Versions.",
  invalid_game_version:
    "The selected Game Version no longer exists, so gameplay data cannot be marked as verified. Refresh the page and try again.",
};

type NewItemPageProps = {
  searchParams: Promise<{ q?: string; error?: string }>;
};

export default async function NewItemPage({ searchParams }: NewItemPageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { q, error } = await searchParams;
  const errorMessage = error ? errorMessages[error] ?? "Something went wrong." : null;
  const query = normalizeItemSearchQuery(q);

  const [categories, gameVersions] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    // Current version first, then newest — the same ordering the
    // settings list uses; feeds the shared verification picker.
    prisma.gameVersion.findMany({
      orderBy: [{ isCurrent: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  // Only General makes sense before a record exists — Acquisition
  // Sources, Used in Recipes, and Metadata all describe an existing
  // Item's relations and history, so they are omitted here rather than
  // shown as disabled placeholders (Slice 9B.5).
  const tabs: EditorTab[] = [
    {
      label: "General",
      href: withItemSearchQuery("/admin/items/new", query),
      active: true,
    },
  ];

  // The dedicated creation page (Slice 9B.4), now composed from the
  // shared editor primitives (Slice 9B.5): the form previously embedded
  // at the bottom of /admin/items, moved here with unchanged action,
  // validation, image handling, and verification controls. No row is
  // selected in the list while creating.
  return (
    <ItemWorkspace
      rawQuery={q}
      editorHeader={
        <>
          <EditorHeader
            eyebrow="Item"
            title="Create item"
            subtitle="Add a new item to the wiki."
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
          <ImagePanel imageUrl={null} formId={ITEM_CREATE_FORM_ID} />

          {/* No fake existing verification state on create: both fields
              are null, so the panel renders Unverified with no stamp
              rows — exactly the state a brand-new Item actually has. */}
          <VerificationPanel
            gameVersions={gameVersions}
            verifiedAt={null}
            verifiedGameVersion={null}
            formId={ITEM_CREATE_FORM_ID}
          />
        </>
      }
    >
      <div className="admin-editor-surface">
      <form
        id={ITEM_CREATE_FORM_ID}
        action={createItemAction}
        className="form-grid form-grid-responsive item-general-form"
      >
        <div className="item-general-columns">
          <div className="item-general-column">
            <EditorSection title="Identity" icon={SECTION_ICONS.identity}>
              {/* Client-enhanced Name + Page address fields (Phase B1):
                  live duplicate-name feedback, live slug auto-generation
                  from Name, and live slug-availability feedback. The
                  submission-time checks in createItemAction remain the
                  authoritative protection for both fields. */}
              <RecordIdentityFields
                checkNameAvailabilityAction={checkItemNameAvailability}
                nameTakenText="An item with that name already exists."
                nameRegionId="item-name-availability"
                checkSlugAvailabilityAction={checkItemSlugAvailability}
                slugTakenText="An item with that page address already exists."
                slugRegionId="item-slug-availability"
              />
            </EditorSection>

            <EditorSection title="Description" icon={SECTION_ICONS.content}>
              <label className="form-field">
                <span className="form-field-label">Description (optional)</span>
                <AutosizeTextarea name="description" className="form-input" />
              </label>
            </EditorSection>
          </div>

          <div className="item-general-column">
            <EditorSection
              title="Classification"
              icon={SECTION_ICONS.classification}
            >
              <label className="form-field">
                <span className="form-field-label">Category</span>
                <AdminSelect
                  name="categoryId"
                  defaultValue=""
                  options={[
                    { value: "", label: "No category" },
                    ...categories.map((category) => ({
                      value: category.id,
                      label: category.name,
                    })),
                  ]}
                />
              </label>
            </EditorSection>

            <EditorSection
              title="Gameplay Details"
              icon={SECTION_ICONS.gameplayDetails}
            >
              <div className="form-checkbox-group">
                <label className="form-checkbox-field">
                  <input type="checkbox" name="heldItem" />
                  <span>Held item</span>
                </label>

                <label className="form-checkbox-field">
                  <input type="checkbox" name="tradeable" />
                  <span>Tradeable</span>
                </label>
              </div>

              <label className="form-field">
                <span className="form-field-label">Base value (optional)</span>
                <input
                  type="number"
                  name="baseValue"
                  min={0}
                  step={1}
                  className="form-input"
                />
              </label>
            </EditorSection>
          </div>
        </div>

        {/* Opus Pass 2 pilot: guarded actions row (see the edit page).
            No id/originalSlug hidden fields exist on create; the
            verification picker is excluded (no-op unless the opt-in
            checkbox is checked). Draft key is create-scoped, isolated
            from every edit record. */}
        <AdminFormGuard
          submitLabel="Create item"
          cancelHref={withItemSearchQuery(ITEM_LIST_PATH, query)}
          excludeFields={["verifiedGameVersionId"]}
          draftKey="item:new:item-create-form"
        />
      </form>
      </div>
    </ItemWorkspace>
  );
}
