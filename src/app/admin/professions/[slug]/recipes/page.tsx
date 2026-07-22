import { notFound } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { EditorHeader } from "@/components/admin/editor-header";
import { EditorTabs } from "@/components/admin/editor-tabs";
import { ContextPanel } from "@/components/admin/context-panel";
import { ProfessionWorkspace } from "@/components/admin/profession-workspace";
import {
  normalizeProfessionSearchQuery,
  professionEditorTabs,
  professionRecipesHref,
} from "@/lib/admin/profession-workspace";
import { prisma } from "@/lib/db";
import { formatRecipeQuantityRange } from "@/lib/recipes/recipe-quantity";

export const dynamic = "force-dynamic";

type ProfessionRecipesPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
};

/**
 * The Recipe name cell: the link to the existing Recipe admin edit route,
 * plus an optional Required level detail line beneath it. The current
 * Profession is already the page context, so — unlike the Item Used in
 * Recipes tab's equivalent cell — no Profession name is ever repeated
 * here. Required level is optional on a Recipe, so the detail line is
 * omitted entirely when absent, never a placeholder dash or an empty cell
 * of its own.
 */
function RecipeNameCell({
  slug,
  name,
  requiredLevel,
}: {
  slug: string;
  name: string;
  requiredLevel: number | null;
}) {
  return (
    <td>
      <a href={`/admin/recipes/${slug}/edit`} className="link-accent">
        {name}
      </a>
      {requiredLevel != null ? (
        <div className="admin-table-meta">
          <div>Required level: {requiredLevel}</div>
        </div>
      ) : null}
    </td>
  );
}

export default async function ProfessionRecipesPage({
  params,
  searchParams,
}: ProfessionRecipesPageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { slug } = await params;
  const { q } = await searchParams;
  const query = normalizeProfessionSearchQuery(q);

  // One restrained query: the Profession's linked Recipes, each with the
  // resulting Item fields the row needs already included — no per-row
  // follow-up query. Ordered alphabetically by name, matching the Item
  // Used in Recipes tab's own ordering.
  const profession = await prisma.profession.findUnique({
    where: { slug },
    include: {
      recipes: {
        include: { resultingItem: true },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!profession) {
    notFound();
  }

  const tabs = professionEditorTabs(profession.slug, query, "recipes", {
    recipes: profession.recipes.length,
  });
  const hasRecipes = profession.recipes.length > 0;

  // The Recipes tab (Slice 9D.3): read-only, navigational content inside
  // the Profession workspace — no inline recipe editing, no unlink
  // control, no create-recipe form. Every row links to the EXISTING
  // Recipe admin edit route.
  return (
    <ProfessionWorkspace
      rawQuery={q}
      selectedSlug={profession.slug}
      recordHref={professionRecipesHref}
      editorHeader={
        <>
          <EditorHeader
            eyebrow="Profession"
            title={profession.name}
            subtitle={profession.slug}
          />

          <EditorTabs label="Profession editor sections" tabs={tabs} />
        </>
      }
    >
      {!hasRecipes ? (
        <EmptyState
          title="No recipes use this profession yet"
          description="Recipes linked to this profession will appear here."
        />
      ) : (
        <ContextPanel
          title="Recipes"
          description={`${profession.recipes.length} ${
            profession.recipes.length === 1 ? "recipe" : "recipes"
          }`}
        >
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  {["Recipe", "Resulting Item", "Quantity"].map((heading) => (
                    <th key={heading}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {profession.recipes.map((recipe) => (
                  <tr key={recipe.id}>
                    <RecipeNameCell
                      slug={recipe.slug}
                      name={recipe.name}
                      requiredLevel={recipe.requiredLevel}
                    />
                    <td>{recipe.resultingItem.name}</td>
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
      )}
    </ProfessionWorkspace>
  );
}
