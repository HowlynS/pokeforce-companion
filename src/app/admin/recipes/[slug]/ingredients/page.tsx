import { notFound } from "next/navigation";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { EditorHeader } from "@/components/admin/editor-header";
import { EditorTabs } from "@/components/admin/editor-tabs";
import { EditorSection } from "@/components/admin/editor-section";
import { AdminFormGuard } from "@/components/admin/admin-form-guard";
import { RecipeIngredientEditor } from "@/components/admin/recipe-ingredient-editor";
import { RecipeWorkspace } from "@/components/admin/recipe-workspace";
import {
  RECIPE_LIST_PATH,
  normalizeRecipeSearchQuery,
  recipeEditorTabs,
  recipeIngredientsHref,
  withRecipeSearchQuery,
} from "@/lib/admin/recipe-workspace";
import { prisma } from "@/lib/db";
import { toEntitySelectOptions } from "@/lib/admin/entity-select-options";
import { SECTION_ICONS } from "@/lib/admin/section-icons";
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
  too_many_ingredients:
    "A Recipe cannot contain more than 50 ingredients.",
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

  const itemOptions = await toEntitySelectOptions(items);

  const tabs = recipeEditorTabs(recipe.slug, query, "ingredients", {
    ingredients: recipe.ingredients.length,
  });

  // The Ingredients tab (Slice 9C.3): the recipe's ingredient rows,
  // edited independently of its other fields via updateRecipeIngredientsAction
  // (touches only the RecipeIngredient table — name, slug, resulting
  // item, profession, required level, image, and verification are never
  // read or written here). No ImagePanel/VerificationPanel/
  // TimestampsPanel — this tab has nothing to do with any of them. Danger
  // Zone was removed from this relationship tab (Visual Pass II Section
  // 7: General tab only) — Delete stays reachable via the General tab's
  // own unconditional DangerZonePanel, which the ingredient-count guard
  // below never affects (that guard only hides THIS tab's own form).
  return (
    <RecipeWorkspace
      // Admin Polish Pass 2, Part 5: forces a full remount whenever this
      // recipe's own updatedAt changes — updateRecipeIngredientsAction
      // deliberately bumps it (see that action's own comment) precisely
      // so this tab can use the same remount-key mechanism every other
      // editor tab uses, with no bespoke nonce needed.
      key={recipe.updatedAt.toISOString()}
      rawQuery={q}
      selectedSlug={recipe.slug}
      recordHref={recipeIngredientsHref}
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
    >
      <div className="admin-editor-surface">
        <form
          action={updateRecipeIngredientsAction}
          className="form-grid form-grid-wide form-grid-responsive"
        >
          <input type="hidden" name="id" value={recipe.id} />
          <input type="hidden" name="originalSlug" value={recipe.slug} />

          <EditorSection title="Ingredients" icon={SECTION_ICONS.ingredients}>
            <fieldset className="form-fieldset">
              <legend>Ingredients (fill at least one row)</legend>

              <RecipeIngredientEditor
                options={itemOptions}
                initialIngredients={recipe.ingredients}
                draftKey={`recipe:edit:${recipe.id}:recipe-ingredients-form`}
                serverError={error}
              />
            </fieldset>
          </EditorSection>

          {/* Sonnet Rollout Pass: guarded actions row, isolated from the
              General tab's own draft by a distinct form identity
              ("recipe-ingredients-form" vs "recipe-edit-form") — the same
              record's two tabs never share a draft. No image or
              verification control exists on this tab, so no field needs
              excluding beyond the record id/slug. */}
          <AdminFormGuard
            submitLabel="Save Ingredients"
            cancelHref={withRecipeSearchQuery(RECIPE_LIST_PATH, query)}
            excludeFields={["id", "originalSlug"]}
            draftKey={`recipe:edit:${recipe.id}:recipe-ingredients-form`}
            serverUpdatedAt={recipe.updatedAt.toISOString()}
          />
        </form>
      </div>
    </RecipeWorkspace>
  );
}
