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

type ItemDetailPageProps = {
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

export default async function ItemDetailPage({ params }: ItemDetailPageProps) {
  const { slug } = await params;

  const item = await prisma.item.findUnique({
    where: { slug },
    include: {
      category: true,
      recipesProduced: {
        orderBy: { name: "asc" },
      },
      recipeIngredients: {
        include: { recipe: true },
        orderBy: { recipe: { name: "asc" } },
      },
    },
  });

  if (!item) {
    notFound();
  }

  const details = [
    `Category: ${item.category?.name ?? "Uncategorized"}`,
    `Rarity: ${item.rarity ?? "Unknown"}`,
    `Tradeable: ${item.tradeable ? "Yes" : "No"}`,
  ];

  if (item.baseValue !== null) {
    details.push(`Base value: ${item.baseValue}`);
  }

  return (
    <AppShell>
      <PageHeader
        title={item.name}
        description={item.description ?? "No description available."}
      />

      <section style={{ marginBottom: "24px" }}>
        <ContentImage
          imagePath={item.image}
          alt={`Image of ${item.name}`}
          size="detail"
        />
      </section>

      <ContentGrid>
        <Card title="Details" description={details.join(" · ")} />
      </ContentGrid>

      <section style={{ marginBottom: designTokens.layout.sectionGap }}>
        <SectionHeading>Produced by</SectionHeading>

        {item.recipesProduced.length > 0 ? (
          <ContentGrid>
            {item.recipesProduced.map((recipe) => (
              <Card
                key={recipe.id}
                title={recipe.name}
                description={`Yields ${recipe.resultingQuantity}x ${item.name}.`}
                href={`/recipes/${recipe.slug}`}
              />
            ))}
          </ContentGrid>
        ) : (
          <EmptyState
            title="No recipes produce this item"
            description="No crafting recipe currently results in this item."
          />
        )}
      </section>

      <section>
        <SectionHeading>Used as an ingredient in</SectionHeading>

        {item.recipeIngredients.length > 0 ? (
          <ContentGrid>
            {item.recipeIngredients.map((ingredient) => (
              <Card
                key={ingredient.id}
                title={ingredient.recipe.name}
                description={`Requires ${ingredient.quantity}x ${item.name}.`}
                href={`/recipes/${ingredient.recipe.slug}`}
              />
            ))}
          </ContentGrid>
        ) : (
          <EmptyState
            title="Not used in any recipes"
            description="This item is not currently required by any crafting recipe."
          />
        )}
      </section>
    </AppShell>
  );
}
