"use client";

import { useId, useState } from "react";

type CollapsibleSectionProps = {
  title: string;
  meta?: React.ReactNode;
  className?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

/**
 * A collapsible detail-page section matching the Claude Design handoff's
 * sweep-header treatment (serif title + chevron + a gold rule that sweeps
 * in under the header when open). Follows the ARIA APG disclosure pattern
 * — <h2><button aria-expanded aria-controls></button></h2> beside a
 * role="region" panel — so the heading's accessible name is exactly its
 * text (matching the existing "How to obtain" / "Used in recipes"
 * heading-text test contracts) regardless of the interactive wrapper.
 */
export function CollapsibleSection({
  title,
  meta,
  className,
  defaultOpen = true,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div className={className}>
      <h2 className="detail-collapsible-heading">
        <button
          type="button"
          className="detail-collapsible-trigger"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
        >
          <svg
            aria-hidden="true"
            width="13"
            height="13"
            viewBox="0 0 24 24"
            className="detail-collapsible-chevron"
            style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
          >
            <path
              d="M6 9l6 6 6-6"
              stroke="currentColor"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
          {title}
          {meta ? (
            <span className="detail-collapsible-meta" aria-hidden="true">
              {meta}
            </span>
          ) : null}
          {open ? (
            <span className="detail-collapsible-rule cx-line-sweep" aria-hidden="true" />
          ) : null}
        </button>
      </h2>

      {open ? (
        <div id={panelId} role="region" aria-label={title} className="cx-fade-in-stagger">
          {children}
        </div>
      ) : null}
    </div>
  );
}
