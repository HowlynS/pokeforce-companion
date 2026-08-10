import { CataloguePagination } from "@/components/content/catalogue-pagination";
import { RecipeOutputCard } from "@/components/content/recipe-output-card";
import type { RecipeOutputCardValue } from "@/lib/recipes/recipe-output-catalogue";

type RecipeOutputCatalogueProps = {
  recipes: RecipeOutputCardValue[];
  totalRecipeCount: number;
  basePath: string;
  currentPage: number;
  pageCount: number;
  paginationLabel: string;
  heading?: string;
  headingId?: string;
  eyebrow?: string;
  className?: string;
  ariaLabel?: string;
  query?: Record<string, string | string[] | undefined>;
  directoryLayout?: "grid" | "list";
};

export function RecipeOutputCatalogue({
  recipes,
  totalRecipeCount,
  basePath,
  currentPage,
  pageCount,
  paginationLabel,
  heading,
  headingId,
  eyebrow,
  className,
  ariaLabel,
  query,
  directoryLayout,
}: RecipeOutputCatalogueProps) {
  const catalogueClassName = [
    "recipe-output-catalogue",
    totalRecipeCount === 1 ? "recipe-output-catalogue--sparse" : "",
    directoryLayout ? `recipe-output-catalogue--directory-${directoryLayout}` : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section
      className={catalogueClassName}
      aria-labelledby={heading ? headingId : undefined}
      aria-label={heading ? undefined : ariaLabel}
    >
      {heading ? (
        <header className="recipe-output-catalogue-header">
          {eyebrow ? <p>{eyebrow}</p> : null}
          <h2 id={headingId}>{heading}</h2>
        </header>
      ) : null}

      <div className="recipe-output-grid">
        {recipes.map((recipe) => (
          <RecipeOutputCard
            recipe={recipe}
            variant={directoryLayout ? `directory-${directoryLayout}` : "standard"}
            key={recipe.id}
          />
        ))}
      </div>

      <CataloguePagination
        basePath={basePath}
        currentPage={currentPage}
        pageCount={pageCount}
        label={paginationLabel}
        query={query}
      />
    </section>
  );
}
