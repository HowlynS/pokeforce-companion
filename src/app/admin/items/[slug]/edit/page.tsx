import { notFound } from "next/navigation";
import { RecordIdentityFields } from "@/components/admin/record-identity-fields";
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
import { ItemWorkspace } from "@/components/admin/item-workspace";
import {
  describeItemRecipeReferences,
  itemCanDelete,
  itemEditorTabs,
  normalizeItemSearchQuery,
  withItemSearchQuery,
} from "@/lib/admin/item-workspace";
import { prisma } from "@/lib/db";
import { getImagePublicUrl } from "@/lib/storage/images";
import { toEntitySelectOptions } from "@/lib/admin/entity-select-options";
import { SECTION_ICONS } from "@/lib/admin/section-icons";
import { updateItemAction, deleteItemAction } from "../../actions";
import { checkItemNameAvailability } from "../../name-availability";
import { checkItemSlugAvailability } from "../../slug-availability";

export const dynamic = "force-dynamic";

// Associates the image and verification controls — both rendered in the
// aside column, outside this <form> element — with this form via the
// standard HTML `form` attribute, so every field still submits together
// with one ordinary form submission.
const ITEM_EDIT_FORM_ID = "item-edit-form";

const errorMessages: Record<string, string> = {
  missing_name: "Item name is required.",
  invalid_slug:
    "Enter a valid slug using lowercase letters, numbers, and hyphens.",
  invalid_base_value: "Base value must be a whole number of zero or more.",
  duplicate: "An item with that name or slug already exists.",
  duplicate_name: "An item with that name already exists.",
  invalid_category: "Select an existing category, or choose No category.",
  missing_item: "That item no longer exists.",
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

type EditItemPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; error?: string }>;
};

