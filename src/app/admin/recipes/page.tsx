import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { designTokens } from "@/lib/design-tokens";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { GameVersionVerificationControls } from "@/components/admin/game-version-verification-controls";
import { prisma } from "@/lib/db";
import { RECIPE_INGREDIENT_ROW_COUNT } from "@/lib/validation/recipe";
import { RecordNameField } from "@/components/admin/record-name-field";
import { createRecipeAction } from "./actions";
import { checkRecipeNameAvailability } from "./name-availability";

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
  missing_recipe: "That recipe no longer exists.",
  relation_changed:
    "One of the selected items, or the profession, no longer exists. Please review your selections and try again.",
  image_too_large: "The image must be 5 MB or smaller.",
  invalid_image_type: "Only PNG, JPEG, and WebP images are allowed.",
  upload_failed: "The image could not be uploaded. Please try again.",
  conflicting_image_input:
    "Choose either a replacement image or Remove current image, not both.",
};

const successMessages: Record<string, string> = {
  created: "Recipe created.",
  updated: "Recipe updated.",
  updated_image_cleanup:
    "Recipe updated, but the previous image file could not be removed from storage and may need manual cleanup in Supabase.",
  deleted: "Recipe deleted.",
  deleted_image_cleanup:
    "Recipe deleted, but its image file could not be removed from storage and may need manual cleanup in Supabase.",
};

type AdminRecipesPageProps = {
  searchParams: Promise<{ error?: string; success?: string }>;
};

export default async function AdminRecipesPage({
  searchParams,
}: AdminRecipesPageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { error, success } = await searchParams;
  const errorMessage = error ? errorMessages[error] ?? "Something went wrong." : null;
  const successMessage = success ? successMessages[success] ?? null : null;

  const [recipes, items, professions] = await Promise.all([
    prisma.recipe.findMany({
      include: {
        resultingItem: true,
        profession: true,
        ingredients: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.item.findMany({ orderBy: { name: "asc" } }),
    prisma.profession.findMany({ orderBy: { name: "asc" } }),
  ]);

  const ingredientRows = Array.from(
    { length: RECIPE_INGREDIENT_ROW_COUNT },
    (_, index) => index + 1
  );

  // Current version first, then newest — the same ordering the
  // settings list uses; feeds the shared verification picker.
  const gameVersions = await prisma.gameVersion.findMany({
    orderBy: [{ isCurrent: "desc" }, { createdAt: "desc" }],
  });

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Recipe Management"
        description="View existing recipes and create new ones."
      />

      <nav className="admin-toolbar" aria-label="Recipe management">
        <a href="/admin" className="link-accent">
          &larr; Back to Admin
        </a>

        <a href="#create-recipe" className="btn btn-secondary btn-compact">
          + New recipe
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
        <h2 className="section-title">Existing Recipes</h2>

        {recipes.length > 0 ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  {["Name", "Slug", "Result", "Profession", "Ingredients", "Actions"].map(
                    (heading) => (
                      <th key={heading}>{heading}</th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {recipes.map((recipe) => (
                  <tr key={recipe.id}>
                    <td>{recipe.name}</td>
                    <td>{recipe.slug}</td>
                    <td>
                      {recipe.resultingQuantity}x {recipe.resultingItem.name}
                    </td>
                    <td>{recipe.profession?.name ?? "No profession"}</td>
                    <td>{recipe.ingredients.length}</td>
                    <td>
                      <span className="row-actions">
                        <a
                          href={`/admin/recipes/${recipe.slug}/edit`}
                          className="link-accent"
                        >
                          Edit
                        </a>
                        <a
                          href={`/admin/recipes/${recipe.slug}/delete`}
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
            title="No recipes yet"
            description="Create the first recipe using the form below."
          />
        )}
      </section>

      <section id="create-recipe">
        <h2 className="section-title">Create Recipe</h2>

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
            </div>
          </form>
        )}
      </section>
    </>
  );
}
