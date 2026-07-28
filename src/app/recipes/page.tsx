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
  const playerClassSlug = readCatalogueQueryValue(rawClass);

  const [professions, playerClasses] = await Promise.all([
    prisma.profession.findMany({
      where: { recipes: { some: {} } },
      select: { id: true, name: true, slug: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
    prisma.playerClass.findMany({
      where: { recipes: { some: {} } },
      select: { id: true, name: true, slug: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
  ]);

  const selectedProfession = professionSlug
    ? professions.find((profession) => profession.slug === professionSlug)
    : undefined;
  const selectedPlayerClass = playerClassSlug
    ? playerClasses.find((playerClass) => playerClass.slug === playerClassSlug)
    : undefined;

  // Canonicalize safely: drop only the filter(s) that don't resolve to a
  // real, non-empty option, preserving whichever filter is still valid —
  // never redirecting away from a filter the visitor got right.
  if (
    (professionSlug && !selectedProfession) ||
    (playerClassSlug && !selectedPlayerClass)
  ) {
    redirect(
      cataloguePageHref("/recipes", 1, {
        profession: selectedProfession?.slug,
        class: selectedPlayerClass?.slug,
      })
    );
  }

  const recipeWhere =
    selectedProfession || selectedPlayerClass
      ? {
          ...(selectedProfession
            ? { profession: { slug: selectedProfession.slug } }
            : {}),
          ...(selectedPlayerClass
            ? { playerClass: { slug: selectedPlayerClass.slug } }
            : {}),
        }
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

  const activeQuery = {
    profession: selectedProfession?.slug,
    class: selectedPlayerClass?.slug,
  };

  return (
    <AppShell>
      <PageHeader
        title="Recipes"
        description="Explore crafting recipes and the ingredients they require."
      />

      <PublicFilterNav
        label="Filter Recipes by Profession"
        options={[
          {
            label: "All",
            href: cataloguePageHref("/recipes", 1, {
              class: selectedPlayerClass?.slug,
            }),
            active: !selectedProfession,
          },
          ...professions.map((profession) => ({
            label: profession.name,
            href: cataloguePageHref("/recipes", 1, {
              profession: profession.slug,
              class: selectedPlayerClass?.slug,
            }),
            active: profession.slug === selectedProfession?.slug,
          })),
        ]}
      />

      <PublicFilterNav
        label="Filter Recipes by Class"
        options={[
          {
            label: "All",
            href: cataloguePageHref("/recipes", 1, {
              profession: selectedProfession?.slug,
            }),
            active: !selectedPlayerClass,
          },
          ...playerClasses.map((playerClass) => ({
            label: playerClass.name,
            href: cataloguePageHref("/recipes", 1, {
              profession: selectedProfession?.slug,
              class: playerClass.slug,
            }),
            active: playerClass.slug === selectedPlayerClass?.slug,
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
      ) : selectedProfession || selectedPlayerClass ? (
        <EmptyState
          title="No recipes match this filter"
          description="Try a different Profession or Class, or browse all recipes."
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
