"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { publicMotionDuration } from "@/lib/public-motion";

type RecipeOutputIngredientDisclosureProps = {
  listId: string;
  recipeName: string;
  previewIngredients: ReactNode;
  expandedIngredients: ReactNode;
  remainingCount: number;
  popover?: boolean;
};

// Keeps the centered overlay clear of the viewport's own edges once it
// grows past its minimum width; re-measured only when the panel opens, not
// on every frame, since the card itself never moves while the panel is open.
const PANEL_EDGE_GUTTER = 12;

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
  const [edgeShift, setEdgeShift] = useState(0);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disclosureRef = useRef<HTMLDivElement>(null);
  const positionerRef = useRef<HTMLDivElement>(null);

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

  // Measures the panel against the viewport as soon as it opens (before the
  // browser paints, so no visible jump) and nudges it back on-screen with a
  // translateX offset instead of abandoning the centered anchor entirely.
  useLayoutEffect(() => {
    if (!expanded || !popover) return;
    const positioner = positionerRef.current;
    if (!positioner) return;
    const rect = positioner.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    let shift = 0;
    if (rect.left < PANEL_EDGE_GUTTER) {
      shift = PANEL_EDGE_GUTTER - rect.left;
    } else if (rect.right > viewportWidth - PANEL_EDGE_GUTTER) {
      shift = viewportWidth - PANEL_EDGE_GUTTER - rect.right;
    }
    setEdgeShift(shift);
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
          className="recipe-output-ingredient-positioner"
          ref={positionerRef}
          style={
            { "--panel-edge-shift": `${edgeShift}px` } as CSSProperties
          }
        >
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
        </div>
      ) : null}
    </div>
  );
}
