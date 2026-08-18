import Link from "next/link";
import type { CSSProperties } from "react";
import { ContentImage } from "@/components/content/content-image";
import { RecipeOutputIngredientDisclosure } from "@/components/content/recipe-output-ingredient-disclosure";
import { formatRecipeQuantityRange } from "@/lib/recipes/recipe-quantity";
import type { RecipeOutputCardValue } from "@/lib/recipes/recipe-output-catalogue";

type RecipeOutputCardProps = {
  recipe: RecipeOutputCardValue;
  entryDelayMs?: number;
  variant?:
    | "standard"
    | "directory-grid"
    | "directory-list"
    | "grid"
    | "list";
};

const INGREDIENT_PREVIEW_COUNT = 4;

/** Canonical compact-grid preview budget: past this the chevron appears. */
const GRID_VISIBLE_INGREDIENTS = 3;

/**
 * Compact collection card for pages whose information shape is genuinely
 * Recipe + crafted result + ingredients.
 *
 * `grid` and `list` are the CANONICAL relationship pair, shared by every
 * public surface that shows Recipe records as a relationship (Profession
 * detail's Recipes, Item detail's Used in recipes, Recipe detail's Related
 * Recipes). They are one component and one CSS family precisely so those
 * surfaces cannot drift into three lookalike cards again.
 *
 * The two variants deliberately differ in how they handle ingredients:
 *
 * - `grid` is narrow, so it previews GRID_VISIBLE_INGREDIENTS and hands the
 *   rest to the disclosure chevron, whose panel then lists EVERY ingredient
 *   (not just the overflow).
 * - `list` is a wide row that exists for information density, so it renders
 *   every ingredient inline and has NO chevron, no panel, and no expanded
 *   state at all. An ingredient-heavy Recipe is a wrapping problem for the
 *   row, never a reason to hide data behind a disclosure.
 *
 * `directory-grid`/`directory-list` remain the /recipes catalogue's own
 * full-scale cards and are intentionally left at their catalogue geometry.
 */
