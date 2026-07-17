// Shared searchable record-list column (Slice 9B.3): the quick-switching
// list the future resource workspaces place in AdminWorkspace's
// recordList slot. Resource-agnostic by construction — the CALLER owns
// the database query, the filtering, the row data, and every href (row
// links, create action, search target); this component only renders the
// column: title, create action, search form, optional count, the rows,
// a caller-supplied empty state, and an optional pagination node.
//
// Search is URL-driven, matching the public /search pattern: a plain GET
// form submits the query as a URL parameter (Enter submits from the
// keyboard, no JavaScript required, no request per keystroke), the
// server re-renders with the filtered rows, and a Clear link — rendered
// only while a query is active — returns to the unfiltered list. The
// selected record is marked with aria-current="page", which is
// simultaneously the accessible state and the CSS styling hook (the
// same rule the admin sidebar and editor tabs use).

export type RecordListRow = {
  /** Full link target, constructed by the caller (nested editor routes
      included) — this component never builds routes. Also the row key. */
  href: string;
  /** Primary row label (the record's name). */
  primary: string;
  /** Optional concise secondary context (e.g. a category or type). */
  secondary?: string;
  /** Marks the record currently open in the editor. */
  selected?: boolean;
};

type RecordListProps = {
  /** Visible column title, doubling as the accessible section label. */
  label: string;
  /** GET target for the search form AND the Clear link (the list route
      itself, query-free). */
  searchAction: string;
  /** URL parameter the query submits as. */
  searchParamName?: string;
  /** The currently applied query, preserved in the input. */
  searchValue?: string;
  /** Accessible label for the search input. */
  searchLabel?: string;
  createHref: string;
  createLabel?: string;
  rows: readonly RecordListRow[];
  /** Rendered instead of rows when there are none — the caller decides
      whether that means "no records yet", "no matches", an error, or a
      loading message. */
  empty: React.ReactNode;
  /** Optional result-count line (the caller formats it). */
  countLabel?: string;
  /** Optional pagination node (see RecordListPagination). */
  pagination?: React.ReactNode;
};

export function RecordList({
  label,
  searchAction,
  searchParamName = "q",
  searchValue = "",
  searchLabel = "Search records",
  createHref,
  createLabel = "+ New",
  rows,
  empty,
  countLabel,
  pagination,
}: RecordListProps) {
  return (
    <section aria-label={label} className="admin-record-list">
      <div className="admin-record-list-header">
        <h2 className="admin-panel-title">{label}</h2>
        <a href={createHref} className="btn btn-secondary btn-compact">
          {createLabel}
        </a>
      </div>

      <form
        action={searchAction}
        method="get"
        role="search"
        aria-label={searchLabel}
        className="admin-record-search"
      >
        <input
          type="search"
          name={searchParamName}
          defaultValue={searchValue}
          aria-label={searchLabel}
          placeholder="Search…"
          className="form-input admin-record-search-input"
        />
        <button type="submit" className="btn btn-secondary btn-compact">
          Search
        </button>
      </form>

      {/* Only while a query is applied — an idle list gets no dead
          control. Links back to the query-free list route. */}
      {searchValue ? (
        <a href={searchAction} className="admin-record-clear">
          Clear search
        </a>
      ) : null}

      {countLabel ? <p className="admin-record-count">{countLabel}</p> : null}

      {rows.length > 0 ? (
        <nav aria-label={`${label} records`} className="admin-record-rows">
          <ul className="admin-record-row-list">
            {rows.map((row) => (
              <li key={row.href}>
                <a
                  href={row.href}
                  className="admin-record-link"
                  aria-current={row.selected ? "page" : undefined}
                >
                  <span className="admin-record-primary">{row.primary}</span>
                  {row.secondary ? (
                    <span className="admin-record-secondary">
                      {row.secondary}
                    </span>
                  ) : null}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : (
        <div className="admin-record-empty">{empty}</div>
      )}

      {pagination ?? null}
    </section>
  );
}
