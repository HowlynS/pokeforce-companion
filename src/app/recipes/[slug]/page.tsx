import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { ContentImage } from "@/components/content/content-image";
import { Card } from "@/components/ui/card";
import { ContentGrid } from "@/components/ui/content-grid";
import { SectionHeading } from "@/components/ui/section-heading";
import { designTokens } from "@/lib/design-tokens";
import { prisma } from "@/lib/db";
import { formatRecipeProduces } from "@/lib/recipes/recipe-quantity";
import { SECTION_ICONS } from "@/lib/admin/section-icons";

export const dynamic = "force-dynamic";

type RecipeDetailPageProps = {
  params: Promise<{ slug: string }>;
};

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
            description={`${formatRecipeProduces(recipe.resultQuantityMin, recipe.resultQuantityMax)} ${recipe.resultingItem.name}${resultCategory}.`}
            href={`/items/${recipe.resultingItem.slug}`}
          />
          <Card title="Recipe Details" description={recipeDetails.join(" · ")} />
        </div>
      </section>

      {/* Omitted entirely (heading included) when the recipe has no
          ingredients — public detail pages never render empty optional
          sections. Validation requires at least one ingredient, so this
          only guards data reached outside the admin UI. */}
      {recipe.ingredients.length > 0 ? (
        <section style={{ marginBottom: designTokens.layout.sectionGap }}>
          <SectionHeading icon={SECTION_ICONS.ingredients}>Ingredients</SectionHeading>

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
        </section>
      ) : null}
    </AppShell>
  );
}
