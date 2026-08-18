"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { CatalogueViewSwitch } from "@/components/content/catalogue-view-switch";
import { publicMotionDuration } from "@/lib/public-motion";

type RecipeCollectionSectionProps = {
  /** Section heading text, e.g. "Recipes", "Used in recipes". */
  title: string;
  grid: ReactNode;
  list: ReactNode;
};

const GRID_ICON = (
  <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
    <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
    <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
    <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const LIST_ICON = (
  <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none">
    <line x1="4" y1="6" x2="20" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="4" y1="18" x2="20" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

/**
 * The shared shell for a public section that presents a COLLECTION of Recipe
 * records: a disclosure heading, the Grid/List switch, and whichever view is
 * selected.
 *
 * This began as Profession detail's own Recipes section. It is shared rather
 * than copied because Item detail's "Used in recipes" and Recipe detail's
 * "Related Recipes" present the same information shape, and three lookalike
 * implementations are exactly how those surfaces drifted apart before.
 *
 * View switching goes through CatalogueViewSwitch, so the entrance stagger
 * replays on every switch (it keys the presentation subtree by mode) while
 * the toolbar and this section's own disclosure state stay put. Ids are
 * generated per instance, so two of these sections can coexist on one page.
 */
export function RecipeCollectionSection({
  title,
  grid,
  list,
}: RecipeCollectionSectionProps) {
  const [mode, setMode] = useState<"grid" | "list">("grid");
  const [open, setOpen] = useState(true);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reactId = useId();
  const panelId = `recipe-collection-panel-${reactId}`;
  const titleId = `recipe-collection-title-${reactId}`;

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  function toggleOpen() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (closing) {
      setClosing(false);
      return;
    }
    if (open) {
      setClosing(true);
      closeTimer.current = setTimeout(() => {
        setOpen(false);
        setClosing(false);
      }, publicMotionDuration(220));
      return;
    }
    setOpen(true);
  }

  return (
    <section className="recipe-collection-section" aria-labelledby={titleId}>
      <div className="recipe-collection-toolbar">
        <h2 id={titleId}>
          <button
            type="button"
            className="recipe-collection-reveal"
            aria-controls={panelId}
            aria-expanded={open && !closing}
            onClick={toggleOpen}
          >
            <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24">
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            </svg>
            <span>{title}</span>
            {open && !closing ? <span className="recipe-collection-rule cx-line-sweep" /> : null}
          </button>
        </h2>

        <div className="collection-view-toggle" role="group" aria-label={`${title} layout`}>
          <button
            type="button"
            className={mode === "grid" ? "is-active" : ""}
            aria-pressed={mode === "grid"}
            onClick={() => setMode("grid")}
          >
            {GRID_ICON}
            Grid
          </button>
          <button
            type="button"
            className={mode === "list" ? "is-active" : ""}
            aria-pressed={mode === "list"}
            onClick={() => setMode("list")}
          >
            {LIST_ICON}
            List
          </button>
        </div>
      </div>

      {open || closing ? (
        <div
          id={panelId}
          className={`recipe-collection-panel${closing ? " cx-panel-out" : " cx-panel-in"}`}
          aria-hidden={closing || undefined}
          inert={closing ? true : undefined}
        >
          <CatalogueViewSwitch mode={mode} grid={grid} list={list} />
        </div>
      ) : null}
    </section>
  );
}
