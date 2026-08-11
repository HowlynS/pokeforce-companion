// Real, functional search — a progressively enhanced GET form against the
// existing /search route and its server-side Prisma search
// (src/lib/search/global-search.ts). The Claude Design handoff's header
// search is decorative in the prototype; this one is not.
export function PublicSiteSearch() {
  return (
    <form
      action="/search"
      method="get"
      role="search"
      aria-label="Site search"
      className="public-search-field public-site-search"
    >
      <input
        type="search"
        name="q"
        aria-label="Search query"
        placeholder="Search the Codex..."
        className="public-site-search-input"
      />
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
    </form>
  );
}
