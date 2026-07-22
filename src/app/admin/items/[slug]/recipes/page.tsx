import { notFound } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { EditorHeader } from "@/components/admin/editor-header";
import { EditorTabs } from "@/components/admin/editor-tabs";
import { ContextPanel } from "@/components/admin/context-panel";
import { ItemWorkspace } from "@/components/admin/item-workspace";
import {
  itemEditorTabs,
  itemUsedInRecipesHref,
  normalizeItemSearchQuery,
} from "@/lib/admin/item-workspace";
import { prisma } from "@/lib/db";
import { formatRecipeQuantityRange } from "@/lib/recipes/recipe-quantity";

export const dynamic = "force-dynamic";

type ItemRecipesPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
};

/**
 * The Recipe name cell shared by both relationship tables: the link to
 * the existing Recipe admin edit route, plus an optional Profession/
 * Required level detail line beneath it. Profession and Required level
 * are both optional on a Recipe, so the detail line — and each piece of
 * it — is omitted entirely when absent, never a placeholder dash or an
 * empty metadata cell of its own.
 */
function RecipeNameCell({
  slug,
  name,
  professionName,
  requiredLevel,
}: {
  slug: string;
  name: string;
  professionName: string | null | undefined;
  requiredLevel: number | null;
}) {
  const hasDetails = Boolean(professionName) || requiredLevel != null;

  return (
    <td>
      <a href={`/admin/recipes/${slug}/edit`} className="link-accent">
        {name}
      </a>
      {hasDetails ? (
        <div className="admin-table-meta">
          {professionName ? <div>Profession: {professionName}</div> : null}
          {requiredLevel != null ? (
            <div>Required level: {requiredLevel}</div>
          ) : null}
        </div>
      ) : null}
    </td>
  );
}

export default async function ItemRecipesPage({
  params,
  searchParams,
}: ItemRecipesPageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { slug } = await params;
  const { q } = await searchParams;
  const query = normalizeItemSearchQuery(q);

  // One restrained query: both relationship directions (this item AS a
  // recipe's result, and this item AS an ingredient of other recipes)
  // load together with the fields their rows need, so rendering never
  // issues a query per row.
  const item = await prisma.item.findUnique({
    where: { slug },
    include: {
      recipesProduced: {
        include: { profession: true },
        orderBy: { name: "asc" },
      },
      recipeIngredients: {
        include: {
          recipe: { include: { profession: true, resultingItem: true } },
        },
        orderBy: { recipe: { name: "asc" } },
      },
    },
  });

  if (!item) {
    notFound();
  }

  const tabs = itemEditorTabs(item.slug, query, "recipes");
  const hasIngredientUsage = item.recipeIngredients.length > 0;
  const hasProducedBy = item.recipesProduced.length > 0;

  // The Used in Recipes tab (Slice 9B.7): read-only, navigational content
  // inside the Item workspace — no inline recipe editing, no ingredient
  // mutation, no create-recipe form. Every row links to the EXISTING
  // Recipe admin edit route; the two relationship directions ("used as
  // an ingredient in" vs "produced by") are never conflated, matching the
  // same distinction the public item detail page already draws.
  return (
    <ItemWorkspace
      rawQuery={q}
      selectedSlug={item.slug}
      recordHref={itemUsedInRecipesHref}
      editorHeader={
        <>
          <EditorHeader eyebrow="Item" title={item.name} subtitle={item.slug} />

          <EditorTabs label="Item editor sections" tabs={tabs} />
        </>
      }
    >
      {!hasIngredientUsage && !hasProducedBy ? (
        <EmptyState
          title="Not used in any recipes yet"
          description="This item does not appear in any recipe, as an ingredient or as a result."
        />
      ) : (
        <>
          {hasIngredientUsage ? (
            <ContextPanel
              title="Used as an ingredient in"
              description={`${item.recipeIngredients.length} ${
                item.recipeIngredients.length === 1 ? "recipe" : "recipes"
              }`}
            >
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      {["Recipe", "Quantity", "Resulting Item"].map(
                        (heading) => (
                          <th key={heading}>{heading}</th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {item.recipeIngredients.map((ingredient) => (
                      <tr key={ingredient.id}>
                        <RecipeNameCell
                          slug={ingredient.recipe.slug}
                          name={ingredient.recipe.name}
                          professionName={ingredient.recipe.profession?.name}
                          requiredLevel={ingredient.recipe.requiredLevel}
                        />
                        <td>{ingredient.quantity}</td>
                        <td>{ingredient.recipe.resultingItem.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ContextPanel>
          ) : null}

          {hasProducedBy ? (
            <ContextPanel
              title="Produced by"
              description={`${item.recipesProduced.length} ${
                item.recipesProduced.length === 1 ? "recipe" : "recipes"
              }`}
            >
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      {["Recipe", "Yields"].map((heading) => (
                        <th key={heading}>{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {item.recipesProduced.map((recipe) => (
                      <tr key={recipe.id}>
                        <RecipeNameCell
                          slug={recipe.slug}
                          name={recipe.name}
                          professionName={recipe.profession?.name}
                          requiredLevel={recipe.requiredLevel}
                        />
                        <td>
                          {formatRecipeQuantityRange(
                            recipe.resultQuantityMin,
                            recipe.resultQuantityMax
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ContextPanel>
          ) : null}
        </>
      )}
    </ItemWorkspace>
  );
}
