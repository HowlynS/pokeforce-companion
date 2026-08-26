"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * `useLayoutEffect` warns when React renders a client component on the
 * server, so the server render takes the passive hook instead. The hook
 * COUNT is identical either way, so hydration is unaffected — and on the
 * client the measurement still lands before the browser paints.
 */
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

type RelatedItemGridProps = {
  /** The server-rendered cards. Each must carry .item-related-card-name. */
  children: React.ReactNode;
};

/**
 * Related Items, with a title allowance the whole rendered GROUP agrees on.
 *
 * The card set used to reserve a fixed single-line title block whatever it
 * held, so a group of short names carried visible dead space between each
 * title and its category line, while a long name was simply truncated.
 *
 * The rule now is adaptive per group but UNIFORM within it:
 *
 *   * every title in the group fits on one line  -> the group uses the
 *     compact allowance (one line, tighter title/category gap);
 *   * at least one title needs a second line     -> the WHOLE group uses the
 *     expanded allowance, so category baselines stay aligned across the row
 *     instead of the cards going jagged.
 *
 * The mode is one data attribute on the collection, and the cards read it
 * through inherited custom properties — so there is never a per-card
 * min-height, a per-card measurement, or a hardcoded name exception. It is
 * measured, not guessed from the viewport: the same names wrap at different
 * widths, and a ResizeObserver re-runs the decision when the column width
 * actually changes.
 *
 * The server renders the COMPACT mode, which is the geometry these cards
 * already had, so the pre-hydration paint is never taller than the settled
 * one; only a group that genuinely needs the second line grows.
 */
export function RelatedItemGrid({ children }: RelatedItemGridProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const lastWidthRef = useRef<number | null>(null);
  const [mode, setMode] = useState<"compact" | "expanded">("compact");

  const measure = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;

    const titles = Array.from(
      root.querySelectorAll<HTMLElement>(".item-related-card-name")
    );
    if (titles.length === 0) return;

    // Read each title's UNCLAMPED height, so the answer does not depend on
    // the mode currently applied — that is what keeps this from oscillating
    // between the two modes once a group is close to the boundary.
    const needsSecondLine = titles.some((title) => {
      const previous = title.style.webkitLineClamp;
      title.style.webkitLineClamp = "unset";
      const lineHeight = Number.parseFloat(
        window.getComputedStyle(title).lineHeight
      );
      const contentHeight = title.scrollHeight;
      title.style.webkitLineClamp = previous;

      if (!Number.isFinite(lineHeight) || lineHeight <= 0) return false;
      // Half a line of tolerance, so sub-pixel line boxes never read as a
      // wrap that is not there.
      return contentHeight > lineHeight * 1.5;
    });

    setMode(needsSecondLine ? "expanded" : "compact");
  }, []);

  useIsomorphicLayoutEffect(() => {
    lastWidthRef.current = rootRef.current?.getBoundingClientRect().width ?? null;
    measure();
  }, [measure, children]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width === undefined) return;
      // Height changes are this component's OWN output; only a real width
      // change can alter whether a title wraps.
      if (lastWidthRef.current !== null && Math.abs(width - lastWidthRef.current) < 1) {
        return;
      }
      lastWidthRef.current = width;
      measure();
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, [measure]);

  return (
    <div
      ref={rootRef}
      className="item-related-grid"
      data-related-title-mode={mode}
    >
      {children}
    </div>
  );
}
