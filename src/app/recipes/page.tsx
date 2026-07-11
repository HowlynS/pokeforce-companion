import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { ContentGrid } from "@/components/ui/content-grid";
import { EmptyState } from "@/components/ui/empty-state";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function buildRecipeDescription(recipe: {
  resultingItem: { name: string; category: { name: string } | null };
  resultingQuantity: number;
  profession: { name: string } | null;
  requiredLevel: number | null;
  ingredients: { quantity: number; item: { name: string } }[];
}): string {
  const ingredientList = recipe.ingredients
    .map((ingredient) => `${ingredient.quantity}x ${ingredient.item.name}`)
    .join(", ");

  const details = [
    `Crafts ${recipe.resultingQuantity}x ${recipe.resultingItem.name} (${recipe.resultingItem.category?.name ?? "Uncategorized"})`,
    `Profession: ${recipe.profession?.name ?? "None"}`,
  ];

  if (recipe.requiredLevel !== null) {
    details.push(`Required level: ${recipe.requiredLevel}`);
  }

  details.push(`Requires: ${ingredientList || "No ingredients"}`);

  return details.join(" · ");
}

export default async function RecipesPage() {
  const recipes = await prisma.recipe.findMany({
    include: {
      resultingItem: {
        include: { category: true },
      },
      profession: true,
      ingredients: {
        include: { item: true },
        orderBy: { item: { name: "asc" } },
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <AppShell>
      <PageHeader
        title="Recipes"
        description="Explore crafting recipes and the ingredients they require."
      />

      {recipes.length > 0 ? (
        <ContentGrid>
          {recipes.map((recipe) => (
            <Card
              key={recipe.id}
              title={recipe.name}
              description={buildRecipeDescription(recipe)}
              href={`/recipes/${recipe.slug}`}
            />
          ))}
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
