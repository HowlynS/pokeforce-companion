import { notFound } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { EditorHeader } from "@/components/admin/editor-header";
import { EditorTabs } from "@/components/admin/editor-tabs";
import { EditorSection } from "@/components/admin/editor-section";
import { PlayerClassWorkspace } from "@/components/admin/player-class-workspace";
import {
  normalizePlayerClassSearchQuery,
  playerClassEditorTabs,
  playerClassRecipesHref,
} from "@/lib/admin/player-class-workspace";
import { prisma } from "@/lib/db";
import { getImagePublicUrl } from "@/lib/storage/images";
import { formatRecipeQuantityRange } from "@/lib/recipes/recipe-quantity";
import { resolveRecipeDisplayImage } from "@/lib/recipes/recipe-image";
import { ResourceIcon } from "@/components/admin/resource-icon";
import { SECTION_ICONS } from "@/lib/admin/section-icons";

export const dynamic = "force-dynamic";

type PlayerClassRecipesPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
};

/**
 * The Recipe name cell: the link to the existing Recipe admin edit route,
 * plus optional Profession/Required level detail lines beneath it —
 * neither is already known from this tab's own context (unlike Profession's
 * own Recipes tab, where Profession itself is the page and so is never
 * repeated), so both are shown here exactly like the Item Used in Recipes
 * tab's own RecipeNameCell. Each piece is omitted entirely when absent,
 * never a placeholder dash or an empty metadata cell of its own.
 */
async function RecipeNameCell({
  slug,
  name,
  image,
  resultingItemImage,
  professionName,
  requiredLevel,
}: {
  slug: string;
  name: string;
  image: string | null;
  /** The recipe's resulting item's own image — the display fallback when
      this recipe has no custom image of its own, never a database write. */
  resultingItemImage: string | null;
  professionName: string | null | undefined;
  requiredLevel: number | null;
}) {
  const hasDetails = Boolean(professionName) || requiredLevel != null;
  const imageUrl = await getImagePublicUrl(
    resolveRecipeDisplayImage({
      recipeImage: image,
      resultingItemImage,
    })
  );

  return (
    <td>
      <a
        href={`/admin/recipes/${slug}/edit`}
        className="link-accent admin-table-link-with-icon"
      >
        <ResourceIcon imageUrl={imageUrl} size="md" />
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

export default async function PlayerClassRecipesPage({
  params,
  searchParams,
}: PlayerClassRecipesPageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { slug } = await params;
  const { q } = await searchParams;
  const query = normalizePlayerClassSearchQuery(q);

  // One restrained query: the Class's required Recipes, each with the
  // resulting Item and Profession fields the row needs already included —
  // no per-row follow-up query. Ordered alphabetically by name, matching
  // every other relationship tab's own convention.
  const playerClass = await prisma.playerClass.findUnique({
    where: { slug },
    include: {
      recipes: {
        include: { resultingItem: true, profession: true },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!playerClass) {
    notFound();
  }

  const tabs = playerClassEditorTabs(playerClass.slug, query, "recipes", {
    recipes: playerClass.recipes.length,
  });
  const hasRecipes = playerClass.recipes.length > 0;

  // The Recipes tab: read-only, navigational content inside the Player
  // Class workspace — no inline recipe editing, no unlink control, no
  // create-recipe form. Every row links to the EXISTING Recipe admin edit
  // route.
  return (
    <PlayerClassWorkspace
      rawQuery={q}
      selectedSlug={playerClass.slug}
      recordHref={playerClassRecipesHref}
      editorHeader={
        <>
          <EditorHeader
            eyebrow="Class"
            title={playerClass.name}
            subtitle={playerClass.slug}
          />

          <EditorTabs label="Class editor sections" tabs={tabs} />
        </>
      }
    >
      {!hasRecipes ? (
        <EmptyState
          title="No recipes require this class yet"
          description="Recipes requiring this class will appear here."
        />
      ) : (
        <EditorSection
          title="Recipes"
          icon={SECTION_ICONS.recipes}
          description={`${playerClass.recipes.length} ${
            playerClass.recipes.length === 1 ? "recipe" : "recipes"
          }`}
        >
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  {["Recipe", "Resulting Item", "Quantity", "EXP reward"].map(
                    (heading) => (
                      <th key={heading}>{heading}</th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {playerClass.recipes.map((recipe) => (
                  <tr key={recipe.id}>
                    <RecipeNameCell
                      slug={recipe.slug}
                      name={recipe.name}
                      image={recipe.image}
                      resultingItemImage={recipe.resultingItem.image}
                      professionName={recipe.profession?.name}
                      requiredLevel={recipe.requiredLevel}
                    />
                    <td>{recipe.resultingItem.name}</td>
                    <td>
                      {formatRecipeQuantityRange(
                        recipe.resultQuantityMin,
                        recipe.resultQuantityMax
                      )}
                    </td>
                    <td>{recipe.experienceReward} EXP</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </EditorSection>
      )}
    </PlayerClassWorkspace>
  );
}
