"use client";

import { Fragment, useState, type ReactNode } from "react";
import { CatalogueViewSwitch } from "@/components/content/catalogue-view-switch";
import { LiveFilterResetProvider } from "@/components/content/live-filter-reset";
import { LiveSearchField } from "@/components/content/live-search-field";
import { useReportLiveMatchCount } from "@/components/content/live-match-count";
import { cataloguePageHref } from "@/lib/catalogue-query";
import {
  filterLiveEntries,
  normalizeLiveQuery,
  resolveLivePageWindow,
  shouldResetLivePage,
  type LiveFilterEntry,
} from "@/lib/search/live-filter";
import {
  useLiveQueryState,
  useLiveQuerySync,
} from "@/lib/search/use-live-query-sync";

/** One catalogue record, pre-rendered by the server in both layouts. */
export type DirectoryEntry = LiveFilterEntry & {
  grid: ReactNode;
  list: ReactNode;
};

/**
 * The structural wrapper one layout needs. Every value is a plain string or a
 * pre-rendered node, so a resource with a richer shape than "cards in a div"
 * (the Recipe catalogue's own section and list heading) is expressed as data
 * rather than by forking this component.
 */
export type DirectoryShell = {
  containerClassName: string;
  sectionClassName?: string;
  sectionAriaLabel?: string;
  /** Added to sectionClassName when exactly one record is visible. */
  sparseClassName?: string;
  header?: ReactNode;
};

type DirectorySearchConfig = {
  basePath: string;
  placeholder: string;
  ariaLabel?: string;
  submitLabel?: string;
  initialQuery: string;
  /** Non-search parameters that must survive in the URL (category/profession
      filters). Also used for the no-JS form's hidden inputs. */
  preserve?: Record<string, string | string[] | undefined>;
};

type DirectoryViewToggleProps = {
  search: DirectorySearchConfig;
  /** Filter popover and any other toolbar control, rendered beside the field. */
  toolbarExtra?: ReactNode;
  entries: DirectoryEntry[];
  gridShell: DirectoryShell;
  listShell: DirectoryShell;
  /** Omitted by the catalogues that have never paginated (Professions,
      Classes); those render every match on one page, exactly as before. */
  pageSize?: number;
  initialPage?: number;
  paginationLabel?: string;
  /** The page's own "nothing matched your search" state, shown live. */
  emptyState: ReactNode;
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

function renderShell(
  shell: DirectoryShell,
  entries: DirectoryEntry[],
  layout: "grid" | "list",
): ReactNode {
  const body = (
    <>
      {shell.header}
      <div className={shell.containerClassName}>
        {/* The entry's own key is applied here rather than trusted from the
            server-created element, so every caller gets stable identity —
            which is also what keeps filtering from re-running each surviving
            card's entrance animation. */}
        {entries.map((entry) => (
          <Fragment key={entry.key}>{entry[layout]}</Fragment>
        ))}
      </div>
    </>
  );

  if (!shell.sectionClassName) return body;

  const className =
    shell.sparseClassName && entries.length === 1
      ? `${shell.sectionClassName} ${shell.sparseClassName}`
      : shell.sectionClassName;

  return (
    <section className={className} aria-label={shell.sectionAriaLabel}>
      {body}
    </section>
  );
}

/**
 * The directory toolbar (live search + filters on the left, Grid/List toggle
 * on the right) and the card content below it.
 *
 * The catalogue's records are all rendered server-side, in both layouts, and
 * passed in as `entries`; this component decides which of them are VISIBLE.
 * That is what makes the search live: typing filters an array that is already
 * in memory, so results change on the keystroke rather than after a form
 * submission and a server render. The server still applies every other filter
 * (category, profession) and still reads `?q=` on a cold load, so a shared or
 * reloaded URL renders the same filtered page before hydration — this
 * component's own first render applies the same query, so there is no flash of
 * unfiltered content.
 *
 * View mode, search text, and page index are all local state here, so none of
 * them remount the toolbar or each other. The keyed CatalogueViewSwitch below
 * is untouched: a Grid/List switch still replays the entrance choreography,
 * while filtering reuses the same keyed nodes and therefore does not.
 */
export function DirectoryViewToggle({
  search,
  toolbarExtra,
  entries,
  gridShell,
  listShell,
  pageSize = Number.POSITIVE_INFINITY,
  initialPage = 1,
  paginationLabel = "Pagination",
  emptyState,
}: DirectoryViewToggleProps) {
  const [mode, setMode] = useState<"grid" | "list">("grid");
  const [query, setQuery, reseeded] = useLiveQueryState(search.initialQuery);
  const [page, setPage] = useState(initialPage);
  if (reseeded && page !== initialPage) setPage(initialPage);

  const visible = filterLiveEntries(entries, normalizeLiveQuery(query));
  const { currentPage, pageCount, start, end } = resolveLivePageWindow(
    page,
    visible.length,
    pageSize,
  );
  const pageEntries = visible.slice(start, end);
  useReportLiveMatchCount(visible.length);

  useLiveQuerySync({
    basePath: search.basePath,
    query,
    page: currentPage,
    params: search.preserve,
  });

  function onQueryChange(next: string) {
    // A materially different search describes a different result set, so the
    // old page index is meaningless — go back to the first page.
    if (shouldResetLivePage(query, next)) setPage(1);
    setQuery(next);
  }

  function pageHref(target: number) {
    return cataloguePageHref(search.basePath, target, {
      ...search.preserve,
      q: query.trim() || undefined,
    });
  }

  return (
    <LiveFilterResetProvider reset={() => onQueryChange("")}>
      <div className="directory-toolbar">
        <div className="directory-toolbar-left">
          <LiveSearchField
            basePath={search.basePath}
            placeholder={search.placeholder}
            ariaLabel={search.ariaLabel}
            submitLabel={search.submitLabel}
            value={query}
            onChange={onQueryChange}
            preserve={search.preserve}
          />
          {toolbarExtra}
        </div>
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

      {pageEntries.length > 0 ? (
        <CatalogueViewSwitch
          mode={mode}
          grid={renderShell(gridShell, pageEntries, "grid")}
          list={renderShell(listShell, pageEntries, "list")}
        />
      ) : (
        emptyState
      )}

      {pageCount > 1 ? (
        <nav className="public-catalogue-pagination" aria-label={paginationLabel}>
          {currentPage > 1 ? (
            <a
              href={pageHref(currentPage - 1)}
              onClick={(event) => {
                event.preventDefault();
                setPage(currentPage - 1);
              }}
            >
              Previous
            </a>
          ) : (
            <span aria-disabled="true">Previous</span>
          )}
          <span>
            Page {currentPage} of {pageCount}
          </span>
          {currentPage < pageCount ? (
            <a
              href={pageHref(currentPage + 1)}
              onClick={(event) => {
                event.preventDefault();
                setPage(currentPage + 1);
              }}
            >
              Next
            </a>
          ) : (
            <span aria-disabled="true">Next</span>
          )}
        </nav>
      ) : null}
    </LiveFilterResetProvider>
  );
}
