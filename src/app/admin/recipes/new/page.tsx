import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { GameVersionVerificationControls } from "@/components/admin/game-version-verification-controls";
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

  // The dedicated creation page (Slice 9C.1, following the Item
  // workspace's Slice 9B.4 precedent): the form previously embedded at
  // the bottom of /admin/recipes, moved here with unchanged action,
  // validation, ingredient rows, image handling, and verification
  // controls. No row is selected in the list while creating. Field
  // grouping, EditorHeader/tabs/ImagePanel/VerificationPanel/
  // TimestampsPanel/sticky EditorActions are deliberately NOT adopted in
  // this pass — only the navigation/wrapper moved.
  return (
    <RecipeWorkspace
      rawQuery={q}
      header={
        <>
          <PageHeader
            eyebrow="Admin"
            title="Create Recipe"
            description="Add a new recipe to the wiki."
          />

          <p className="admin-toolbar">
            <a
              href={withRecipeSearchQuery(RECIPE_LIST_PATH, query)}
              className="link-accent"
            >
              &larr; Back to Recipe Management
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
      {items.length === 0 ? (
        <EmptyState
          title="No items available"
          description="Create at least one item before creating a recipe."
        />
      ) : (
        <form action={createRecipeAction} className="form-grid form-grid-wide">
          {/* Client-enhanced Name field with live duplicate feedback; the
              submission-time duplicate check in createRecipeAction remains
              the authoritative protection. */}
          <RecordNameField
            checkAvailabilityAction={checkRecipeNameAvailability}
            takenText="A recipe with that name already exists."
            regionId="recipe-name-availability"
          />

          <label className="form-field">
            <span className="form-field-label">
              Slug (optional — generated from name if left blank)
            </span>
            <input type="text" name="slug" className="form-input" />
          </label>

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

          <label className="form-field">
            <span className="form-field-label">Resulting quantity</span>
            <input
              type="number"
              name="resultingQuantity"
              min={1}
              step={1}
              defaultValue={1}
              className="form-input"
            />
          </label>

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
              Create Recipe
            </button>

            <a
              href={withRecipeSearchQuery(RECIPE_LIST_PATH, query)}
              className="btn btn-secondary"
            >
              Cancel
            </a>
          </div>
        </form>
      )}
    </RecipeWorkspace>
  );
}
