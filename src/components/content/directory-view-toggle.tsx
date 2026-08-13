"use client";

import { useState } from "react";
import { CatalogueViewSwitch } from "@/components/content/catalogue-view-switch";

type DirectoryViewToggleProps = {
  /** Search field + filter popover — rendered on the toolbar's left. */
  toolbarLeft: React.ReactNode;
  grid: React.ReactNode;
  list: React.ReactNode;
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
 * The directory toolbar (search + filter on the left, Grid/List toggle on
 * the right) and the card content below it, as one client component:
 * view mode is per-page client state only, never persisted or sent to
 * the server. Both the grid and list markup are rendered server-side
 * from the same real data and passed in as children; this component
 * only switches which one is visible, so no data re-fetch or
 * client-side query logic is introduced.
 */
export function DirectoryViewToggle({
  toolbarLeft,
  grid,
  list,
}: DirectoryViewToggleProps) {
  const [mode, setMode] = useState<"grid" | "list">("grid");

  return (
    <>
      <div className="directory-toolbar">
        <div className="directory-toolbar-left">{toolbarLeft}</div>
        <div className="directory-view-toggle" role="group" aria-label="Layout">
          <button
            type="button"
            className={
              "directory-view-toggle-btn" +
              (mode === "grid" ? " directory-view-toggle-btn--active" : "")
            }
            aria-pressed={mode === "grid"}
            onClick={() => setMode("grid")}
          >
            {GRID_ICON}
            Grid
          </button>
          <button
            type="button"
            className={
              "directory-view-toggle-btn" +
              (mode === "list" ? " directory-view-toggle-btn--active" : "")
            }
            aria-pressed={mode === "list"}
            onClick={() => setMode("list")}
          >
            {LIST_ICON}
            List
          </button>
        </div>
      </div>
      <CatalogueViewSwitch mode={mode} grid={grid} list={list} />
    </>
  );
}
