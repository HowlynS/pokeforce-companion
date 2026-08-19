"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { publicMotionDuration } from "@/lib/public-motion";

/** Must match the .directory-filter-panel--closing animation duration. */
const CLOSE_ANIMATION_MS = 140;

export type DirectoryFilterOption = {
  slug: string;
  name: string;
};

type DirectoryFilterPopoverProps = {
  label: string;
  paramName: string;
  basePath: string;
  options: readonly DirectoryFilterOption[];
  selectedSlugs: readonly string[];
  /** Other active query params to preserve across a filter submit (e.g.
      the current `q` search term). Page always resets to 1 on submit. */
  preserve?: Record<string, string | undefined>;
};

/**
 * Real, multi-select category/profession filter — a native GET form
 * (works with JS disabled; checking a box just doesn't auto-submit
 * without one), not a decorative client-only filter. The popover
 * open/close behavior mirrors world-menu.tsx's established pattern
 * (capture-phase outside click, Escape closes and returns focus).
 */
export function DirectoryFilterPopover({
  label,
  paramName,
  basePath,
  options,
  selectedSlugs,
  preserve,
}: DirectoryFilterPopoverProps) {
  const [open, setOpen] = useState(false);
  // The panel keeps rendering while it plays its exit animation; `closing`
  // is what distinguishes "on screen and interactive" from "on screen and
  // leaving". Under reduced motion the handoff is zero, so the panel
  // unmounts on the next tick and no exit is ever seen.
  const [closing, setClosing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelId = useId();

  const close = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setClosing(true);
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null;
      setOpen(false);
      setClosing(false);
    }, publicMotionDuration(CLOSE_ANIMATION_MS));
  }, []);

  // Reopening mid-exit cancels the pending unmount rather than queueing a
  // second one, so a fast toggle never flickers.
  const openPanel = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setClosing(false);
    setOpen(true);
  }, []);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!open || closing) return;

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        close();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, closing, close]);

  const activeCount = selectedSlugs.length;
  const expanded = open && !closing;

  return (
    <div className="directory-filter" ref={containerRef}>
      <button
        type="button"
        ref={buttonRef}
        className={
          "directory-filter-trigger" +
          (activeCount > 0 ? " directory-filter-trigger--active" : "")
        }
        aria-haspopup="true"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => (expanded ? close() : openPanel())}
      >
        <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none">
          <line x1="4" y1="6" x2="20" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="7" y1="12" x2="17" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="10" y1="18" x2="14" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        Filter
        {activeCount > 0 ? (
          <span className="directory-filter-count">{activeCount}</span>
        ) : null}
      </button>

      {open ? (
        <form
          id={panelId}
          action={basePath}
          method="get"
          className={
            "directory-filter-panel" +
            (closing ? " directory-filter-panel--closing" : "")
          }
        >
          {Object.entries(preserve ?? {}).map(([key, value]) =>
            value ? <input key={key} type="hidden" name={key} value={value} /> : null,
          )}
          <div className="directory-filter-panel-title">{label}</div>
          <div className="directory-filter-panel-options">
            {options.map((option) => (
              <label className="directory-filter-option" key={option.slug}>
                <input
                  type="checkbox"
                  name={paramName}
                  value={option.slug}
                  defaultChecked={selectedSlugs.includes(option.slug)}
                />
                {option.name}
              </label>
            ))}
          </div>
          <div className="directory-filter-panel-actions">
            <button type="submit" className="directory-filter-apply">
              Apply filters
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
