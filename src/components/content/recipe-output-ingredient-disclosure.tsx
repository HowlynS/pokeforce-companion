"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { publicMotionDuration } from "@/lib/public-motion";

type RecipeOutputIngredientDisclosureProps = {
  listId: string;
  recipeName: string;
  previewIngredients: ReactNode;
  remainingIngredients: ReactNode;
  remainingCount: number;
  compact?: boolean;
  popover?: boolean;
};

export function RecipeOutputIngredientDisclosure({
  listId,
  recipeName,
  previewIngredients,
  remainingIngredients,
  remainingCount,
  compact = false,
  popover = false,
}: RecipeOutputIngredientDisclosureProps) {
  const [expanded, setExpanded] = useState(false);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  function toggle() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (closing) {
      setClosing(false);
      return;
    }
    if (!expanded) {
      setExpanded(true);
      setClosing(false);
      return;
    }
    if (!popover) {
      setExpanded(false);
      return;
    }
    setClosing(true);
    closeTimer.current = setTimeout(() => {
      setExpanded(false);
      setClosing(false);
    }, publicMotionDuration(180));
  }

  return (
    <div className="recipe-output-ingredient-disclosure">
      <div className="recipe-output-ingredient-list" id={listId}>
        {previewIngredients}
        {expanded && !popover ? remainingIngredients : null}
      </div>
      <button
        className="recipe-output-ingredient-toggle"
        type="button"
        aria-controls={listId}
        aria-expanded={expanded && !closing}
        aria-label={
          expanded
            ? `Show fewer ingredients for ${recipeName}`
            : `Show ${remainingCount} more ingredients for ${recipeName}`
        }
        onClick={toggle}
      >
        {compact ? (expanded ? "−" : `+${remainingCount}`) : expanded ? "Show fewer" : `+${remainingCount} more`}
      </button>
      {expanded && popover ? (
        <div
          className={`recipe-output-ingredient-panel ${closing ? "cx-panel-out" : "cx-panel-in"}`}
          aria-hidden={closing || undefined}
          inert={closing ? true : undefined}
        >
          <p>More Ingredients</p>
          {remainingIngredients}
        </div>
      ) : null}
    </div>
  );
}
