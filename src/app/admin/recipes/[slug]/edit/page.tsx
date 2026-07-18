import { notFound } from "next/navigation";
import { designTokens } from "@/lib/design-tokens";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { EditorHeader } from "@/components/admin/editor-header";
import { EditorTabs } from "@/components/admin/editor-tabs";
import { ImagePanel } from "@/components/admin/image-panel";
import { VerificationPanel } from "@/components/admin/verification-panel";
import { TimestampsPanel } from "@/components/admin/timestamps-panel";
import { EditorActions } from "@/components/admin/editor-actions";
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
import { RECIPE_INGREDIENT_ROW_COUNT } from "@/lib/validation/recipe";
import { RecordNameField } from "@/components/admin/record-name-field";
import { updateRecipeAction } from "../../actions";
import { checkRecipeNameAvailability } from "../../name-availability";

export const dynamic = "force-dynamic";

// Associates the image and verification controls — both rendered in the
// aside column, outside this <form> element — with this form via the
// standard HTML `form` attribute, so every field still submits together
// with one ordinary form submission.
const RECIPE_EDIT_FORM_ID = "recipe-edit-form";

const errorMessages: Record<string, string> = {
  no_current_version:
    "No Game Version is marked as current, so gameplay data cannot be marked as verified. Set the current version under Admin - Settings - Game Versions.",
  invalid_game_version:
    "The selected Game Version no longer exists, so gameplay data cannot be marked as verified. Refresh the page and try again.",
  missing_name: "Recipe name is required.",
  invalid_slug:
    "Enter a valid slug using lowercase letters, numbers, and hyphens.",
  missing_resulting_item: "Select the item this recipe produces.",
  invalid_resulting_quantity:
    "Resulting quantity must be a whole number of at least 1.",
  invalid_required_level:
    "Required level must be a whole number of zero or more.",
  no_ingredients: "Add at least one ingredient.",
  incomplete_ingredient:
    "Each ingredient row needs both an item and a quantity.",
  invalid_quantity:
    "Ingredient quantities must be whole numbers of at least 1.",
  duplicate_ingredient: "Each ingredient can only be added once.",
  invalid_resulting_item: "Select an existing item as the recipe's result.",
  invalid_profession: "Select an existing profession, or choose No profession.",
  invalid_ingredient_item:
    "One or more selected ingredient items no longer exist.",
  duplicate: "A recipe with that name or slug already exists.",
  duplicate_name: "A recipe with that name already exists.",
  missing_recipe: "That recipe no longer exists.",
  relation_changed:
    "One of the selected items, or the profession, no longer exists. Please review your selections and try again.",
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
        ingredients: {
          include: { item: true },
          orderBy: { item: { name: "asc" } },
        },
        // Admin-only visibility of the verification stamp: the related Game
        // Version's name is shown in the aside's VerificationPanel below.
        verifiedGameVersion: true,
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

  const tooManyIngredients =
    recipe.ingredients.length > RECIPE_INGREDIENT_ROW_COUNT;

  const ingredientRows = Array.from(
    { length: RECIPE_INGREDIENT_ROW_COUNT },
    (_, index) => index + 1
  );

  // Current version first, then newest — the same ordering the
  // settings list uses; feeds the shared verification picker.
  const gameVersions = await prisma.gameVersion.findMany({
    orderBy: [{ isCurrent: "desc" }, { createdAt: "desc" }],
  });

  const tabs = recipeEditorTabs(recipe.slug, query);

  // The edit route inside the Recipe workspace, now composed from the
  // shared editor primitives (Slice 9C.2): the record list marks this
  // recipe selected and keeps the active search applied for quick
  // switching. Every field, redirect, server action, ingredient row,
  // image behavior, and verification rule is unchanged — only the
  // presentation moved. Delete lives in the header's action slot
  // (EditorHeader `actions`), so it stays reachable even when the
  // ingredient-count guard below hides the entire form — the same
  // guarantee the Slice 9C.1 toolbar link provided, now via the shared
  // primitive's own extension point instead of a bespoke nav element.
  return (
    <RecipeWorkspace
      rawQuery={q}
      selectedSlug={recipe.slug}
      header={
        <>
          <EditorHeader
            title={recipe.name}
            subtitle={recipe.slug}
            backHref={withRecipeSearchQuery(RECIPE_LIST_PATH, query)}
            backLabel="Back to Recipe Management"
            actions={
              <a
                href={recipeDeleteHref(recipe.slug, query)}
                className="link-danger"
              >
                Delete Recipe
              </a>
            }
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
          {/* Image and verification controls submit into the main form
              below, so they are withheld — exactly like the pre-9C.2
              behavior, where the whole form (image and verification
              included) was replaced by the alert — whenever the
              ingredient-count guard hides that form; there is nothing
              for them to submit into in that state. Timestamps are pure
              read-only display of already-loaded data, so they render
              regardless. */}
          {!tooManyIngredients ? (
            <>
              <ImagePanel>
                {imageUrl ? (
                  <div style={{ position: "relative", justifySelf: "start" }}>
                    <input
                      type="checkbox"
                      name="removeImage"
                      id="removeImage"
                      form={RECIPE_EDIT_FORM_ID}
                      className="admin-image-remove-checkbox"
                    />
                    <div className="admin-image-remove-frame">
                      {/* eslint-disable-next-line @next/next/no-img-element -- admin-only preview; remote next/image configuration is deferred to the public-display slice */}
                      <img
                        src={imageUrl}
                        alt={`Current image for ${recipe.name}`}
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
                    {recipe.image
                      ? "Replacement image (optional — PNG, JPEG, or WebP, up to 5 MB)"
                      : "Image (optional — PNG, JPEG, or WebP, up to 5 MB)"}
                  </span>
                  <input
                    type="file"
                    name="image"
                    accept="image/png,image/jpeg,image/webp"
                    form={RECIPE_EDIT_FORM_ID}
                    className="form-input"
                  />
                </label>
              </ImagePanel>

              <VerificationPanel
                gameVersions={gameVersions}
                verifiedAt={recipe.verifiedAt}
                verifiedGameVersion={recipe.verifiedGameVersion}
                formId={RECIPE_EDIT_FORM_ID}
              />
            </>
          ) : null}

          <TimestampsPanel
            createdAt={recipe.createdAt}
            updatedAt={recipe.updatedAt}
            verifiedAt={recipe.verifiedAt}
          />
        </>
      }
    >
      {tooManyIngredients ? (
        <p role="alert" className="banner banner-error" style={{ margin: 0 }}>
          This recipe has {recipe.ingredients.length} ingredients, but the
          edit form currently supports only {RECIPE_INGREDIENT_ROW_COUNT}.
          Editing is unavailable until the form supports more ingredient
          rows, so none of this recipe&apos;s data is at risk of being
          dropped.
        </p>
      ) : (
        <form
          id={RECIPE_EDIT_FORM_ID}
          action={updateRecipeAction}
          className="form-grid form-grid-wide"
        >
          <input type="hidden" name="id" value={recipe.id} />
          <input type="hidden" name="originalSlug" value={recipe.slug} />

          {/* Client-enhanced Name field with live duplicate feedback. The
              saved name counts as "current" (never queried), and the
              record's own id is excluded server-side so it cannot conflict
              with itself; updateRecipeAction stays the authoritative
              check. */}
          <RecordNameField
            checkAvailabilityAction={checkRecipeNameAvailability}
            takenText="A recipe with that name already exists."
            regionId="recipe-name-availability"
            originalName={recipe.name}
            excludeId={recipe.id}
          />

          <label className="form-field">
            <span className="form-field-label">Slug</span>
            <input
              type="text"
              name="slug"
              defaultValue={recipe.slug}
              className="form-input"
            />
          </label>

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

          <label className="form-field">
            <span className="form-field-label">Resulting quantity</span>
            <input
              type="number"
              name="resultingQuantity"
              min={1}
              step={1}
              defaultValue={recipe.resultingQuantity}
              className="form-input"
            />
          </label>

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

          <label className="form-field">
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

          <fieldset className="form-fieldset">
            <legend>Ingredients (fill at least one row)</legend>

            {ingredientRows.map((row) => {
              const existingIngredient = recipe.ingredients[row - 1];

              return (
                <div key={row} className="ingredient-row">
                  <select
                    name={`ingredientItemId${row}`}
                    defaultValue={existingIngredient?.itemId ?? ""}
                    className="form-input"
                  >
                    <option value="">No ingredient</option>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    name={`ingredientQuantity${row}`}
                    min={1}
                    step={1}
                    placeholder="Qty"
                    defaultValue={existingIngredient?.quantity ?? ""}
                    className="form-input"
                  />
                </div>
              );
            })}
          </fieldset>

          <EditorActions
            submitLabel="Save Changes"
            cancelHref={withRecipeSearchQuery(RECIPE_LIST_PATH, query)}
          />
        </form>
      )}
    </RecipeWorkspace>
  );
}
