"use client";

type LiveSearchFieldProps = {
  /** Kept as the form's own GET action so the field still works, exactly as
      before, when JavaScript has not loaded. */
  basePath: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  preserve?: Record<string, string | string[] | undefined>;
  ariaLabel?: string;
  submitLabel?: string;
};

const SEARCH_ICON = (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none">
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
);

/**
 * The live replacement for DirectorySearchField.
 *
 * Markup, classes, icon placement, and accessible naming are unchanged — this
 * is an upgrade to the existing `.public-search-field` control, not a new
 * visual system. The only differences are behavioral: the input is controlled
 * by its owning catalogue, and submitting no longer navigates, because the
 * results already updated on the keystroke that produced them. The `<form>`
 * and its GET action stay so the field degrades to the previous
 * server-rendered search when JavaScript is unavailable.
 */
export function LiveSearchField({
  basePath,
  placeholder,
  value,
  onChange,
  preserve,
  ariaLabel,
  submitLabel,
}: LiveSearchFieldProps) {
  const hiddenInputs = Object.entries(preserve ?? {}).flatMap(([key, entry]) => {
    if (Array.isArray(entry)) {
      return entry.map((item, index) => (
        <input key={`${key}-${index}`} type="hidden" name={key} value={item} />
      ));
    }
    return entry ? [<input key={key} type="hidden" name={key} value={entry} />] : [];
  });

  return (
    <form
      action={basePath}
      method="get"
      role="search"
      aria-label={ariaLabel ?? placeholder}
      className="public-search-field directory-search-field"
      onSubmit={(event) => event.preventDefault()}
    >
      {hiddenInputs}
      {submitLabel ? (
        <button
          type="submit"
          className="directory-search-submit"
          aria-label={submitLabel}
        >
          {SEARCH_ICON}
        </button>
      ) : (
        SEARCH_ICON
      )}
      <input
        type="search"
        name="q"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
      />
    </form>
  );
}
