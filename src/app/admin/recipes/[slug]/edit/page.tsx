import { notFound } from "next/navigation";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { EditorHeader } from "@/components/admin/editor-header";
import { EditorTabs } from "@/components/admin/editor-tabs";
import { EditorSection } from "@/components/admin/editor-section";
import { ImagePanel } from "@/components/admin/image-panel";
import { VerificationPanel } from "@/components/admin/verification-panel";
import { TimestampsPanel } from "@/components/admin/timestamps-panel";
import { AdminFormGuard } from "@/components/admin/admin-form-guard";
import { DangerZonePanel } from "@/components/admin/danger-zone-panel";
import { RecipeWorkspace } from "@/components/admin/recipe-workspace";
import {
  RECIPE_LIST_PATH,
  normalizeRecipeSearchQuery,
  recipeDeleteHref,
  recipeEditorTabs,
  withRecipeSearchQuery,
} from "@/lib/admin/recipe-workspace";
import { prisma } from "@/lib/db";
import { getImagePublicUrl } from "@/lib/storage/images";
import { RecordIdentityFields } from "@/components/admin/record-identity-fields";
import { FieldLabelWithHelp } from "@/components/admin/field-label-with-help";
import { SECTION_ICONS } from "@/lib/admin/section-icons";
import { updateRecipeGeneralAction } from "../../actions";
import { checkRecipeNameAvailability } from "../../name-availability";
import { checkRecipeSlugAvailability } from "../../slug-availability";

export const dynamic = "force-dynamic";

// Associates the image and verification controls — both rendered in the
// aside column, outside this <form> element — with this form via the
// standard HTML `form` attribute, so every field still submits together
// with one ordinary form submission.
const RECIPE_EDIT_FORM_ID = "recipe-edit-form";

// Errors updateRecipeGeneralAction can actually produce (Slice 9C.3):
// ingredient-specific errors (no_ingredients, incomplete_ingredient,
// invalid_quantity, duplicate_ingredient, invalid_ingredient_item) belong
// to the Ingredients tab's own action and route now.
const errorMessages: Record<string, string> = {
  no_current_version:
    "No Game Version is marked as current, so gameplay data cannot be marked as verified. Set the current version under Admin - Settings - Game Versions.",
  invalid_game_version:
    "The selected Game Version no longer exists, so gameplay data cannot be marked as verified. Refresh the page and try again.",
  missing_name: "Recipe name is required.",
  invalid_slug:
    "Enter a valid slug using lowercase letters, numbers, and hyphens.",
  missing_resulting_item: "Select the item this recipe produces.",
  invalid_result_quantity_min:
    "Minimum quantity must be a whole number of at least 1.",
  invalid_result_quantity_max:
    "Maximum quantity must be a whole number of at least 1.",
  invalid_result_quantity_range:
    "Maximum quantity must be equal to or greater than minimum quantity.",
  invalid_required_level:
    "Required level must be a whole number of zero or more.",
  invalid_resulting_item: "Select an existing item as the recipe's result.",
  invalid_profession: "Select an existing profession, or choose No profession.",
  duplicate: "A recipe with that name or slug already exists.",
  duplicate_name: "A recipe with that name already exists.",
  missing_recipe: "That recipe no longer exists.",
  relation_changed:
    "The selected item, or the profession, no longer exists. Please review your selections and try again.",
  image_too_large: "The image must be 5 MB or smaller.",
  invalid_image_type: "Only PNG, JPEG, and WebP images are allowed.",
  upload_failed: "The image could not be uploaded. Please try again.",
  conflicting_image_input:
    "Choose either a replacement image or Remove current image, not both.",
};

type EditRecipePageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; error?: string }>;
};

