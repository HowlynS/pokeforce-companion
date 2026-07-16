import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { ContentImage } from "@/components/content/content-image";
import { Card } from "@/components/ui/card";
import { ContentGrid } from "@/components/ui/content-grid";
import { EmptyState } from "@/components/ui/empty-state";
import { designTokens } from "@/lib/design-tokens";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type RecipeDetailPageProps = {
  params: Promise<{ slug: string }>;
};

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        margin: "0 0 16px",
        fontSize: "24px",
        lineHeight: 1.2,
      }}
    >
      {children}
    </h2>
  );
}

export default async function RecipeDetailPage({ params }: RecipeDetailPageProps) {
  const { slug } = await params;

  const recipe = await prisma.recipe.findUnique({
    where: { slug },
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
  });

  if (!recipe) {
    notFound();
  }

  // The unset-category placeholder is omitted; "Profession: None" stays, as
  // a recipe with no profession requirement is a meaningful fact.
  const resultCategory = recipe.resultingItem.category
    ? ` (${recipe.resultingItem.category.name})`
    : "";

  const recipeDetails = [`Profession: ${recipe.profession?.name ?? "None"}`];

  if (recipe.requiredLevel !== null) {
    recipeDetails.push(`Required level: ${recipe.requiredLevel}`);
  }

  return (
    <AppShell>
      <PageHeader
        title={recipe.name}
        description="Crafting recipe details, including its result and required ingredients."
      />

      <section className="detail-hero">
        <ContentImage
          imagePath={recipe.image}
          alt={`Image of ${recipe.name}`}
          size="detail"
        />

        <div className="detail-hero-facts">
          <Card
            title={`Result: ${recipe.resultingItem.name}`}
            description={`Yields ${recipe.resultingQuantity}x ${recipe.resultingItem.name}${resultCategory}.`}
            href={`/items/${recipe.resultingItem.slug}`}
          />
          <Card title="Recipe Details" description={recipeDetails.join(" · ")} />
        </div>
      </section>

      <section style={{ marginBottom: designTokens.layout.sectionGap }}>
        <SectionHeading>Ingredients</SectionHeading>

        {recipe.ingredients.length > 0 ? (
          <ContentGrid>
            {recipe.ingredients.map((ingredient) => (
              <Card
                key={ingredient.id}
                title={ingredient.item.name}
                description={`${ingredient.quantity}x required.`}
                href={`/items/${ingredient.item.slug}`}
              />
            ))}
          </ContentGrid>
        ) : (
          <EmptyState
            title="No ingredients"
            description="This recipe does not currently require any ingredients."
          />
        )}
      </section>
    </AppShell>
  );
}
