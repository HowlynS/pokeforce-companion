import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { DirectoryFilterPopover } from "@/components/content/directory-filter-popover";
import { DirectoryOverviewPanel } from "@/components/content/directory-overview-panel";
import { DirectorySearchField } from "@/components/content/directory-search-field";
import { DirectoryViewToggle } from "@/components/content/directory-view-toggle";
import { RecipeOutputCard } from "@/components/content/recipe-output-card";
import {
  LiveMatchCount,
  LiveMatchCountProvider,
} from "@/components/content/live-match-count";
import { LiveResetLink } from "@/components/content/live-filter-reset";
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

  // The Profession filter stays a database filter; the search term does not.
  // Recipes matching the current Profession selection are loaded in full and
  // filtered live in the browser, so `?q=` only seeds the field and the first
  // page index.
  const recipeWhere =
    validSlugs.length > 0
      ? { profession: { slug: { in: validSlugs } } }
      : undefined;
  const recipeCount = await prisma.recipe.count({ where: recipeWhere });
  const { currentPage } = resolveRecipeOutputPage(rawPage, recipeCount);
  const recipes =
    recipeCount > 0
      ? await prisma.recipe.findMany({
          where: recipeWhere,
          select: recipeOutputCardSelect,
          orderBy: [{ name: "asc" }, { id: "asc" }],
        })
      : [];

  const hasActiveFilters = validSlugs.length > 0 || !!searchQuery;

  const entries = recipes.map((recipe, index) => ({
    key: recipe.id,
    text: recipe.name,
    grid: (
      <RecipeOutputCard
        recipe={recipe}
        variant="directory-grid"
        entryDelayMs={index * 30}
        key={recipe.id}
      />
    ),
    list: (
      <RecipeOutputCard
        recipe={recipe}
        variant="directory-list"
        entryDelayMs={index * 30}
        key={recipe.id}
      />
    ),
  }));

  const professionFilter = (
    <DirectoryFilterPopover
      label="Professions"
      paramName="profession"
      basePath="/recipes"
      options={professions}
      selectedSlugs={validSlugs}
      preserve={{ q: searchQuery }}
    />
  );

  const noMatchesState = (
    <div className="directory-empty-state">
      <p className="directory-empty-title">No recipes found</p>
      <p className="directory-empty-body">
        Try a different search term or reset your filters.
      </p>
      <LiveResetLink href="/recipes" className="directory-empty-reset" queryOnly={validSlugs.length === 0}>
        Reset filters
      </LiveResetLink>
    </div>
  );

  return (
    <AppShell catalogue scenic="catalogue" wide>
      <div className="directory-page recipes-directory-page">
        <Breadcrumb segments={[{ name: "Home", href: "/" }]} current="Recipes" />
        <h1 className="directory-title">Recipes</h1>

        <LiveMatchCountProvider>
          <div className="directory-body">
            <div className="directory-content">
              {entries.length > 0 ? (
                <DirectoryViewToggle
                  search={{
                    basePath: "/recipes",
                    placeholder: "Find a recipe by name...",
                    initialQuery: searchQuery ?? "",
                    preserve: { profession: validSlugs },
                  }}
                  toolbarExtra={professionFilter}
                  entries={entries}
                  gridShell={{
                    sectionClassName:
                      "recipe-output-catalogue recipe-output-catalogue--directory-grid",
                    sparseClassName: "recipe-output-catalogue--sparse",
                    sectionAriaLabel: "Recipe catalogue",
                    containerClassName: "recipe-output-grid",
                  }}
                  listShell={{
                    sectionClassName:
                      "recipe-output-catalogue recipe-output-catalogue--directory-list",
                    sparseClassName: "recipe-output-catalogue--sparse",
                    sectionAriaLabel: "Recipe catalogue",
                    containerClassName: "recipe-output-grid",
                    // Every child is keyed: this element is created on the
                    // server and rendered by a client component, and React
                    // re-validates such children after they cross the RSC
                    // boundary — an unkeyed static list warns there even
                    // though it never would in one render pass.
                    header: (
                      <div className="recipe-output-list-heading">
                        <span
                          className="recipe-output-list-identity-heading"
                          key="identity"
                        >
                          <span key="spacer" />
                          <span key="recipe">Recipe</span>
                        </span>
                        <span key="profession">Profession</span>
                        <span className="recipe-output-list-exp-heading" key="exp">
                          EXP
                        </span>
                        <span key="ingredients">Ingredients</span>
                      </div>
                    ),
                  }}
                  pageSize={RECIPE_OUTPUT_PAGE_SIZE}
                  initialPage={currentPage}
                  paginationLabel="Recipes pagination"
                  emptyState={noMatchesState}
                />
              ) : (
                <>
                  <div className="directory-toolbar">
                    <div className="directory-toolbar-left">
                      <DirectorySearchField
                        basePath="/recipes"
                        placeholder="Find a recipe by name..."
                        defaultValue={searchQuery}
                        preserve={{ profession: validSlugs }}
                      />
                      {hasActiveFilters ? professionFilter : null}
                    </div>
                  </div>
                  {hasActiveFilters ? (
                    noMatchesState
                  ) : (
                    <EmptyState
                      title="No recipes yet"
                      description="Recipe data will be added after the initial data structure is defined."
                    />
                  )}
                </>
              )}
            </div>

            <DirectoryOverviewPanel
              title="Recipes Overview"
              icon="recipes"
              stats={[
                { label: "Total Recipes", value: totalRecipeCount },
                { label: "Professions", value: totalProfessionCount },
                { label: "Verified Entries", value: verifiedRecipeCount },
                {
                  label: "Matching Now",
                  value: <LiveMatchCount fallback={recipeCount} />,
                },
              ]}
            />
          </div>
        </LiveMatchCountProvider>
      </div>
    </AppShell>
  );
}
