"use client";

import { useEffect, useId, useRef, useState } from "react";

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
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const activeCount = selectedSlugs.length;

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
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
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
          className="directory-filter-panel"
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
