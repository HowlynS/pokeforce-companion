import Link from "next/link";
import { ContentImage } from "@/components/content/content-image";
import { RecipeOutputIngredientDisclosure } from "@/components/content/recipe-output-ingredient-disclosure";
import { formatRecipeQuantityRange } from "@/lib/recipes/recipe-quantity";
import type { RecipeOutputCardValue } from "@/lib/recipes/recipe-output-catalogue";

type RecipeOutputCardProps = {
  recipe: RecipeOutputCardValue;
  variant?:
    | "standard"
    | "directory-grid"
    | "directory-list"
    | "profession-grid"
    | "profession-list";
};

const INGREDIENT_PREVIEW_COUNT = 4;

/**
 * Compact collection card for pages whose information shape is genuinely
 * Recipe + crafted result + ingredients. Detail-page relationship patterns
 * intentionally remain separate.
 */
export function RecipeOutputCard({
  recipe,
  variant = "standard",
}: RecipeOutputCardProps) {
  const quantity = formatRecipeQuantityRange(
    recipe.resultQuantityMin,
    recipe.resultQuantityMax
  );
  const ingredientListId = `recipe-${recipe.id}-ingredients`;
  const isProfessionVariant = variant.startsWith("profession-");
  const previewCount =
    variant === "profession-list"
      ? recipe.ingredients.length
      : variant === "directory-grid" || variant === "profession-grid"
      ? 3
      : INGREDIENT_PREVIEW_COUNT;
  const previewIngredients = recipe.ingredients.slice(
    0,
    previewCount
  );
  const remainingIngredients = recipe.ingredients.slice(
    previewCount
  );
  const recipeLinkLabel = `${recipe.name}, produces ×${quantity} ${
    recipe.resultingItem.name
  }${
    recipe.resultingItem.category
      ? `, category ${recipe.resultingItem.category.name}`
      : ""
  }${
    recipe.profession && recipe.requiredLevel !== null
      ? `, ${recipe.profession.name} level ${recipe.requiredLevel}`
      : ""
  }`;
  const renderIngredients = (
    ingredients: RecipeOutputCardValue["ingredients"]
  ) =>
    ingredients.map((ingredient) => {
      const tooltipId = `ingredient-${ingredient.id}`;

      return (
        <Link
          className="recipe-output-ingredient"
          href={`/items/${ingredient.item.slug}`}
          aria-label={`${ingredient.item.name}, required quantity ×${ingredient.quantity}`}
          aria-describedby={tooltipId}
          key={ingredient.id}
        >
          <span className="recipe-output-ingredient-image">
            <ContentImage
              imagePath={ingredient.item.image}
              alt=""
              size="row"
            />
          </span>
          <strong aria-hidden="true">×{ingredient.quantity}</strong>
          <span
            className="recipe-output-tooltip"
            id={tooltipId}
            role="tooltip"
          >
            <span className="recipe-output-tooltip-image">
              <ContentImage
                imagePath={ingredient.item.image}
                alt=""
                size="row"
              />
            </span>
            <span>{ingredient.item.name}</span>
          </span>
        </Link>
      );
    });

  if (isProfessionVariant) {
    return (
      <article className={`recipe-output-card recipe-output-card--${variant}`}>
        <div className="recipe-output-identity">
          <Link
            className="recipe-output-result-link"
            href={`/items/${recipe.resultingItem.slug}`}
            aria-label={`View resulting Item: ${recipe.resultingItem.name}`}
          >
            <span className="recipe-output-image-stage">
              <ContentImage
                imagePath={recipe.resultingItem.image}
                alt={`Image of ${recipe.resultingItem.name}`}
                size="card"
              />
              <span className="recipe-output-yield" aria-hidden="true">
                {variant === "profession-grid" ? <span>Yields</span> : null}
                <strong>
                  {variant === "profession-grid" ? quantity : `Ã—${quantity}`}
                </strong>
              </span>
            </span>
          </Link>

          <span className="recipe-output-copy">
            <Link
              className="recipe-output-recipe-link"
              href={`/recipes/${recipe.slug}`}
              aria-label={recipeLinkLabel}
              title={recipe.name}
            >
              {recipe.name}
            </Link>
            {recipe.profession ? (
              <span className="recipe-output-requirement">
                <span>{recipe.profession.name}</span>
                {recipe.requiredLevel !== null ? (
                  <span>Lvl {recipe.requiredLevel}</span>
                ) : null}
              </span>
            ) : null}
          </span>
        </div>

        {recipe.ingredients.length > 0 ? (
          <section
            className="recipe-output-ingredients"
            aria-label={`Ingredients for ${recipe.name}`}
          >
            {remainingIngredients.length > 0 ? (
              <RecipeOutputIngredientDisclosure
                listId={ingredientListId}
                recipeName={recipe.name}
                previewIngredients={renderIngredients(previewIngredients)}
                remainingIngredients={renderIngredients(remainingIngredients)}
                remainingCount={remainingIngredients.length}
                compact={variant === "profession-grid"}
                popover={variant === "profession-grid"}
              />
            ) : (
              <div className="recipe-output-ingredient-list" id={ingredientListId}>
                {renderIngredients(previewIngredients)}
              </div>
            )}
          </section>
        ) : null}

        {variant === "profession-list" ? (
          <span className="recipe-output-experience">
            +{recipe.experienceReward} EXP
          </span>
        ) : null}
      </article>
    );
  }

  return (
    <article className={`recipe-output-card recipe-output-card--${variant}`}>
      <Link
        className="recipe-output-identity"
        href={`/recipes/${recipe.slug}`}
        aria-label={recipeLinkLabel}
      >
        <span className="recipe-output-image-stage">
          <ContentImage
            imagePath={recipe.resultingItem.image}
            alt={`Image of ${recipe.resultingItem.name}`}
            size="card"
          />
          <span className="recipe-output-yield" aria-hidden="true">
            {variant === "directory-grid" ? <span>Yields</span> : null}
            <strong>{variant === "directory-grid" ? quantity : `×${quantity}`}</strong>
          </span>
        </span>

        <span className="recipe-output-copy">
          <span className="recipe-output-eyebrow">Recipe</span>
          <strong>{recipe.name}</strong>
          {recipe.resultingItem.category ? (
            <span className="recipe-output-category">
              {recipe.resultingItem.category.name}
            </span>
          ) : null}
          {recipe.profession && recipe.requiredLevel !== null ? (
            <span className="recipe-output-requirement">
              {variant.startsWith("directory-") ? (
                <>
                  <span>{recipe.profession.name}</span>
                  <span>Lvl {recipe.requiredLevel}</span>
                </>
              ) : (
                <>{recipe.profession.name} · Level {recipe.requiredLevel}</>
              )}
            </span>
          ) : null}
        </span>
      </Link>

      {recipe.ingredients.length > 0 ? (
        <section
          className="recipe-output-ingredients"
          aria-label={`Ingredients for ${recipe.name}`}
        >
          <p>Ingredients</p>
          {remainingIngredients.length > 0 ? (
            <RecipeOutputIngredientDisclosure
              listId={ingredientListId}
              recipeName={recipe.name}
              previewIngredients={renderIngredients(previewIngredients)}
              remainingIngredients={renderIngredients(remainingIngredients)}
              remainingCount={remainingIngredients.length}
            />
          ) : (
            <div className="recipe-output-ingredient-list" id={ingredientListId}>
              {renderIngredients(previewIngredients)}
            </div>
          )}
        </section>
      ) : null}
      {variant.startsWith("directory-") ? (
        <span className="recipe-output-experience">
          +{recipe.experienceReward} EXP
        </span>
      ) : null}
    </article>
  );
}
