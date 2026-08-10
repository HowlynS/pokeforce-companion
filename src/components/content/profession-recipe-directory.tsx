"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type ProfessionRecipeDirectoryProps = {
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

export function ProfessionRecipeDirectory({
  grid,
  list,
}: ProfessionRecipeDirectoryProps) {
  const [mode, setMode] = useState<"grid" | "list">("grid");
  const [open, setOpen] = useState(true);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  function toggleOpen() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (open) {
      setClosing(true);
      closeTimer.current = setTimeout(() => {
        setOpen(false);
        setClosing(false);
      }, 220);
      return;
    }
    setOpen(true);
  }

  return (
    <section className="profession-recipes-section" aria-labelledby="profession-recipes-title">
      <div className="profession-recipes-toolbar">
        <h2 id="profession-recipes-title">
          <button
            type="button"
            className="profession-recipes-reveal"
            aria-controls="profession-recipes-panel"
            aria-expanded={open && !closing}
            onClick={toggleOpen}
          >
            <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24">
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            </svg>
            <span>Recipes</span>
            {open && !closing ? <span className="profession-recipes-rule cx-line-sweep" /> : null}
          </button>
        </h2>

        <div className="profession-recipes-view-toggle" role="group" aria-label="Recipe layout">
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
          id="profession-recipes-panel"
          className={`profession-recipes-panel${closing ? " cx-panel-out" : " cx-panel-in"}`}
        >
          {mode === "grid" ? grid : list}
        </div>
      ) : null}
    </section>
  );
}
