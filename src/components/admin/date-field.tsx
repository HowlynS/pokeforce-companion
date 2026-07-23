"use client";

// Shared unambiguous date-entry field (Admin Visual/UX Correction pass,
// Part 10): replaces a native `<input type="date">`, whose visible
// numeric ordering (dd/mm/yyyy vs mm/dd/yyyy) depends on the browser's own
// locale — a contributor has no reliable way to know which digit is the
// day without checking. This field's visible text is always "DD MMM YYYY"
// (e.g. "05 Sep 2026"): a fixed, locale-independent format, exactly the
// same one every OTHER visible date in the app now renders through
// formatDisplayDate (src/lib/format-date.ts) — a contributor never sees
// two different date conventions across the admin surface.
//
// A plain accessible text input, not a custom listbox/combobox widget —
// deliberately NOT the general custom dropdown/calendar-picker framework
// out of scope for this pass; a compact calendar affordance was
// considered but skipped as genuinely optional per the brief ("acceptable
// only if... do not implement the entire framework merely for this
// field"), so this stays a focused, reusable field component.
//
// Submits its OWN hidden `name` field carrying the value server actions
// already expect (parseReleaseDateInput's own contract): "" for a blank/
// optional date, normalized "YYYY-MM-DD" for a successfully parsed date.
// Malformed (non-blank, unparseable) text is submitted VERBATIM instead of
// being silently coerced to blank — this deliberately makes the existing
// server-side pattern check reject it with its existing invalid_release_date
// error, rather than this field quietly discarding a typo as "no date".
// No timezone conversion anywhere: parsing/formatting works entirely on
// the DD/MMM/YYYY digits themselves, never through a `Date` object (which
// would round-trip through the runtime's local timezone).

import { useEffect, useId, useRef, useState } from "react";
import {
  formatIsoToDateEntryText,
  parseDateEntryText,
} from "@/lib/date-field";
import { dispatchFormChange } from "@/lib/admin/form-change-event";

type DateFieldProps = {
  /** The form field name the normalized ISO value submits as. */
  name: string;
  /** Visible field label. */
  label: string;
  /** The persisted value, as normalized ISO "YYYY-MM-DD", or null/undefined
      for no date yet (a blank field). */
  defaultValue?: string | null;
};

export function DateField({ name, label, defaultValue }: DateFieldProps) {
  const fieldId = useId();
  const helperId = `${fieldId}-helper`;
  const errorId = `${fieldId}-error`;

  const [text, setText] = useState(() =>
    formatIsoToDateEntryText(defaultValue ?? null)
  );
  const [touched, setTouched] = useState(false);

  const parsed = parseDateEntryText(text);
  const showError = touched && !parsed.ok;
  // A malformed (non-blank) value is submitted AS-IS so the server's own
  // pattern check rejects it with the existing error — never silently
  // coerced to "" (which would read as "no date" instead of "invalid
  // date").
  const submittedValue = parsed.ok ? parsed.iso ?? "" : text;

  // The hidden <input> that actually submits. The visible text input has no
  // `name`, so its own native input event carries no form value; the value
  // the guard must see lives here and is updated by React (no native
  // event). Emit the shared form-change signal whenever the SUBMITTED value
  // changes so the AdminFormGuard's dirty detection is deterministic rather
  // than reliant on a timed recompute. See form-change-event.ts.
  const hiddenRef = useRef<HTMLInputElement>(null);
  const dateMountedRef = useRef(false);
  useEffect(() => {
    if (!dateMountedRef.current) {
      dateMountedRef.current = true;
      return;
    }
    dispatchFormChange(hiddenRef.current);
  }, [submittedValue]);

  return (
    <div className="form-field">
      <label className="form-field">
        <span className="form-field-label">{label}</span>
        <input
          id={fieldId}
          type="text"
          inputMode="text"
          autoComplete="off"
          placeholder="DD MMM YYYY"
          className="form-input"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onBlur={() => setTouched(true)}
          aria-describedby={`${helperId} ${errorId}`}
        />
      </label>

      <p id={helperId} className="form-field-helper">
        Format: DD MMM YYYY (e.g. 05 Sep 2026)
      </p>

      {/* Always rendered (never conditionally mounted), matching every
          other live feedback row in this codebase (e.g.
          RecordSlugField's own .form-field-feedback): min-height on
          .form-field-feedback reserves the same vertical space whether
          or not an error is currently showing, so the error appearing
          on blur never shifts the submit button (or anything else)
          below it — a real layout-stability concern for sighted users,
          not just an artifact this pass noticed through flaky
          click-timing in its own E2E coverage. */}
      <p
        id={errorId}
        role={showError ? "alert" : undefined}
        className="form-field-feedback text-danger"
      >
        {showError
          ? "Enter a valid date as DD MMM YYYY, e.g. 05 Sep 2026."
          : ""}
      </p>

      <input ref={hiddenRef} type="hidden" name={name} value={submittedValue} />
    </div>
  );
}
