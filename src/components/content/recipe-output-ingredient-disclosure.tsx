"use client";

import { useState, type ReactNode } from "react";

type RecipeOutputIngredientDisclosureProps = {
  listId: string;
  recipeName: string;
  previewIngredients: ReactNode;
  remainingIngredients: ReactNode;
  remainingCount: number;
};

export function RecipeOutputIngredientDisclosure({
  listId,
  recipeName,
  previewIngredients,
  remainingIngredients,
  remainingCount,
}: RecipeOutputIngredientDisclosureProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="recipe-output-ingredient-disclosure">
      <div className="recipe-output-ingredient-list" id={listId}>
        {previewIngredients}
        {expanded ? remainingIngredients : null}
      </div>
      <button
        className="recipe-output-ingredient-toggle"
        type="button"
        aria-controls={listId}
        aria-expanded={expanded}
        aria-label={
          expanded
            ? `Show fewer ingredients for ${recipeName}`
            : `Show ${remainingCount} more ingredients for ${recipeName}`
        }
        onClick={() => setExpanded((current) => !current)}
      >
        {expanded ? "Show fewer" : `+${remainingCount} more`}
      </button>
    </div>
  );
}