export function RecipeOutputCard({
  recipe,
  entryDelayMs,
  variant = "standard",
}: RecipeOutputCardProps) {
  const quantity = formatRecipeQuantityRange(
    recipe.resultQuantityMin,
    recipe.resultQuantityMax
  );
  const ingredientListId = `recipe-${recipe.id}-ingredients`;
  const isCanonicalVariant = variant === "grid" || variant === "list";
  const previewCount =
    variant === "list"
      ? recipe.ingredients.length
      : variant === "directory-list"
      ? 6
      : variant === "directory-grid" || variant === "grid"
      ? GRID_VISIBLE_INGREDIENTS
      : INGREDIENT_PREVIEW_COUNT;
  const previewIngredients = recipe.ingredients.slice(
    0,
    previewCount
  );
  // The canonical list variant slices at the full length, so this is always
  // empty for it — which is what keeps its chevron and panel from ever
  // rendering, rather than a separate branch that could drift.
  const remainingIngredients = recipe.ingredients.slice(
    previewCount
  );
  const recipeLinkLabel = `${recipe.name}, produces ×${quantity} ${
    recipe.resultingItem.name
  }${
    recipe.resultingItem.category
      ? `, category ${recipe.resultingItem.category.name}`
      : ""
  }${recipe.profession ? `, ${recipe.profession.name}${
    recipe.requiredLevel !== null ? ` level ${recipe.requiredLevel}` : ""
  }` : ""}`;
  const cardClassName = `recipe-output-card recipe-output-card--${variant}${
    variant.startsWith("directory-") ? " cx-item-in" : ""
  }`;
  const cardStyle =
    entryDelayMs === undefined
      ? undefined
      : { animationDelay: `${Math.min(entryDelayMs, 330)}ms` };
  const gridTitleSize =
    recipe.name.length >= 26
      ? "11px"
      : recipe.name.length >= 20
      ? "12px"
      : "13.5px";
  const listTitleSize =
    recipe.name.length >= 16
      ? "11px"
      : recipe.name.length >= 13
      ? "12px"
      : "13.5px";
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
          <strong
            className={
              variant === "standard"
                ? undefined
                : "recipe-output-ingredient-quantity-badge"
            }
            aria-hidden="true"
          >
            {variant.startsWith("directory-")
              ? ingredient.quantity
              : `×${ingredient.quantity}`}
          </strong>
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

  const renderIngredientPanelRows = (
    ingredients: RecipeOutputCardValue["ingredients"]
  ) =>
    ingredients.map((ingredient, index) => (
      <Link
        className="recipe-output-ingredient-panel-row"
        href={`/items/${ingredient.item.slug}`}
        aria-label={`${ingredient.item.name}, required quantity ×${ingredient.quantity}`}
        key={`panel-${ingredient.id}`}
        style={
          {
            "--recipe-ingredient-row-delay": `${Math.min(index, 10) * 30}ms`,
          } as CSSProperties
        }
      >
        <span className="recipe-output-ingredient-panel-image">
          <ContentImage imagePath={ingredient.item.image} alt="" size="row" />
        </span>
        <span className="recipe-output-ingredient-panel-name">
          {ingredient.item.name}
        </span>
        <strong aria-hidden="true">×{ingredient.quantity}</strong>
      </Link>
    ));

  if (variant === "directory-list") {
    return (
      <article className={cardClassName} style={cardStyle}>
        <Link
          className="recipe-output-list-identity"
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
              <strong>{quantity}</strong>
            </span>
          </span>
          <strong
            className="recipe-output-list-title"
            title={recipe.name}
            style={{ fontSize: listTitleSize }}
          >
            {recipe.name}
          </strong>
        </Link>

        <span className="recipe-output-list-profession">
          {recipe.profession ? (
            <>
              <span>{recipe.profession.name}</span>
              {recipe.requiredLevel !== null ? (
                <span>Lvl {recipe.requiredLevel}</span>
              ) : null}
            </>
          ) : null}
        </span>

        <span className="recipe-output-experience">
          +{recipe.experienceReward} EXP
        </span>

        <section
          className="recipe-output-ingredients"
          aria-label={`Ingredients for ${recipe.name}`}
        >
          {remainingIngredients.length > 0 ? (
            <RecipeOutputIngredientDisclosure
              listId={ingredientListId}
              recipeName={recipe.name}
              previewIngredients={renderIngredients(previewIngredients)}
              expandedIngredients={renderIngredientPanelRows(recipe.ingredients)}
              remainingCount={remainingIngredients.length}
              popover
            />
          ) : (
            <div className="recipe-output-ingredient-list" id={ingredientListId}>
              {renderIngredients(previewIngredients)}
            </div>
          )}
        </section>
      </article>
    );
  }

  if (isCanonicalVariant) {
    return (
      <article className={cardClassName} style={cardStyle}>
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
              {/* Grid has room for the labelled yield plate; the compact list
                  row shows the value alone. */}
              <span className="recipe-output-yield" aria-hidden="true">
                {variant === "grid" ? <span>Yields</span> : null}
                <strong>{quantity}</strong>
              </span>
            </span>
          </Link>

          <span className="recipe-output-copy">
            <Link
              className="recipe-output-recipe-link"
              href={`/recipes/${recipe.slug}`}
              aria-label={recipeLinkLabel}
              title={recipe.name}
              style={
                variant === "grid"
                  ? { fontSize: gridTitleSize }
                  : { fontSize: listTitleSize }
              }
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
                // The panel lists EVERY ingredient, not only the overflow, so
                // the open card answers the whole question on its own.
                expandedIngredients={renderIngredientPanelRows(
                  recipe.ingredients,
                )}
                remainingCount={remainingIngredients.length}
                popover
              />
            ) : (
              <div className="recipe-output-ingredient-list" id={ingredientListId}>
                {renderIngredients(previewIngredients)}
              </div>
            )}
          </section>
        ) : null}

        {variant === "list" ? (
          <span className="recipe-output-experience">
            +{recipe.experienceReward} EXP
          </span>
        ) : null}
      </article>
    );
  }

  return (
    <article className={cardClassName} style={cardStyle}>
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
          <strong
            title={recipe.name}
            style={
              variant === "directory-grid"
                ? { fontSize: gridTitleSize }
                : undefined
            }
          >
            {recipe.name}
          </strong>
          {recipe.resultingItem.category ? (
            <span className="recipe-output-category">
              {recipe.resultingItem.category.name}
            </span>
          ) : null}
          {recipe.profession ? (
            <span className="recipe-output-requirement">
              {variant.startsWith("directory-") ? (
                <>
                  <span>{recipe.profession.name}</span>
                  {recipe.requiredLevel !== null ? (
                    <span>Lvl {recipe.requiredLevel}</span>
                  ) : null}
                </>
              ) : (
                <>
                  {recipe.profession.name}
                  {recipe.requiredLevel !== null
                    ? ` · Level ${recipe.requiredLevel}`
                    : ""}
                </>
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
              expandedIngredients={
                variant === "directory-grid"
                  ? renderIngredientPanelRows(recipe.ingredients)
                  : renderIngredients(remainingIngredients)
              }
              remainingCount={remainingIngredients.length}
              popover={variant === "directory-grid"}
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
