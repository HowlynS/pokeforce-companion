"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { publicMotionDuration } from "@/lib/public-motion";

type LocationDirectoryFoldProps = {
  title: string;
  variant: "region" | "type";
  href?: string;
  count?: number;
  countNoun?: string;
  children: React.ReactNode;
};

/** Accessible translation of the handoff's nested Location folds. */
export function LocationDirectoryFold({
  title,
  variant,
  href,
  count,
  countNoun = "location",
  children,
}: LocationDirectoryFoldProps) {
  const [mounted, setMounted] = useState(true);
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
    if (closing) {
      setClosing(false);
      return;
    }
    if (!mounted) {
      setMounted(true);
      setClosing(false);
      return;
    }

    setClosing(true);
    closeTimer.current = setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, publicMotionDuration(130));
  }

  const isExpanded = mounted && !closing;

  // The whole heading label is the disclosure trigger — chevron and title are
  // one button, so no interactive element is ever nested inside another. A
  // region's own page stays reachable through a separate, sibling icon link.
  const trigger = (
    <button
      type="button"
      className="location-directory-fold-toggle"
      aria-expanded={isExpanded}
      aria-controls={panelId}
      onClick={toggle}
    >
      <span className="location-directory-fold-chevron" aria-hidden="true">
        <svg width="10" height="10" viewBox="0 0 24 24">
          <path
            d="M6 9l6 6 6-6"
            stroke="currentColor"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span className="location-directory-fold-title">{title}</span>
    </button>
  );

  return (
    <section className={`location-directory-fold location-directory-fold--${variant}`}>
      <div className="location-directory-fold-heading">
        {href ? <h2>{trigger}</h2> : <h3>{trigger}</h3>}
        {href ? (
          <Link
            href={href}
            className="location-directory-fold-link"
            aria-label={`Open the ${title} page`}
          >
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24">
              <path
                d="M7 17 17 7M9 7h8v8"
                stroke="currentColor"
                strokeWidth="2.2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        ) : null}
        {typeof count === "number" ? (
          <span className="location-directory-fold-count">
            {count} {count === 1 ? countNoun : `${countNoun}s`}
          </span>
        ) : null}
        {variant === "type" ? (
          <span className="location-directory-fold-rule" aria-hidden="true" />
        ) : null}
      </div>

      {mounted ? (
        <div
          id={panelId}
          aria-hidden={closing || undefined}
          inert={closing ? true : undefined}
          className={
            "location-directory-fold-content " +
            (closing ? "location-directory-fold-content--closing" : "cx-item-in")
          }
        >
          {children}
        </div>
      ) : null}
    </section>
  );
}
