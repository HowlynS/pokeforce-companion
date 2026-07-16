import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { ContentImage } from "@/components/content/content-image";
import { Card } from "@/components/ui/card";
import { ContentGrid } from "@/components/ui/content-grid";
import { EmptyState } from "@/components/ui/empty-state";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type ProfessionDetailPageProps = {
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

export default async function ProfessionDetailPage({ params }: ProfessionDetailPageProps) {
  const { slug } = await params;

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

  return (
    <AppShell>
      <PageHeader
        title={profession.name}
        description={profession.description ?? undefined}
      />

      <section className="detail-hero">
        <ContentImage
          imagePath={profession.image}
          alt={`Image of ${profession.name}`}
          size="detail"
        />

        <div className="detail-hero-facts">
          <Card
            title="Details"
            description={`Recipes: ${profession.recipes.length}`}
          />
        </div>
      </section>

      <section>
        <SectionHeading>Recipes</SectionHeading>

        {profession.recipes.length > 0 ? (
          <ContentGrid>
            {profession.recipes.map((recipe) => (
              <Card
                key={recipe.id}
                title={recipe.name}
                description={`Yields ${recipe.resultingQuantity}x ${recipe.resultingItem.name}.`}
                href={`/recipes/${recipe.slug}`}
              />
            ))}
          </ContentGrid>
        ) : (
          <EmptyState
            title="No recipes yet"
            description="No crafting recipes are currently linked to this profession."
          />
        )}
      </section>
    </AppShell>
  );
}
