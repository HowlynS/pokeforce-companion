// Minimal pagination primitive for the shared record list (Slice 9B.3):
// previous/next links around a caller-formatted page-context label. The
// CALLER builds both hrefs — including carrying the active search
// parameters forward — and simply omits a direction that does not exist,
// which renders as a plainly disabled marker (a non-focusable span with
// aria-disabled), never a fake clickable link. Deliberately nothing
// more: no cursor infrastructure, no page-size controls, no total-page
// arithmetic — those belong to whichever caller ever needs them.

type RecordListPaginationProps = {
  /** Caller-formatted page context (e.g. "Page 2"). */
  context: string;
  /** Link to the previous page, WITH search params preserved by the
      caller; omit on the first page. */
  previousHref?: string;
  /** Link to the next page; omit on the last page. */
  nextHref?: string;
};

export function RecordListPagination({
  context,
  previousHref,
  nextHref,
}: RecordListPaginationProps) {
  return (
    <nav aria-label="Pagination" className="admin-record-pagination">
      {previousHref ? (
        <a href={previousHref} className="btn btn-secondary btn-compact">
          &larr; Previous
        </a>
      ) : (
        <span className="admin-record-page-disabled" aria-disabled="true">
          &larr; Previous
        </span>
      )}

      <span className="admin-record-page-context">{context}</span>

      {nextHref ? (
        <a href={nextHref} className="btn btn-secondary btn-compact">
          Next &rarr;
        </a>
      ) : (
        <span className="admin-record-page-disabled" aria-disabled="true">
          Next &rarr;
        </span>
      )}
    </nav>
  );
}