export default async function EditRecipePage({
  params,
  searchParams,
}: EditRecipePageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { slug } = await params;
  const { q, error } = await searchParams;
  const errorMessage = error ? errorMessages[error] ?? "Something went wrong." : null;
  const query = normalizeRecipeSearchQuery(q);

  const [recipe, items, professions] = await Promise.all([
    prisma.recipe.findUnique({
      where: { slug },
      include: {
        // Admin-only visibility of the verification stamp: the related
        // Game Version's name is shown in the aside's VerificationPanel
        // below.
        verifiedGameVersion: true,
        // Count only — feeds the Ingredients tab's own badge. No
        // ingredients include — General never touches or displays the
        // rows themselves (Slice 9C.3 moved that to its own Ingredients
        // tab/route).
        _count: { select: { ingredients: true } },
      },
    }),
    prisma.item.findMany({ orderBy: { name: "asc" } }),
    prisma.profession.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!recipe) {
    notFound();
  }

  // Derived from the trusted database path; null when no image is stored.
  const imageUrl = await getImagePublicUrl(recipe.image);

  // Current version first, then newest — the same ordering the
  // settings list uses; feeds the shared verification picker.
  const gameVersions = await prisma.gameVersion.findMany({
    orderBy: [{ isCurrent: "desc" }, { createdAt: "desc" }],
  });

  const tabs = recipeEditorTabs(recipe.slug, query, "general", {
    ingredients: recipe._count.ingredients,
  });

  // The General edit route inside the Recipe workspace (Slice 9C.3): the
  // record list marks this recipe selected and keeps the active search
  // applied for quick switching. This page is now ALWAYS fully editable,
  // regardless of how many ingredients the recipe carries — the former
  // all-or-nothing too-many-ingredients guard moved to the Ingredients
  // tab/route, which is the only place ingredient rows exist now. Every
  // remaining field, redirect, image behavior, and verification rule is
  // unchanged — only ingredients and their guard moved out. Delete lives
  // in the header's action slot (EditorHeader `actions`), unconditional
  // exactly as before.
  return (
    <RecipeWorkspace
      rawQuery={q}
      selectedSlug={recipe.slug}
      editorHeader={
        <>
          <EditorHeader
            eyebrow="Recipe"
            title={recipe.name}
            subtitle={recipe.slug}
          />

          <EditorTabs label="Recipe editor sections" tabs={tabs} />

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
            imageAlt={`Current image for ${recipe.name}`}
            formId={RECIPE_EDIT_FORM_ID}
          />

          <VerificationPanel
            gameVersions={gameVersions}
            verifiedAt={recipe.verifiedAt}
            verifiedGameVersion={recipe.verifiedGameVersion}
            formId={RECIPE_EDIT_FORM_ID}
          />

          <TimestampsPanel
            createdAt={recipe.createdAt}
            updatedAt={recipe.updatedAt}
          />

          <DangerZonePanel
            resourceLabel="recipe"
            deleteHref={recipeDeleteHref(recipe.slug, query)}
            deleteLabel="Delete Recipe"
          />
        </>
      }
    >
      <div className="admin-editor-surface">
      <form
        id={RECIPE_EDIT_FORM_ID}
        action={updateRecipeGeneralAction}
        className="form-grid form-grid-wide form-grid-responsive"
      >
        <input type="hidden" name="id" value={recipe.id} />
        <input type="hidden" name="originalSlug" value={recipe.slug} />

        <div className="admin-editor-sections admin-editor-sections--two-col">
          <EditorSection
            title="Identity"
            icon={SECTION_ICONS.identity}
            className="admin-editor-section--full"
          >
            {/* Client-enhanced Name + Page address fields (Phase B1).
                Both saved values count as "current" (never queried
                against themselves), and the record's own id is excluded
                server-side so it cannot conflict with itself;
                updateRecipeGeneralAction stays the authoritative check
                for both. Page address starts showing the persisted
                value and tracks Name live until the contributor
                manually edits it themselves (Part 11) — the same
                one-way auto/manual behavior create forms already had. */}
            <RecordIdentityFields
              checkNameAvailabilityAction={checkRecipeNameAvailability}
              nameTakenText="A recipe with that name already exists."
              nameRegionId="recipe-name-availability"
              originalName={recipe.name}
              checkSlugAvailabilityAction={checkRecipeSlugAvailability}
              slugTakenText="A recipe with that page address already exists."
              slugRegionId="recipe-slug-availability"
              initialSlug={recipe.slug}
              excludeId={recipe.id}
            />
          </EditorSection>

          <EditorSection title="Output" icon={SECTION_ICONS.output}>
            <label className="form-field">
              <span className="form-field-label">Resulting item</span>
              <select
                name="resultingItemId"
                required
                defaultValue={recipe.resultingItemId}
                className="form-input"
              >
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="form-field">
              <div className="recipe-quantity-range">
                <div className="recipe-quantity-field">
                  <FieldLabelWithHelp
                    htmlFor="recipe-result-quantity-min"
                    helpLabel="More information about Minimum quantity"
                    helpContent="The smallest number of items this recipe can produce."
                  >
                    Minimum quantity
                  </FieldLabelWithHelp>
                  <input
                    id="recipe-result-quantity-min"
                    type="number"
                    name="resultQuantityMin"
                    min={1}
                    step={1}
                    defaultValue={recipe.resultQuantityMin}
                    className="form-input"
                  />
                </div>

                <div className="recipe-quantity-field">
                  <FieldLabelWithHelp
                    htmlFor="recipe-result-quantity-max"
                    helpLabel="More information about Maximum quantity"
                    helpContent="The largest number of items this recipe can produce. Use the same value as minimum when the output is fixed."
                  >
                    Maximum quantity
                  </FieldLabelWithHelp>
                  <input
                    id="recipe-result-quantity-max"
                    type="number"
                    name="resultQuantityMax"
                    min={1}
                    step={1}
                    defaultValue={recipe.resultQuantityMax}
                    className="form-input"
                  />
                </div>
              </div>
            </div>
          </EditorSection>

          <EditorSection
            title="Requirements"
            icon={SECTION_ICONS.requirements}
          >
            <label className="form-field">
              <span className="form-field-label">Profession</span>
              <select
                name="professionId"
                defaultValue={recipe.professionId ?? ""}
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

            <label className="form-field form-field-narrow">
              <span className="form-field-label">Required level (optional)</span>
              <input
                type="number"
                name="requiredLevel"
                min={0}
                step={1}
                defaultValue={recipe.requiredLevel ?? ""}
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
            from dirty comparison. */}
        <AdminFormGuard
          submitLabel="Save Changes"
          cancelHref={withRecipeSearchQuery(RECIPE_LIST_PATH, query)}
          excludeFields={["id", "originalSlug", "verifiedGameVersionId"]}
          draftKey={`recipe:edit:${recipe.id}:recipe-edit-form`}
          serverUpdatedAt={recipe.updatedAt.toISOString()}
        />
      </form>
      </div>
    </RecipeWorkspace>
  );
}
