import { EmptyState } from "@/components/ui/empty-state";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { EditorHeader } from "@/components/admin/editor-header";
import { EditorTabs, type EditorTab } from "@/components/admin/editor-tabs";
import { ImagePanel } from "@/components/admin/image-panel";
import { VerificationPanel } from "@/components/admin/verification-panel";
import { EditorActions } from "@/components/admin/editor-actions";
import { RecipeWorkspace } from "@/components/admin/recipe-workspace";
import {
  RECIPE_LIST_PATH,
  normalizeRecipeSearchQuery,
  withRecipeSearchQuery,
} from "@/lib/admin/recipe-workspace";
import { prisma } from "@/lib/db";
import { RECIPE_INGREDIENT_ROW_COUNT } from "@/lib/validation/recipe";
import { RecordNameField } from "@/components/admin/record-name-field";
import { createRecipeAction } from "../actions";
import { checkRecipeNameAvailability } from "../name-availability";

export const dynamic = "force-dynamic";

// Associates the image and verification controls — both rendered in the
// aside column, outside this <form> element — with this form via the
// standard HTML `form` attribute, so every field still submits together
// with one ordinary form submission.
const RECIPE_CREATE_FORM_ID = "recipe-create-form";

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
  image_too_large: "The image must be 5 MB or smaller.",
  invalid_image_type: "Only PNG, JPEG, and WebP images are allowed.",
  upload_failed: "The image could not be uploaded. Please try again.",
};

type NewRecipePageProps = {
  searchParams: Promise<{ q?: string; error?: string }>;
};

export default async function NewRecipePage({
  searchParams,
}: NewRecipePageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { q, error } = await searchParams;
  const errorMessage = error ? errorMessages[error] ?? "Something went wrong." : null;
  const query = normalizeRecipeSearchQuery(q);

  const [items, professions, gameVersions] = await Promise.all([
    prisma.item.findMany({ orderBy: { name: "asc" } }),
    prisma.profession.findMany({ orderBy: { name: "asc" } }),
    // Current version first, then newest — the same ordering the
    // settings list uses; feeds the shared verification picker.
    prisma.gameVersion.findMany({
      orderBy: [{ isCurrent: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  const ingredientRows = Array.from(
    { length: RECIPE_INGREDIENT_ROW_COUNT },
    (_, index) => index + 1
  );

  // Only General makes sense before a record exists — Ingredients and
  // Metadata both describe an existing Recipe's relations and history, so
  // they are omitted here rather than shown as disabled placeholders
  // (matching the Item General editor's create-page precedent exactly).
  const tabs: EditorTab[] = [
    {
      label: "General",
      href: withRecipeSearchQuery("/admin/recipes/new", query),
      active: true,
    },
  ];

  // The dedicated creation page (Slice 9C.1), now composed from the
  // shared editor primitives (Slice 9C.2): the form previously plain,
  // moved here unchanged in field/action/validation terms — only the
  // presentation now uses EditorHeader/EditorTabs/ImagePanel/
  // VerificationPanel/EditorActions. Ingredients remain embedded in
  // General fields; Ingredients and Metadata tabs, and TimestampsPanel,
  // do not apply to a record that doesn't exist yet.
  return (
    <RecipeWorkspace
      rawQuery={q}
      editorHeader={
        <>
          <EditorHeader
            eyebrow="Recipe"
            title="Create Recipe"
            subtitle="Add a new recipe to the wiki."
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
          <ImagePanel imageUrl={null} formId={RECIPE_CREATE_FORM_ID} />

          {/* No fake existing verification state on create: both fields
              are null, so the panel renders Unverified with no stamp
              rows — exactly the state a brand-new Recipe actually has. */}
          <VerificationPanel
            gameVersions={gameVersions}
            verifiedAt={null}
            verifiedGameVersion={null}
            formId={RECIPE_CREATE_FORM_ID}
          />
        </>
      }
    >
      {items.length === 0 ? (
        <EmptyState
          title="No items available"
          description="Create at least one item before creating a recipe."
        />
      ) : (
        <div className="admin-editor-surface">
        <form
          id={RECIPE_CREATE_FORM_ID}
          action={createRecipeAction}
          className="form-grid form-grid-wide form-grid-responsive"
        >
          <p className="form-section-heading">Identity</p>

          {/* Client-enhanced Name field with live duplicate feedback; the
              submission-time duplicate check in createRecipeAction remains
              the authoritative protection. */}
          <RecordNameField
            checkAvailabilityAction={checkRecipeNameAvailability}
            takenText="A recipe with that name already exists."
            regionId="recipe-name-availability"
          />

          <div className="form-field">
            <label className="form-field">
              <span className="form-field-label">
                Page address (optional — generated from name if left blank)
              </span>
              <input type="text" name="slug" className="form-input" />
            </label>
            <p className="form-field-feedback" aria-hidden="true"></p>
          </div>

          <p className="form-section-heading">Output</p>

          <label className="form-field">
            <span className="form-field-label">Resulting item</span>
            <select
              name="resultingItemId"
              required
              defaultValue=""
              className="form-input"
            >
              <option value="" disabled>
                Select an item
              </option>
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
                <label className="form-field">
                  <span className="form-field-label">Minimum quantity</span>
                  <input
                    type="number"
                    name="resultQuantityMin"
                    min={1}
                    step={1}
                    defaultValue={1}
                    className="form-input"
                  />
                </label>
                <p className="form-field-helper">
                  The smallest number of items this recipe can produce.
                </p>
              </div>

              <div className="recipe-quantity-field">
                <label className="form-field">
                  <span className="form-field-label">Maximum quantity</span>
                  <input
                    type="number"
                    name="resultQuantityMax"
                    min={1}
                    step={1}
                    defaultValue={1}
                    className="form-input"
                  />
                </label>
                <p className="form-field-helper">
                  The largest number of items this recipe can produce. Use
                  the same value as minimum when the output is fixed.
                </p>
              </div>
            </div>
          </div>

          <label className="form-field">
            <span className="form-field-label">Profession</span>
            <select name="professionId" defaultValue="" className="form-input">
              <option value="">No profession</option>
              {professions.map((profession) => (
                <option key={profession.id} value={profession.id}>
                  {profession.name}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span className="form-field-label">
              Required level (optional)
            </span>
            <input
              type="number"
              name="requiredLevel"
              min={0}
              step={1}
              className="form-input"
            />
          </label>

          <fieldset className="form-fieldset">
            <legend>Ingredients (fill at least one row)</legend>

            {ingredientRows.map((row) => (
              <div key={row} className="ingredient-row">
                <select
                  name={`ingredientItemId${row}`}
                  defaultValue=""
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
                  className="form-input"
                />
              </div>
            ))}
          </fieldset>

          <EditorActions
            submitLabel="Create Recipe"
            cancelHref={withRecipeSearchQuery(RECIPE_LIST_PATH, query)}
          />
        </form>
        </div>
      )}
    </RecipeWorkspace>
  );
}