export default async function EditItemPage({
  params,
  searchParams,
}: EditItemPageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { slug } = await params;
  const { q, error } = await searchParams;
  const errorMessage = error ? errorMessages[error] ?? "Something went wrong." : null;
  const query = normalizeItemSearchQuery(q);

  const [item, categories] = await Promise.all([
    prisma.item.findUnique({
      where: { slug },
      include: {
        // Admin-only visibility of the verification stamp: the related
        // Game Version's name is shown next to the opt-in checkbox below.
        verifiedGameVersion: true,
        // Counts only (never the full relation rows) — feeds the tab
        // strip's own relationship-count badges below; General never
        // needs the actual Acquisition Source/Recipe rows themselves.
        _count: {
          select: {
            acquisitionSources: true,
            recipesProduced: true,
            recipeIngredients: true,
          },
        },
      },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!item) {
    notFound();
  }

  // Derived from the trusted database path; null when no image is stored.
  const imageUrl = await getImagePublicUrl(item.image);
  const categoryOptions = await toEntitySelectOptions(categories);

  // Feeds the in-editor delete dialog (Admin Polish Pass 1, Part 5) — the
  // exact same counts and rule the dedicated /delete route uses (see
  // itemCanDelete's own doc comment), reusing data this page's own tab-
  // badge query already loads rather than a second query.
  const resultCount = item._count.recipesProduced;
  const ingredientCount = item._count.recipeIngredients;
  const canDeleteItem = itemCanDelete({
    recipesProduced: resultCount,
    recipeIngredients: ingredientCount,
  });

  // Current version first, then newest — the same ordering the
  // settings list uses; feeds the shared verification picker.
  const gameVersions = await prisma.gameVersion.findMany({
    orderBy: [{ isCurrent: "desc" }, { createdAt: "desc" }],
  });

  // General is the only implemented section; Acquisition Sources is a
  // real tab since Slice 9B.6 (its own workspace-integrated destination).
  // Used in Recipes and Metadata still describe content that doesn't
  // exist yet and render as inert placeholders rather than links to
  // empty pages.
  const tabs = itemEditorTabs(item.slug, query, "general", {
    acquisitionSources: item._count.acquisitionSources,
    usedInRecipes:
      item._count.recipesProduced + item._count.recipeIngredients,
  });

  // The edit route inside the Item workspace (Slice 9B.4), now composed
  // from the shared editor primitives (Slice 9B.5): the record list marks
  // this item selected and keeps the active search applied for quick
  // switching; every field, redirect, and server action is unchanged —
  // only the presentation moved into EditorHeader/Tabs/Panels/Actions.
  // The header's former "Manage acquisition sources" action is gone
  // (Slice 9B.6) — the Acquisition Sources tab replaces it.
  return (
    <ItemWorkspace
      // Admin Polish Pass 2, Part 5: forces a full remount of the record
      // list, form, and aside (AdminFormGuard's dirty/draft baseline,
      // ImagePanel's local preview/removed state, etc.) whenever this
      // item's own updatedAt actually changes — i.e. exactly once per
      // successful save-in-place, and never on an unrelated re-render
      // (a validation-error redirect leaves updatedAt untouched). This is
      // the same "reset state by changing key" pattern React's own docs
      // recommend, and avoids adding bespoke reset logic to every
      // already-complex stateful child individually.
      key={item.updatedAt.toISOString()}
      rawQuery={q}
      selectedSlug={item.slug}
      editorHeader={
        <>
          <EditorHeader
            eyebrow="Item"
            title={item.name}
            subtitle={item.slug}
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
          <ImagePanel
            imageUrl={imageUrl}
            imageAlt={`Current image for ${item.name}`}
            formId={ITEM_EDIT_FORM_ID}
          />

          <VerificationPanel
            gameVersions={gameVersions}
            verifiedAt={item.verifiedAt}
            verifiedGameVersion={item.verifiedGameVersion}
            formId={ITEM_EDIT_FORM_ID}
          />

          <TimestampsPanel
            createdAt={item.createdAt}
            updatedAt={item.updatedAt}
          />

          <DangerZonePanel
            resourceLabel="item"
            deleteLabel="Delete item"
            dialogTitle="Delete Item"
            dialogDescription={
              <>
                You are about to permanently delete{" "}
                <strong>{item.name}</strong> ({item.slug}). This action
                cannot be undone.
              </>
            }
            canDelete={canDeleteItem}
            formAction={deleteItemAction}
            hiddenFields={{ id: item.id, slug: item.slug }}
          >
            <p className="text-muted">
              Category:{" "}
              {categoryOptions.find((option) => option.value === item.categoryId)
                ?.label ?? "Uncategorized"}
            </p>

            <p className="text-muted">
              Used as a recipe result: {resultCount}
            </p>

            <p className="text-muted">
              Used as a recipe ingredient: {ingredientCount}
            </p>

            {!canDeleteItem ? (
              <p className="text-danger">
                This item cannot be deleted because it is used as{" "}
                {describeItemRecipeReferences(resultCount, ingredientCount)}.
                Remove or reassign those recipe references first.
              </p>
            ) : null}
          </DangerZonePanel>
        </>
      }
    >
      <div className="admin-editor-surface">
      <form
        id={ITEM_EDIT_FORM_ID}
        action={updateItemAction}
        className="form-grid form-grid-responsive item-general-form"
      >
        <input type="hidden" name="id" value={item.id} />
        <input type="hidden" name="originalSlug" value={item.slug} />

        <div className="item-general-columns">
          <div className="item-general-column">
            <EditorSection title="Identity" icon={SECTION_ICONS.identity}>
              {/* Client-enhanced Name + Page address fields (Phase B1).
                  Both saved values count as "current" (never queried
                  against themselves), and the record's own id is
                  excluded server-side so it cannot conflict with itself;
                  updateItemAction stays the authoritative check for
                  both. Page address starts showing the persisted value
                  and tracks Name live until the contributor manually
                  edits it themselves (Part 11) — the same one-way
                  auto/manual behavior create forms already had. */}
              <RecordIdentityFields
                checkNameAvailabilityAction={checkItemNameAvailability}
                nameTakenText="An item with that name already exists."
                nameRegionId="item-name-availability"
                originalName={item.name}
                checkSlugAvailabilityAction={checkItemSlugAvailability}
                slugTakenText="An item with that page address already exists."
                slugRegionId="item-slug-availability"
                initialSlug={item.slug}
                excludeId={item.id}
              />
            </EditorSection>

            <EditorSection title="Description" icon={SECTION_ICONS.content}>
              <label className="form-field">
                <span className="form-field-label">Description (optional)</span>
                <AutosizeTextarea
                  name="description"
                  defaultValue={item.description ?? ""}
                  className="form-input"
                />
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
                  defaultValue={item.categoryId ?? ""}
                  options={[
                    { value: "", label: "No category", imageUrl: null },
                    ...categoryOptions,
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
                  <input
                    type="checkbox"
                    name="heldItem"
                    defaultChecked={item.heldItem}
                  />
                  <span>Held item</span>
                </label>

                <label className="form-checkbox-field">
                  <input
                    type="checkbox"
                    name="tradeable"
                    defaultChecked={item.tradeable}
                  />
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
                  defaultValue={item.baseValue ?? ""}
                  className="form-input"
                />
              </label>
            </EditorSection>
          </div>
        </div>

        {/* Opus Pass 2 pilot: the guarded actions row replaces the plain
            EditorActions — unsaved-changes protection, draft persistence,
            Ctrl/Cmd+S, and save-state feedback, all scoped to this form.
            The record id, its original slug, and the verification picker
            (a no-op unless the opt-in checkbox is checked) are excluded
            from dirty comparison. */}
        <AdminFormGuard
          submitLabel="Save Changes"
          cancelHref={withItemSearchQuery("/admin/items", query)}
          excludeFields={["id", "originalSlug", "verifiedGameVersionId"]}
          draftKey={`item:edit:${item.id}:item-edit-form`}
          serverUpdatedAt={item.updatedAt.toISOString()}
        />
      </form>
      </div>
    </ItemWorkspace>
  );
}
