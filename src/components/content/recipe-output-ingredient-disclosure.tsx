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

// Keeps the centered overlay clear of whatever actually crops it once it
// grows past its minimum width; re-measured only when the panel opens, not
// on every frame, since the card itself never moves while the panel is open.
const PANEL_EDGE_GUTTER = 12;

/**
 * Finds the horizontal band the overlay can actually paint into. The Recipes
 * catalogue grid carries `overflow-y: auto` for its own scrolling, and CSS
 * computes the untouched `overflow-x` from `visible` to `auto` alongside it —
 * so the grid crops horizontally too, well inside the viewport. Measuring
 * against `clientWidth` alone would leave the panel's right edge (and its
 * quantity column) cropped by that ancestor, so every clipping ancestor is
 * intersected here instead.
 */
function findVisibleBounds(element: HTMLElement) {
  let left = 0;
  let right = document.documentElement.clientWidth;
  let node = element.parentElement;
  while (node && node !== document.documentElement) {
    if (getComputedStyle(node).overflowX !== "visible") {
      const rect = node.getBoundingClientRect();
      left = Math.max(left, rect.left);
      right = Math.min(right, rect.right);
    }
    node = node.parentElement;
  }
  return { left, right };
}

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
  const edgeShiftRef = useRef(0);
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

  // Measures the panel against its real clipping boundary as soon as it opens
  // (before the browser paints, so no visible jump) and nudges it back inside
  // with a translateX offset instead of abandoning the centered anchor.
  useLayoutEffect(() => {
    if (!expanded || !popover) return;
    const positioner = positionerRef.current;
    if (!positioner) return;

    // Reopening the same card measures a positioner that still carries the
    // previous shift, so the correction is always computed from the panel's
    // unshifted geometry and the result stays idempotent.
    const applied = edgeShiftRef.current;
    const rect = positioner.getBoundingClientRect();
    const naturalLeft = rect.left - applied;
    const naturalRight = rect.right - applied;

    const bounds = findVisibleBounds(positioner);
    const leftLimit = bounds.left + PANEL_EDGE_GUTTER;
    const rightLimit = bounds.right - PANEL_EDGE_GUTTER;

    let shift = 0;
    if (naturalRight > rightLimit) {
      shift -= naturalRight - rightLimit;
    }
    if (naturalLeft + shift < leftLimit) {
      shift += leftLimit - (naturalLeft + shift);
    }

    edgeShiftRef.current = shift;
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
