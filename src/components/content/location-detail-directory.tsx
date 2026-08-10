"use client";

import { useRef, useState } from "react";
import { publicMotionDuration } from "@/lib/public-motion";

type LocationDetailDirectoryProps = {
  title: string;
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

/** Handoff-faithful disclosure and local grid/list state for direct child
 * Locations. The data itself remains server-rendered and schema-backed. */
export function LocationDetailDirectory({
  title,
  grid,
  list,
}: LocationDetailDirectoryProps) {
  const [mode, setMode] = useState<"grid" | "list">("grid");
  const [mounted, setMounted] = useState(true);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function toggle() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (!mounted) {
      setMounted(true);
      setClosing(false);
      return;
    }
    setClosing(true);
    closeTimer.current = setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, publicMotionDuration(220));
  }

  const expanded = mounted && !closing;

  return (
    <section className="location-detail-directory">
      <div className="location-detail-directory-header">
        <h2>
          <button
            type="button"
            className="location-detail-directory-trigger"
            aria-expanded={expanded}
            onClick={toggle}
          >
            <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24">
              <path
                d="M6 9l6 6 6-6"
                stroke="currentColor"
                strokeWidth="2.5"
                fill="none"
                strokeLinecap="round"
              />
            </svg>
            {title}
            {mounted ? (
              <span
                className={`location-detail-directory-rule ${
                  closing ? "location-detail-directory-rule--closing" : "cx-line-sweep"
                }`}
                aria-hidden="true"
              />
            ) : null}
          </button>
        </h2>

        <div className="profession-recipes-view-toggle" role="group" aria-label={`${title} layout`}>
          <button
            type="button"
            className={mode === "grid" ? "is-active" : undefined}
            aria-pressed={mode === "grid"}
            onClick={() => setMode("grid")}
          >
            {GRID_ICON}
            Grid
          </button>
          <button
            type="button"
            className={mode === "list" ? "is-active" : undefined}
            aria-pressed={mode === "list"}
            onClick={() => setMode("list")}
          >
            {LIST_ICON}
            List
          </button>
        </div>
      </div>

      {mounted ? (
        <div
          aria-hidden={closing || undefined}
          inert={closing ? true : undefined}
          className={
            "location-detail-directory-content " +
            (closing ? "location-detail-directory-content--closing" : "cx-item-in")
          }
        >
          {mode === "grid" ? grid : list}
        </div>
      ) : null}
    </section>
  );
}
