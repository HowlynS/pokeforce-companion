import { RecipeOutputCard } from "@/components/content/recipe-output-card";
import type { RecipeOutputCardValue } from "@/lib/recipes/recipe-output-catalogue";

/** Caps the entrance stagger so a long collection still finishes promptly. */
const MAX_ENTRY_DELAY_MS = 330;

function entryDelay(index: number) {
  return Math.min(index * 30, MAX_ENTRY_DELAY_MS);
}

/**
 * The two canonical presentations of a Recipe collection, built once and
 * shared by every public relationship surface (Profession detail, Item
 * detail, Recipe detail).
 *
 * Both views are server-rendered and handed to RecipeCollectionSection as
 * props, so the client only owns the mode and the disclosure state. Each row
 * carries the shared `cx-item-in` entrance class that CatalogueViewSwitch
 * restarts on a mode change.
 */
export function RecipeCollectionGrid({
  recipes,
}: {
  recipes: readonly RecipeOutputCardValue[];
}) {
  return (
    <div className="recipe-collection-grid">
      {recipes.map((recipe, index) => (
        <div
          className="cx-item-in"
          style={{ animationDelay: `${entryDelay(index)}ms` }}
          key={recipe.id}
        >
          <RecipeOutputCard recipe={recipe} variant="grid" />
        </div>
      ))}
    </div>
  );
}

export function RecipeCollectionList({
  recipes,
}: {
  recipes: readonly RecipeOutputCardValue[];
}) {
  return (
    <div className="recipe-collection-list">
      <div className="recipe-collection-list-header" aria-hidden="true">
        <span />
        <span>Recipe</span>
        <span>Profession</span>
        <span>EXP</span>
        <span>Ingredients</span>
      </div>
      {recipes.map((recipe, index) => (
        <div
          className="cx-item-in"
          style={{ animationDelay: `${entryDelay(index)}ms` }}
          key={recipe.id}
        >
          <RecipeOutputCard recipe={recipe} variant="list" />
        </div>
      ))}
    </div>
  );
}
