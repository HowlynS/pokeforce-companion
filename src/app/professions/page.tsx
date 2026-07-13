import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { ContentImage } from "@/components/content/content-image";
import { Card } from "@/components/ui/card";
import { ContentGrid } from "@/components/ui/content-grid";
import { EmptyState } from "@/components/ui/empty-state";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function buildProfessionDescription(profession: {
  description: string | null;
  recipes: { name: string }[];
}): string {
  const recipeList =
    profession.recipes.length > 0
      ? profession.recipes.map((recipe) => recipe.name).join(", ")
      : "No recipes yet";

  const detailLine = `Recipes (${profession.recipes.length}): ${recipeList}`;

  return profession.description ? `${profession.description} · ${detailLine}` : detailLine;
}

export default async function ProfessionsPage() {
  const professions = await prisma.profession.findMany({
    include: {
      recipes: {
        orderBy: { name: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <AppShell>
      <PageHeader
        title="Professions"
        description="Review professions and the crafting paths connected to them."
      />

      {professions.length > 0 ? (
        <ContentGrid>
          {professions.map((profession) => (
            <Card
              key={profession.id}
              title={profession.name}
              description={buildProfessionDescription(profession)}
              href={`/professions/${profession.slug}`}
              media={
                <ContentImage
                  imagePath={profession.image}
                  alt={`Image of ${profession.name}`}
                  size="card"
                />
              }
            />
          ))}
        </ContentGrid>
      ) : (
        <EmptyState
          title="No professions yet"
          description="Profession data will be added when the project reaches the data model milestone."
        />
      )}
    </AppShell>
  );
}
