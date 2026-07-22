import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { ContentImage } from "@/components/content/content-image";
import { Card } from "@/components/ui/card";
import { ContentGrid } from "@/components/ui/content-grid";
import { prisma } from "@/lib/db";
import { formatRecipeProduces } from "@/lib/recipes/recipe-quantity";

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

      {/* Omitted entirely (heading included) when the profession has no
          recipes — public detail pages never render empty optional sections.
          The Details card above still states "Recipes: 0". */}
      {profession.recipes.length > 0 ? (
        <section>
          <SectionHeading>Recipes</SectionHeading>

          <ContentGrid>
            {profession.recipes.map((recipe) => (
              <Card
                key={recipe.id}
                title={recipe.name}
                description={`${formatRecipeProduces(recipe.resultQuantityMin, recipe.resultQuantityMax)} ${recipe.resultingItem.name}.`}
                href={`/recipes/${recipe.slug}`}
              />
            ))}
          </ContentGrid>
        </section>
      ) : null}
    </AppShell>
  );
}
