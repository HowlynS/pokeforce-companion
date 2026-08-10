import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { DirectoryFilterPopover } from "@/components/content/directory-filter-popover";
import { DirectoryOverviewPanel } from "@/components/content/directory-overview-panel";
import { DirectorySearchField } from "@/components/content/directory-search-field";
import { RecipeOutputCatalogue } from "@/components/content/recipe-output-catalogue";
import { EmptyState } from "@/components/ui/empty-state";
import {
  cataloguePageHref,
  readCatalogueQueryValue,
  readCatalogueQueryValues,
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
    q?: string | string[];
  }>;
};

export default async function RecipesPage({ searchParams }: RecipesPageProps) {
  const {
    page: rawPage,
    profession: rawProfession,
    class: rawClass,
    q: rawQuery,
  } = await searchParams;
  const selectedSlugs = readCatalogueQueryValues(rawProfession);
  const searchQuery = readCatalogueQueryValue(rawQuery);

  const [professions, totalRecipeCount, totalProfessionCount, verifiedRecipeCount] =
    await Promise.all([
      prisma.profession.findMany({
        where: { recipes: { some: {} } },
        select: { id: true, name: true, slug: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
      }),
      prisma.recipe.count(),
      prisma.profession.count({ where: { recipes: { some: {} } } }),
      prisma.recipe.count({ where: { verifiedAt: { not: null } } }),
    ]);

  const validSlugs = selectedSlugs.filter((slug) =>
    professions.some((profession) => profession.slug === slug),
  );

  // Player Class filtering is no longer part of the Recipe domain. Drop
  // stale class parameters and invalid Profession values to the supported
  // canonical catalogue URL.
  if (
    rawClass !== undefined ||
    validSlugs.length !== selectedSlugs.length
  ) {
    redirect(
      cataloguePageHref("/recipes", 1, {
        profession: validSlugs,
        q: searchQuery,
      }),
    );
  }

  const recipeWhere =
    validSlugs.length > 0 || searchQuery
      ? {
          ...(validSlugs.length > 0
            ? { profession: { slug: { in: validSlugs } } }
            : {}),
          ...(searchQuery
            ? { name: { contains: searchQuery, mode: "insensitive" as const } }
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

  const activeQuery = { profession: validSlugs, q: searchQuery };
  const hasActiveFilters = validSlugs.length > 0 || !!searchQuery;

  return (
    <AppShell wide>
      <div className="directory-page">
        <Breadcrumb segments={[{ name: "Home", href: "/" }]} current="Recipes" />
        <h1 className="directory-title">Recipes</h1>

        <div className="directory-body">
          <div className="directory-content">
            <div className="directory-toolbar">
              <div className="directory-toolbar-left">
                <DirectorySearchField
                  basePath="/recipes"
                  placeholder="Find a recipe by name..."
                  defaultValue={searchQuery}
                  preserve={{ profession: validSlugs }}
                />
                <DirectoryFilterPopover
                  label="Professions"
                  paramName="profession"
                  basePath="/recipes"
                  options={professions}
                  selectedSlugs={validSlugs}
                  preserve={{ q: searchQuery }}
                />
              </div>
            </div>

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
            ) : hasActiveFilters ? (
              <div className="directory-empty-state">
                <p className="directory-empty-title">No recipes found</p>
                <p className="directory-empty-body">
                  Try a different search term or reset your filters.
                </p>
                <Link href="/recipes" className="directory-empty-reset">
                  Reset filters
                </Link>
              </div>
            ) : (
              <EmptyState
                title="No recipes yet"
                description="Recipe data will be added after the initial data structure is defined."
              />
            )}
          </div>

          <DirectoryOverviewPanel
            title="Recipes Overview"
            stats={[
              { label: "Total Recipes", value: totalRecipeCount },
              { label: "Professions", value: totalProfessionCount },
              { label: "Verified Entries", value: verifiedRecipeCount },
              { label: "Matching Now", value: recipeCount },
            ]}
          />
        </div>
      </div>
    </AppShell>
  );
}
