// Real, server-side name search for a directory page — a progressively
// enhanced GET form (works with JS disabled), matching the header
// search's own real/non-decorative precedent (Slice 2). Preserved query
// params (e.g. an active category filter) are carried as hidden inputs
// so submitting a new search doesn't drop the current filter.
type DirectorySearchFieldProps = {
  basePath: string;
  placeholder: string;
  defaultValue?: string;
  preserve?: Record<string, string | string[] | undefined>;
  ariaLabel?: string;
  submitLabel?: string;
};

export function DirectorySearchField({
  basePath,
  placeholder,
  defaultValue,
  preserve,
  ariaLabel,
  submitLabel,
}: DirectorySearchFieldProps) {
  const hiddenInputs = Object.entries(preserve ?? {}).flatMap(
    ([key, value]) => {
      if (Array.isArray(value)) {
        return value.map((entry, index) => (
          <input key={`${key}-${index}`} type="hidden" name={key} value={entry} />
        ));
      }
      return value ? [<input key={key} type="hidden" name={key} value={value} />] : [];
    },
  );

  return (
    <form
      action={basePath}
      method="get"
      role="search"
      aria-label={ariaLabel ?? placeholder}
      className="public-search-field directory-search-field"
    >
      {hiddenInputs}
      {submitLabel ? (
        <button
          type="submit"
          className="directory-search-submit"
          aria-label={submitLabel}
        >
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      ) : (
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )}
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
      />
    </form>
  );
}
