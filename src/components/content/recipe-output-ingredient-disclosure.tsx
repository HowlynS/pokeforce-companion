"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { publicMotionDuration } from "@/lib/public-motion";

type RecipeOutputIngredientDisclosureProps = {
  listId: string;
  recipeName: string;
  previewIngredients: ReactNode;
  expandedIngredients: ReactNode;
  remainingCount: number;
  popover?: boolean;
};

export function RecipeOutputIngredientDisclosure({
  listId,
  recipeName,
  previewIngredients,
  expandedIngredients,
  remainingCount,
  popover = false,
}: RecipeOutputIngredientDisclosureProps) {
  const [expanded, setExpanded] = useState(false);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disclosureRef = useRef<HTMLDivElement>(null);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!expanded || !popover) return;

    function dismissOutsideCard(event: MouseEvent) {
      const disclosure = disclosureRef.current;
      const target = event.target;
      if (!disclosure || !(target instanceof Node)) return;

      const card = disclosure.closest(".recipe-output-card");
      if ((card ?? disclosure).contains(target)) return;

      if (closeTimer.current) clearTimeout(closeTimer.current);
      setExpanded(false);
      setClosing(false);
    }

    document.addEventListener("click", dismissOutsideCard, true);
    return () => document.removeEventListener("click", dismissOutsideCard, true);
  }, [expanded, popover]);

  function toggle() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
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
    <div className="recipe-output-ingredient-disclosure" ref={disclosureRef}>
      <div
        className="recipe-output-ingredient-list"
        id={popover ? `${listId}-preview` : listId}
      >
        {previewIngredients}
        {expanded && !popover ? expandedIngredients : null}
      </div>
      <button
        className="recipe-output-ingredient-toggle"
        type="button"
        aria-controls={listId}
        aria-expanded={expanded && !closing}
        aria-label={
          expanded && !closing
            ? `Hide ${remainingCount} additional ingredients for ${recipeName}`
            : `Show ${remainingCount} more ingredients for ${recipeName}`
        }
        onClick={toggle}
      >
        <svg
          className="recipe-output-ingredient-toggle-chevron"
          aria-hidden="true"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
        >
          <path
            d="M6 9l6 6 6-6"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
      {expanded && popover ? (
        <div
          id={listId}
          className={`recipe-output-ingredient-panel ${closing ? "cx-panel-out" : "cx-panel-in"}`}
          role="region"
          aria-labelledby={`${listId}-heading`}
          aria-hidden={closing || undefined}
          inert={closing ? true : undefined}
        >
          <p id={`${listId}-heading`}>RECIPE INGREDIENTS</p>
          {expandedIngredients}
        </div>
      ) : null}
    </div>
  );
}
