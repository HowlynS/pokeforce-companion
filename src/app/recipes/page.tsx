import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { ContentImage } from "@/components/content/content-image";
import { Card } from "@/components/ui/card";
import { ContentGrid } from "@/components/ui/content-grid";
import { EmptyState } from "@/components/ui/empty-state";
import { prisma } from "@/lib/db";
import { formatRecipeProduces } from "@/lib/recipes/recipe-quantity";

export const dynamic = "force-dynamic";

function buildRecipeDescription(recipe: {
  resultingItem: { name: string; category: { name: string } | null };
  resultQuantityMin: number;
  resultQuantityMax: number;
  profession: { name: string } | null;
  requiredLevel: number | null;
  ingredients: { quantity: number; item: { name: string } }[];
}): string {
  // Only meaningful metadata makes it onto the card: unset optional fields
  // are omitted rather than rendered as placeholder values.
  const resultCategory = recipe.resultingItem.category
    ? ` (${recipe.resultingItem.category.name})`
    : "";

  const details = [
    `${formatRecipeProduces(recipe.resultQuantityMin, recipe.resultQuantityMax)} ${recipe.resultingItem.name}${resultCategory}`,
  ];

  if (recipe.profession) {
    details.push(`Profession: ${recipe.profession.name}`);
  }

  if (recipe.requiredLevel !== null) {
    details.push(`Required level: ${recipe.requiredLevel}`);
  }

  if (recipe.ingredients.length > 0) {
    const ingredientList = recipe.ingredients
      .map((ingredient) => `${ingredient.quantity}x ${ingredient.item.name}`)
      .join(", ");

    details.push(`Requires: ${ingredientList}`);
  }

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
              media={
                <ContentImage
                  imagePath={recipe.image}
                  alt={`Image of ${recipe.name}`}
                  size="card"
                />
              }
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
