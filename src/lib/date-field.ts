// Pure parser/formatter for the shared DateField component (Admin
// Visual/UX Correction pass, Part 10) — no React, no DOM, fully
// unit-testable in isolation. The visible text a contributor types or
// reads is always "DD MMM YYYY" (e.g. "05 Sep 2026"): an unambiguous
// format that never depends on the browser's locale, unlike a native
// `<input type="date">`'s locale-formatted numeric display (dd/mm/yyyy vs
// mm/dd/yyyy) or a raw ISO string. The value actually submitted to the
// server stays the codebase's existing normalized ISO "YYYY-MM-DD"
// date-only convention (parseReleaseDateInput's own input shape) — this
// module never changes what a server action receives for a VALID date.

const MONTH_ABBREVIATIONS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const MONTH_INDEX_BY_ABBREVIATION: Record<string, number> = Object.fromEntries(
  MONTH_ABBREVIATIONS.map((abbreviation, index) => [
    abbreviation.toLowerCase(),
    index,
  ])
);

const ENTRY_PATTERN = /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/;
const ISO_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(monthIndex: number, year: number): number {
  const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (monthIndex === 1) {
    return isLeapYear(year) ? 29 : 28;
  }
  return DAYS[monthIndex];
}

export type DateEntryParseResult =
  | { ok: true; iso: string | null }
  | { ok: false };

/**
 * Parses the visible "DD MMM YYYY" text a contributor typed. Blank input
 * (after trimming) is a valid, deliberate "no date" answer for an optional
 * field — `{ ok: true, iso: null }` — never an error. Month abbreviations
 * are matched case-insensitively ("sep", "Sep", "SEP" all accept) and the
 * canonical capitalization is always what re-formatting produces, so
 * capitalization is normalized rather than preserved. Rejects malformed
 * text (wrong shape, unknown month) and impossible calendar dates (31 Feb,
 * 31 Apr) rather than silently rolling them over the way `Date` would.
 */
export function parseDateEntryText(raw: string): DateEntryParseResult {
  const trimmed = raw.trim();

  if (trimmed === "") {
    return { ok: true, iso: null };
  }

  const match = ENTRY_PATTERN.exec(trimmed);

  if (!match) {
    return { ok: false };
  }

  const [, dayText, monthText, yearText] = match;
  const monthIndex = MONTH_INDEX_BY_ABBREVIATION[monthText.toLowerCase()];

  if (monthIndex === undefined) {
    return { ok: false };
  }

  const day = Number(dayText);
  const year = Number(yearText);
  const maxDay = daysInMonth(monthIndex, year);

  if (day < 1 || day > maxDay) {
    return { ok: false };
  }

  const iso = `${String(year).padStart(4, "0")}-${String(
    monthIndex + 1
  ).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  return { ok: true, iso };
}

/**
 * Formats a normalized ISO "YYYY-MM-DD" date-only string as the visible
 * "DD MMM YYYY" text — the inverse of parseDateEntryText for a valid
 * date. A null/undefined/blank/malformed input formats to "" (an empty
 * field), matching the optional-field convention throughout this
 * component.
 */
export function formatIsoToDateEntryText(
  iso: string | null | undefined
): string {
  if (!iso) {
    return "";
  }

  const match = ISO_PATTERN.exec(iso);

  if (!match) {
    return "";
  }

  const [, yearText, monthText, dayText] = match;
  const monthIndex = Number(monthText) - 1;

  if (monthIndex < 0 || monthIndex > 11) {
    return "";
  }

  return `${dayText} ${MONTH_ABBREVIATIONS[monthIndex]} ${yearText}`;
}
