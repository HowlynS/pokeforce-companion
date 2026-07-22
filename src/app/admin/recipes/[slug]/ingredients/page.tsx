import { notFound } from "next/navigation";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { EditorHeader } from "@/components/admin/editor-header";
import { EditorTabs } from "@/components/admin/editor-tabs";
import { EditorActions } from "@/components/admin/editor-actions";
import { RecipeWorkspace } from "@/components/admin/recipe-workspace";
import {
  RECIPE_LIST_PATH,
  normalizeRecipeSearchQuery,
  recipeDeleteHref,
  recipeEditorTabs,
  recipeIngredientsHref,
  withRecipeSearchQuery,
} from "@/lib/admin/recipe-workspace";
import { prisma } from "@/lib/db";
import { RECIPE_INGREDIENT_ROW_COUNT } from "@/lib/validation/recipe";
import { updateRecipeIngredientsAction } from "../../actions";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  no_ingredients: "Add at least one ingredient.",
  incomplete_ingredient:
    "Each ingredient row needs both an item and a quantity.",
  invalid_quantity:
    "Ingredient quantities must be whole numbers of at least 1.",
  duplicate_ingredient: "Each ingredient can only be added once.",
  invalid_ingredient_item:
    "One or more selected ingredient items no longer exist.",
  relation_changed:
    "One of the selected ingredient items no longer exists. Please review your selections and try again.",
  missing_recipe: "That recipe no longer exists.",
  // Defense in depth only — the form below is never rendered for a
  // recipe already over capacity, so a normal admin can never trigger
  // this through the real UI.
  too_many_ingredients:
    "This recipe currently has more ingredients than this form supports, so it cannot be saved from here.",
};

type IngredientsPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; error?: string }>;
};

export default async function RecipeIngredientsPage({
  params,
  searchParams,
}: IngredientsPageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { slug } = await params;
  const { q, error } = await searchParams;
  const errorMessage = error ? errorMessages[error] ?? "Something went wrong." : null;
  const query = normalizeRecipeSearchQuery(q);

  const [recipe, items] = await Promise.all([
    prisma.recipe.findUnique({
      where: { slug },
      include: {
        ingredients: {
          include: { item: true },
          orderBy: { item: { name: "asc" } },
        },
      },
    }),
    prisma.item.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!recipe) {
    notFound();
  }

  const tooManyIngredients =
    recipe.ingredients.length > RECIPE_INGREDIENT_ROW_COUNT;

  const ingredientRows = Array.from(
    { length: RECIPE_INGREDIENT_ROW_COUNT },
    (_, index) => index + 1
  );

  const tabs = recipeEditorTabs(recipe.slug, query, "ingredients");

  // The Ingredients tab (Slice 9C.3): the recipe's ingredient rows,
  // edited independently of its other fields via updateRecipeIngredientsAction
  // (touches only the RecipeIngredient table — name, slug, resulting
  // item, profession, required level, image, and verification are never
  // read or written here). No ImagePanel/VerificationPanel/
  // TimestampsPanel — this tab has nothing to do with any of them. Delete
  // lives in the header's action slot, unconditional exactly like the
  // General tab, so it stays reachable even when the ingredient-count
  // guard below hides this page's own form — the same guarantee Slice
  // 9C.1/9C.2 already established, now isolated to Ingredients only
  // (General itself no longer carries any such guard).
  return (
    <RecipeWorkspace
      rawQuery={q}
      selectedSlug={recipe.slug}
      recordHref={recipeIngredientsHref}
      header={
        <>
          <EditorHeader
            eyebrow="Recipe"
            title={recipe.name}
            subtitle={recipe.slug}
            backHref={withRecipeSearchQuery(RECIPE_LIST_PATH, query)}
            backLabel="Back to Recipe Management"
            actions={
              <a
                href={recipeDeleteHref(recipe.slug, query)}
                className="btn btn-compact btn-danger-ghost"
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
    >
      {tooManyIngredients ? (
        <p role="alert" className="banner banner-error" style={{ margin: 0 }}>
          This recipe has {recipe.ingredients.length} ingredients, but this
          form currently supports only {RECIPE_INGREDIENT_ROW_COUNT}. Editing
          is unavailable until the form supports more ingredient rows, so
          none of this recipe&apos;s data is at risk of being dropped.
          General fields remain editable from the General tab.
        </p>
      ) : (
        <div className="admin-editor-surface">
        <form
          action={updateRecipeIngredientsAction}
          className="form-grid form-grid-wide"
        >
          <input type="hidden" name="id" value={recipe.id} />
          <input type="hidden" name="originalSlug" value={recipe.slug} />

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
            submitLabel="Save Ingredients"
            cancelHref={withRecipeSearchQuery(RECIPE_LIST_PATH, query)}
          />
        </form>
        </div>
      )}
    </RecipeWorkspace>
  );
}
