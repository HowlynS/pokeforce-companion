"use client";

// Shared searchable record-list column (Slice 9B.3; converted to instant
// client-side filtering in Phase B1, System A). The caller (each resource's
// thin *Workspace wrapper) still owns the database query and every row's
// href/image — this component now also owns the interactive filtering
// itself, since Phase B1 replaced submit-based server search with immediate
// local filtering over the complete, already-fetched list (no pagination,
// no per-keystroke request).
//
// Filtering matches a row's name (primary) or Page address (slug) only,
// case-insensitively, via the pure src/lib/admin/record-list-filter.ts
// helpers — never descriptions or other heavyweight fields. Because the
// full row set is already on the client, filtering itself is synchronous
// and instant; only the address bar's own `q` parameter is synchronized,
// with a short debounce so typing doesn't flood browser history.
//
// That sync deliberately uses the raw window.history.replaceState API
// rather than next/navigation's router: a router.replace to the same
// force-dynamic route re-runs the page's Server Component (a real
// server round trip and, on the edit route, a re-render of the whole
// workspace including the open editor) purely because the URL's search
// string changed — exactly what this feature must NOT do while someone is
// only filtering the sidebar list. There is no existing shallow-routing
// precedent elsewhere in this codebase to defer to (the only other client
// component reading routing state, AdminNav, only READS the pathname via
// usePathname(), it never writes to the URL) — this is deliberately new,
// narrowly-scoped surface area, not a deviation from an established
// pattern. Writing the URL directly keeps the address bar, the existing
// history entry's own state object (passed through unchanged, never
// replaced with null), and any hash fragment all intact, and is read back
// via the native `popstate` event on Back/Forward — with zero navigation/
// refetch and never a new history entry per keystroke (replaceState, never
// pushState). Every actual navigation this list participates in (a row
// link, the create link, AdminNav's own next/link sidebar entries) is
// either a full document load or a transition to a genuinely different
// route, so this component always remounts fresh reading the already-
// synced `q` back out of the (already-correct) address bar — popstate
// itself is a defensive backstop for same-document history motion, not
// the primary mechanism Back/Forward correctness relies on here. The
// selected record is marked with aria-current="page", simultaneously the
// accessible state and the CSS styling hook (the same rule the admin
// sidebar and editor tabs use) — unaffected by filtering, since a selected
// row that no longer matches the filter simply disappears from view
// rather than losing its state, and the editor stays exactly as it was.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildSyncedListUrl,
  filterRecordRows,
  formatRecordCount,
  withUpdatedSearchParam,
  type RecordListNoun,
} from "@/lib/admin/record-list-filter";

const URL_SYNC_DEBOUNCE_MS = 300;

export type RecordListRow = {
  /** Full link target, constructed by the caller (nested editor routes
      included) — this component never builds routes, only rewrites the
      href's own search-param value as the live filter changes. Also the
      row key. */
  href: string;
  /** Primary row label (the record's name) — also matched against the
      filter. */
  primary: string;
  /** The record's Page address — matched against the filter, but not
      necessarily displayed as its own row text. */
  slug: string;
  /** Optional additional values matched against the filter alongside name
      and slug — e.g. Location's own type label. Never a description or
      other heavyweight field; omitted entirely by resources with no such
      existing, genuinely useful short metadata. Not itself displayed —
      pair with `secondary` (below) when the same value should also be
      shown. */
  searchTerms?: readonly string[];
  /** Optional concise secondary context (e.g. a category or type). */
  secondary?: string;
  /** Marks the record currently open in the editor. */
  selected?: boolean;
  /** Resolved public image URL for image-capable lists (already
      converted by the caller via getImagePublicUrl — this component
      never resolves storage paths itself). Null/undefined renders the
      fixed-size fallback slot. Ignored unless the list's own
      `showImages` is set. */
  image?: string | null;
};

type RecordListProps = {
  /** Visible column title, doubling as the accessible section label. */
  label: string;
  /** The list's own route (query-free) — the address bar is synchronized
      against this pathname as the filter changes. */
  listPath: string;
  /** URL parameter the filter is synchronized to. */
  searchParamName?: string;
  /** The query already applied at first render (from the page's own
      ?q=), seeding the client filter state — every row's href already
      carries this same value, so the first client render matches the
      server-rendered markup exactly (no hydration mismatch). */
  initialQuery?: string;
  /** Accessible label for the filter input. */
  searchLabel?: string;
  /** Static create-page href; rewritten live to carry the current filter
      the same way each row's own href is. */
  createHref: string;
  createLabel?: string;
  /** The COMPLETE, unfiltered row set — filtering happens locally over
      this array, never a server round trip. */
  rows: readonly RecordListRow[];
  /** Singular/plural noun for the total-vs-filtered count line, e.g.
      { singular: "item", plural: "items" }. */
  noun: RecordListNoun;
  /** Rendered instead of rows only when the resource truly has none at
      all (never for a filter that simply matched nothing — that gets its
      own compact, distinct message). */
  empty: React.ReactNode;
  /** List-level image-capable mode: every row reserves the same fixed
      64×64 media slot (populated or the missing-image fallback), rather
      than each row deciding its own layout from whether it happens to
      have an image. All five converted resources (Items, Recipes,
      Professions, Categories, Locations) now set this; the original
      text-only row remains supported for any resource without an image
      field. */
  showImages?: boolean;
};

