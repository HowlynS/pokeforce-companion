import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { ContentImage } from "@/components/content/content-image";
import { Card } from "@/components/ui/card";
import { ContentGrid } from "@/components/ui/content-grid";
import { EmptyState } from "@/components/ui/empty-state";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Restrained select (never the full recipes relation, just its count) —
// the same pattern the Category/Item public catalogues already use, not
// the older Professions index's own over-fetching precedent.
function buildPlayerClassDescription(playerClass: {
  description: string | null;
  recipeCount: number;
}): string {
  const recipeCountText = `${playerClass.recipeCount} ${
    playerClass.recipeCount === 1 ? "recipe" : "recipes"
  }`;

  return playerClass.description
    ? `${playerClass.description} · ${recipeCountText}`
    : recipeCountText;
}

export default async function PlayerClassesPage() {
  const playerClasses = await prisma.playerClass.findMany({
    select: {
      name: true,
      slug: true,
      description: true,
      image: true,
      _count: { select: { recipes: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <AppShell>
      <PageHeader
        title="Classes"
        description="Player classes and the recipes that require them."
      />

      {playerClasses.length > 0 ? (
        <ContentGrid>
          {playerClasses.map((playerClass) => (
            <Card
              key={playerClass.slug}
              title={playerClass.name}
              description={buildPlayerClassDescription({
                description: playerClass.description,
                recipeCount: playerClass._count.recipes,
              })}
              href={`/classes/${playerClass.slug}`}
              media={
                <ContentImage
                  imagePath={playerClass.image}
                  alt={`Image of ${playerClass.name}`}
                  size="card"
                />
              }
            />
          ))}
        </ContentGrid>
      ) : (
        <EmptyState
          title="No classes yet"
          description="Class data will be added when the project reaches this milestone."
        />
      )}
    </AppShell>
  );
}
