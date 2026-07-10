import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { ContentGrid } from "@/components/ui/content-grid";
import { EmptyState } from "@/components/ui/empty-state";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function RecipesPage() {
  const recipe = await prisma.recipe.findUnique({
    where: { slug: "reinforced-shield" },
    include: {
      resultingItem: {
        include: { category: true },
      },
      profession: true,
      ingredients: {
        include: { item: true },
      },
    },
  });

  return (
    <AppShell>
      <PageHeader
        title="Recipes"
        description="Explore crafting recipes and the ingredients they require."
      />

      {recipe ? (
        <ContentGrid>
          <Card
            title={recipe.name}
            description={`Crafts ${recipe.resultingItem.name} (${recipe.resultingItem.category?.name ?? "Uncategorized"}) via ${recipe.profession?.name ?? "no profession"}. Requires: ${recipe.ingredients
              .map((ingredient) => `${ingredient.quantity}x ${ingredient.item.name}`)
              .join(", ")}.`}
          />
        </ContentGrid>
      ) : (
        <EmptyState
          title="No recipes yet"
          description="Recipe data will be added after the initial data structure is defined."
        />
      )}
    </AppShell>
  );
}