export function RecordList({
  label,
  listPath,
  searchParamName = "q",
  initialQuery = "",
  searchLabel = "Search records",
  createHref,
  createLabel = "+ New",
  rows,
  noun,
  empty,
  showImages = false,
}: RecordListProps) {
  const [query, setQuery] = useState(initialQuery);
  const inputRef = useRef<HTMLInputElement>(null);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trimmedQuery = query.trim();
  const hasQuery = trimmedQuery !== "";

  // Back/Forward: the native popstate event fires when the user navigates
  // history without this component itself having changed anything — read
  // the filter parameter straight back out of the address bar and
  // resynchronize the input and the filtered list.
  useEffect(() => {
    function handlePopState() {
      const fromUrl =
        new URLSearchParams(window.location.search).get(searchParamName) ??
        "";
      setQuery(fromUrl);
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [searchParamName]);

  // Debounced address-bar sync only — the visible filtering above is
  // already instant on every keystroke via the `query` state itself;
  // nothing here can be experienced as request latency. Writing the URL
  // directly (see file header) never triggers a server round trip.
  useEffect(() => {
    if (syncTimer.current) {
      clearTimeout(syncTimer.current);
    }

    syncTimer.current = setTimeout(() => {
      const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const nextUrl = buildSyncedListUrl(
        window.location.pathname || listPath,
        new URLSearchParams(window.location.search),
        searchParamName,
        trimmedQuery,
        window.location.hash
      );

      if (nextUrl !== currentUrl) {
        // The second argument ("" here) is the now-unused `title` history
        // API parameter, not this call's own state — the FIRST argument,
        // window.history.state, is passed straight through unchanged, so
        // any state a future feature stores there is never clobbered by
        // this sync.
        window.history.replaceState(window.history.state, "", nextUrl);
      }
    }, URL_SYNC_DEBOUNCE_MS);

    return () => {
      if (syncTimer.current) {
        clearTimeout(syncTimer.current);
      }
    };
  }, [trimmedQuery, searchParamName, listPath]);

  const filteredRows = useMemo(
    () => filterRecordRows(rows, trimmedQuery),
    [rows, trimmedQuery]
  );

  // Each row's own href (and the create link) already carries the QUERY
  // that was active when the server rendered it; rewriting that one
  // parameter to the live-typed value keeps navigation targets correct
  // while filtering, without waiting for the debounced address-bar sync.
  const effectiveRows = useMemo(
    () =>
      filteredRows.map((row) => ({
        ...row,
        href: withUpdatedSearchParam(row.href, searchParamName, trimmedQuery),
      })),
    [filteredRows, searchParamName, trimmedQuery]
  );

  const effectiveCreateHref = useMemo(
    () => withUpdatedSearchParam(createHref, searchParamName, trimmedQuery),
    [createHref, searchParamName, trimmedQuery]
  );

  const countLabel = formatRecordCount(rows.length, filteredRows.length, hasQuery, noun);

  function handleClear() {
    setQuery("");
    inputRef.current?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape" && query !== "") {
      event.preventDefault();
      handleClear();
    }
    // No <form> wraps this input, so Enter has nothing to submit; no
    // explicit handling is needed to keep it from navigating or reloading.
  }

  return (
    <section aria-label={label} className="admin-record-list">
      <div className="admin-record-list-header">
        <h2 className="admin-record-list-title">{label}</h2>
        <a href={effectiveCreateHref} className="btn btn-primary btn-compact">
          {createLabel}
        </a>
      </div>

      <div role="search" aria-label={searchLabel} className="admin-record-search">
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          aria-label={searchLabel}
          placeholder="Filter records…"
          className="form-input admin-record-search-input"
        />
        {hasQuery ? (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search"
            className="admin-record-clear"
          >
            &times;
          </button>
        ) : null}
      </div>

      <p className="admin-record-count">{countLabel}</p>

      {rows.length === 0 ? (
        <div className="admin-record-empty">{empty}</div>
      ) : effectiveRows.length === 0 ? (
        <div className="admin-record-empty">
          <p>No matching records.</p>
        </div>
      ) : (
        <nav aria-label={`${label} records`} className="admin-record-rows">
          <ul className="admin-record-row-list">
            {effectiveRows.map((row) => (
              <li key={row.slug}>
                <a
                  href={row.href}
                  className={
                    showImages
                      ? "admin-record-link admin-record-link-media"
                      : "admin-record-link"
                  }
                  aria-current={row.selected ? "page" : undefined}
                >
                  {showImages ? (
                    <span
                      className={
                        row.image
                          ? "admin-record-thumb-wrap"
                          : "admin-record-thumb-wrap admin-record-thumb-empty"
                      }
                      aria-hidden={row.image ? undefined : true}
                    >
                      {row.image ? (
                        // eslint-disable-next-line @next/next/no-img-element -- admin-only thumbnail; matches the existing ImagePanel preview convention (plain <img>, no next/image optimization pipeline)
                        <img
                          src={row.image}
                          alt=""
                          className="admin-record-thumb-img"
                        />
                      ) : null}
                    </span>
                  ) : null}
                  {showImages ? (
                    <span className="admin-record-text">
                      <span className="admin-record-primary">
                        {row.primary}
                      </span>
                      {row.secondary ? (
                        <span className="admin-record-secondary">
                          {row.secondary}
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    <>
                      <span className="admin-record-primary">
                        {row.primary}
                      </span>
                      {row.secondary ? (
                        <span className="admin-record-secondary">
                          {row.secondary}
                        </span>
                      ) : null}
                    </>
                  )}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </section>
  );
}
