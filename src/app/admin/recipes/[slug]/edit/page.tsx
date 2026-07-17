import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { designTokens } from "@/lib/design-tokens";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { GameVersionVerificationControls } from "@/components/admin/game-version-verification-controls";
import { RecipeWorkspace } from "@/components/admin/recipe-workspace";
import {
  RECIPE_LIST_PATH,
  normalizeRecipeSearchQuery,
  recipeDeleteHref,
  withRecipeSearchQuery,
} from "@/lib/admin/recipe-workspace";
import { prisma } from "@/lib/db";
import { getImagePublicUrl } from "@/lib/storage/images";
import { RECIPE_INGREDIENT_ROW_COUNT } from "@/lib/validation/recipe";
import { RecordNameField } from "@/components/admin/record-name-field";
import { updateRecipeAction } from "../../actions";
import { checkRecipeNameAvailability } from "../../name-availability";

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
        // Version's name is shown next to the opt-in checkbox below.
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

  // The edit route inside the Recipe workspace (Slice 9C.1, following the
  // Item workspace's Slice 9B.4 precedent): the record list marks this
  // recipe selected and keeps the active search applied for quick
  // switching. Every field, redirect, server action, ingredient row,
  // image behavior, and verification control is unchanged — only the
  // navigation wrapper moved. Delete is now reached from this page's
  // toolbar (the old table's per-row Delete link is gone), always
  // rendered regardless of the ingredient-count guard below.
  return (
    <RecipeWorkspace
      rawQuery={q}
      selectedSlug={recipe.slug}
      header={
        <>
          <PageHeader
            eyebrow="Admin"
            title="Edit Recipe"
            description={`Update details for "${recipe.name}".`}
          />

          <nav className="admin-toolbar" aria-label="Recipe editor actions">
            <a
              href={withRecipeSearchQuery(RECIPE_LIST_PATH, query)}
              className="link-accent"
            >
              &larr; Back to Recipe Management
            </a>

            {/* Reachable even when the ingredient-count guard below hides
                the form entirely — deletion must never depend on the edit
                form being renderable (the old table's per-row Delete link
                had no such dependency either). */}
            <a href={recipeDeleteHref(recipe.slug, query)} className="link-danger">
              Delete Recipe
            </a>
          </nav>

          {errorMessage ? (
            <p role="alert" className="banner banner-error">
              {errorMessage}
            </p>
          ) : null}
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
        <form action={updateRecipeAction} className="form-grid form-grid-wide">
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

          <div className="form-field">
            <span className="form-field-label">Current image</span>
            {imageUrl ? (
              <div style={{ position: "relative", justifySelf: "start" }}>
                <style>{`
                  .remove-image-checkbox,
                  .remove-image-hidden-text {
                    position: absolute;
                    width: 1px;
                    height: 1px;
                    margin: -1px;
                    padding: 0;
                    overflow: hidden;
                    clip: rect(0 0 0 0);
                    white-space: nowrap;
                    border: 0;
                  }
                  .remove-image-frame {
                    position: relative;
                    display: inline-block;
                  }
                  .remove-image-toggle {
                    position: absolute;
                    top: 4px;
                    right: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 22px;
                    height: 22px;
                    border-radius: 9999px;
                    background: ${designTokens.colors.danger};
                    color: ${designTokens.colors.background};
                    font-size: 14px;
                    font-weight: 700;
                    line-height: 1;
                    cursor: pointer;
                    user-select: none;
                  }
                  .remove-image-checkbox:focus-visible ~ .remove-image-frame .remove-image-toggle {
                    outline: 2px solid ${designTokens.colors.accent};
                    outline-offset: 2px;
                  }
                  .remove-image-checkbox:checked ~ .remove-image-frame img {
                    opacity: 0.35;
                  }
                  .remove-image-note {
                    display: none;
                    margin: 6px 0 0;
                    color: ${designTokens.colors.danger};
                  }
                  .remove-image-checkbox:checked ~ .remove-image-note {
                    display: block;
                  }
                `}</style>
                <input
                  type="checkbox"
                  name="removeImage"
                  id="removeImage"
                  className="remove-image-checkbox"
                />
                <div className="remove-image-frame">
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
                    className="remove-image-toggle"
                  >
                    <span aria-hidden="true">&times;</span>
                    <span className="remove-image-hidden-text">
                      Remove current image
                    </span>
                  </label>
                </div>
                <p className="remove-image-note">
                  Image will be removed when saved.
                </p>
              </div>
            ) : (
              <span className="form-field-label">No image uploaded.</span>
            )}
          </div>

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
              className="form-input"
            />
          </label>

          {/* Admin-only verification status (public pages never show it).
              Rendered only when BOTH fields are populated — never as an
              empty row; the stable YYYY-MM-DD date never depends on the
              server locale. */}
          {recipe.verifiedAt && recipe.verifiedGameVersion ? (
            <p className="text-muted">
              Gameplay data verified for {recipe.verifiedGameVersion.name} on{" "}
              {recipe.verifiedAt.toISOString().slice(0, 10)}.
            </p>
          ) : null}

          <GameVersionVerificationControls gameVersions={gameVersions} />

          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              Save Changes
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
