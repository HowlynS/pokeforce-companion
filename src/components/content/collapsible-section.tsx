"use client";

import { useEffect, useId, useRef, useState } from "react";
import { publicMotionDuration } from "@/lib/public-motion";

type CollapsibleSectionProps = {
  title: string;
  meta?: React.ReactNode;
  className?: string;
  defaultOpen?: boolean;
  animationVariant?: "item" | "stagger";
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
  animationVariant = "item",
  children,
}: CollapsibleSectionProps) {
  const [mounted, setMounted] = useState(defaultOpen);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelId = useId();

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  function toggle() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (!mounted) {
      setMounted(true);
      setClosing(false);
      return;
    }
    if (closing) return;
    setClosing(true);
    closeTimer.current = setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, publicMotionDuration(220));
  }

  const expanded = mounted && !closing;
  const panelAnimation = closing
    ? animationVariant === "stagger"
      ? "cx-fade-out-stagger"
      : "cx-item-out"
    : animationVariant === "stagger"
      ? "cx-fade-in-stagger"
      : "cx-item-in";

  return (
    <div className={className}>
      <h2 className="detail-collapsible-heading">
        <button
          type="button"
          className="detail-collapsible-trigger"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={toggle}
        >
          <svg
            aria-hidden="true"
            width="13"
            height="13"
            viewBox="0 0 24 24"
            className="detail-collapsible-chevron"
            style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
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
          {mounted ? (
            <span
              className={`detail-collapsible-rule ${closing ? "cx-line-sweep-out" : "cx-line-sweep"}`}
              aria-hidden="true"
            />
          ) : null}
        </button>
      </h2>

      {mounted ? (
        <div
          id={panelId}
          role="region"
          aria-label={title}
          aria-hidden={closing || undefined}
          inert={closing ? true : undefined}
          className={panelAnimation}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
