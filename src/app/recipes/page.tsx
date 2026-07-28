import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { PublicFilterNav } from "@/components/content/public-filter-nav";
import { RecipeOutputCatalogue } from "@/components/content/recipe-output-catalogue";
import { EmptyState } from "@/components/ui/empty-state";
import {
  cataloguePageHref,
  readCatalogueQueryValue,
} from "@/lib/catalogue-query";
import { prisma } from "@/lib/db";
import {
  RECIPE_OUTPUT_PAGE_SIZE,
  recipeOutputCardSelect,
  resolveRecipeOutputPage,
} from "@/lib/recipes/recipe-output-catalogue";

export const dynamic = "force-dynamic";

type RecipesPageProps = {
  searchParams: Promise<{
    page?: string | string[];
    profession?: string | string[];
    class?: string | string[];
  }>;
};

export default async function RecipesPage({ searchParams }: RecipesPageProps) {
  const { page: rawPage, profession: rawProfession, class: rawClass } =
    await searchParams;
  const professionSlug = readCatalogueQueryValue(rawProfession);

  const professions = await prisma.profession.findMany({
    where: { recipes: { some: {} } },
    select: { id: true, name: true, slug: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });

  const selectedProfession = professionSlug
    ? professions.find((profession) => profession.slug === professionSlug)
    : undefined;

  // Player Class filtering is no longer part of the Recipe domain. Drop
  // stale class parameters and invalid Profession values to the supported
  // canonical catalogue URL.
  if (rawClass !== undefined || (professionSlug && !selectedProfession)) {
    redirect(
      cataloguePageHref("/recipes", 1, {
        profession: selectedProfession?.slug,
      })
    );
  }

  const recipeWhere = selectedProfession
    ? { profession: { slug: selectedProfession.slug } }
    : undefined;
  const recipeCount = await prisma.recipe.count({ where: recipeWhere });
  const { currentPage, pageCount, skip } = resolveRecipeOutputPage(
    rawPage,
    recipeCount
  );
  const recipes =
    recipeCount > 0
      ? await prisma.recipe.findMany({
          where: recipeWhere,
          select: recipeOutputCardSelect,
          orderBy: [{ name: "asc" }, { id: "asc" }],
          skip,
          take: RECIPE_OUTPUT_PAGE_SIZE,
        })
      : [];

  const activeQuery = { profession: selectedProfession?.slug };

  return (
    <AppShell>
      <PageHeader
        title="Recipes"
        description="Explore crafting recipes and the ingredients they require."
      />

      <PublicFilterNav
        label="Filter Recipes by Profession"
        visibleLabel="Profession"
        options={[
          {
            label: "All",
            href: cataloguePageHref("/recipes", 1),
            active: !selectedProfession,
          },
          ...professions.map((profession) => ({
            label: profession.name,
            href: cataloguePageHref("/recipes", 1, {
              profession: profession.slug,
            }),
            active: profession.slug === selectedProfession?.slug,
          })),
        ]}
      />

      {recipeCount > 0 ? (
        <RecipeOutputCatalogue
          recipes={recipes}
          totalRecipeCount={recipeCount}
          basePath="/recipes"
          currentPage={currentPage}
          pageCount={pageCount}
          paginationLabel="Recipes pagination"
          ariaLabel="Recipe catalogue"
          query={activeQuery}
        />
      ) : selectedProfession ? (
        <EmptyState
          title="No recipes match this filter"
          description="Try a different Profession, or browse all recipes."
        />
      ) : (
        <EmptyState
          title="No recipes yet"
          description="Recipe data will be added after the initial data structure is defined."
        />
      )}
    </AppShell>
  );
}
