"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { publicMotionDuration } from "@/lib/public-motion";
import {
  flattenQuickSearchGroups,
  isQuickSearchQuery,
  type QuickSearchGroup,
} from "@/lib/search/quick-search";

/** How long typing has to settle before a suggestions request is made. */
const SUGGESTION_DEBOUNCE_MS = 150;
const CLOSE_ANIMATION_MS = 130;

/**
 * The header quick search: a global, cross-resource discovery dropdown.
 *
 * This is deliberately NOT the catalogue filter the directory pages use. A
 * directory field narrows records already on the page; this one looks across
 * every public resource and offers a handful of destinations, so it is
 * network-backed, has a minimum query length, and never tries to be a results
 * page — "View all results" and the existing /search route remain the full
 * destination, including for a plain Enter press.
 *
 * The control is an ARIA combobox over a listbox of real anchors: keyboard
 * users move with the arrow keys and open with Enter, pointer users click, and
 * either way the element activated is a link with a real href. The form keeps
 * its GET action so submitting still reaches /search without JavaScript.
 */
export function PublicSiteSearch() {
  const listboxId = useId();
  const optionIdPrefix = useId();

  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<QuickSearchGroup[]>([]);
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef<HTMLFormElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Every request carries a sequence number; only the newest one is allowed
  // to write results, so a slow response for "co" can never overwrite the
  // results for "copper".
  const latestRequest = useRef(0);

  const options = flattenQuickSearchGroups(groups);
  const searchHref = `/search?q=${encodeURIComponent(query.trim())}`;
  const showViewAll = options.length > 0;
  const viewAllIndex = options.length;

  function close() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setActiveIndex(-1);
    if (!open) return;
    setClosing(true);
    closeTimer.current = setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, publicMotionDuration(CLOSE_ANIMATION_MS));
  }

  function openPanel() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setClosing(false);
    setOpen(true);
  }

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  // Debounced fetch. Below the minimum length nothing is requested at all —
  // the results themselves are cleared by the change handler, so this effect
  // only ever performs the request.
  useEffect(() => {
    if (!isQuickSearchQuery(query)) return;

    const controller = new AbortController();
    const requestId = (latestRequest.current += 1);
    const timer = setTimeout(() => {
      fetch(`/api/search/suggestions?q=${encodeURIComponent(query.trim())}`, {
        signal: controller.signal,
      })
        .then((response) => (response.ok ? response.json() : { groups: [] }))
        .then((payload: { groups?: QuickSearchGroup[] }) => {
          if (requestId !== latestRequest.current) return;
          setGroups(payload.groups ?? []);
        })
        .catch(() => {
          // An aborted or failed suggestion request is not worth interrupting
          // anyone over: the field still submits to /search.
          if (requestId === latestRequest.current) setGroups([]);
        });
    }, SUGGESTION_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Clicking anywhere outside closes the panel.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) close();
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  });

  function onChange(value: string) {
    setQuery(value);
    setActiveIndex(-1);
    if (isQuickSearchQuery(value)) {
      openPanel();
      return;
    }
    // Too short to suggest anything: drop what is on screen, and make sure a
    // request already in flight can no longer write into it.
    latestRequest.current += 1;
    setGroups([]);
    close();
  }

  function move(delta: number) {
    const count = options.length + (showViewAll ? 1 : 0);
    if (count === 0) return;
    openPanel();
    setActiveIndex((current) => {
      const next = current + delta;
      if (next < 0) return count - 1;
      if (next >= count) return 0;
      return next;
    });
  }

  /**
   * Opens the highlighted suggestion by clicking its own anchor, so keyboard
   * activation goes through exactly the same link — and the same client-side
   * navigation — a mouse click would. Returns false when nothing is
   * highlighted, letting the form submit to /search instead.
   */
  function openActiveOption(): boolean {
    if (activeIndex < 0) return false;
    const anchor = document.getElementById(optionId(activeIndex));
    if (!anchor) return false;
    close();
    anchor.click();
    return true;
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      move(1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      move(-1);
      return;
    }
    if (event.key === "Escape") {
      if (open) event.preventDefault();
      close();
      return;
    }
    if (event.key === "Enter") {
      // With no active suggestion, Enter falls through to the form's own
      // submit and lands on /search — the documented fallback.
      if (openActiveOption()) event.preventDefault();
    }
  }

  const panelOpen = open && (options.length > 0 || closing);
  const optionId = (index: number) => `${optionIdPrefix}-option-${index}`;

  return (
    <form
      ref={containerRef}
      action="/search"
      method="get"
      role="search"
      aria-label="Site search"
      className="public-search-field public-site-search"
    >
      {/* Icon first, matching the handoff's `.cx-search` markup (svg then
          input) and the directory search field's own order. It stays a real
          submit control so the GET form still works without JavaScript. */}
      <button
        type="submit"
        className="public-site-search-submit"
        aria-label="Search"
      >
        <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <line
            x1="21"
            y1="21"
            x2="16.65"
            y2="16.65"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <input
        type="search"
        name="q"
        aria-label="Search query"
        placeholder="Search the Codex..."
        className="public-site-search-input"
        role="combobox"
        aria-expanded={panelOpen && !closing}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          activeIndex >= 0 && panelOpen ? optionId(activeIndex) : undefined
        }
        autoComplete="off"
        value={query}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        // Focus reopens a panel closed by Escape; click covers the case where
        // the field never lost focus in the first place.
        onFocus={() => {
          if (options.length > 0) openPanel();
        }}
        onClick={() => {
          if (options.length > 0) openPanel();
        }}
      />

      {panelOpen ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Search suggestions"
          className={
            "public-quick-search-panel " +
            (closing ? "public-quick-search-panel--closing" : "cx-quick-search-in")
          }
        >
          {groups.map((group) => (
            <div role="group" aria-label={group.label} key={group.key}>
              <p className="public-quick-search-group-label" aria-hidden="true">
                {group.label}
              </p>
              {group.results.map((result) => {
                const index = options.indexOf(result);
                return (
                  <Link
                    key={result.href}
                    id={optionId(index)}
                    role="option"
                    aria-selected={index === activeIndex}
                    href={result.href}
                    className={
                      "public-quick-search-option" +
                      (index === activeIndex
                        ? " public-quick-search-option--active"
                        : "")
                    }
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => close()}
                  >
                    <span className="public-quick-search-option-name">
                      {result.name}
                    </span>
                    {result.context ? (
                      <span className="public-quick-search-option-context">
                        {result.context}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          ))}

          {showViewAll ? (
            <Link
              id={optionId(viewAllIndex)}
              role="option"
              aria-selected={viewAllIndex === activeIndex}
              href={searchHref}
              className={
                "public-quick-search-all" +
                (viewAllIndex === activeIndex
                  ? " public-quick-search-option--active"
                  : "")
              }
              onMouseEnter={() => setActiveIndex(viewAllIndex)}
              onClick={() => close()}
            >
              View all results for &quot;{query.trim()}&quot;{" "}
              <span aria-hidden="true">→</span>
            </Link>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
