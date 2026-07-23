// Shared display-date formatter (Admin Visual/UX Correction pass, Part 9):
// the ONE place every visible calendar date in the app is formatted, so no
// page ever hand-rolls its own date text again. Every visible date renders
// as "DD MMM YYYY" (e.g. "05 Sep 2026") — a two-digit day, a fixed English
// three-letter month abbreviation, and a four-digit year, never a
// locale-dependent numeric format (07/11/2026) and never a raw ISO string
// (2026-07-17) shown to a contributor or visitor.
//
// Every read uses the UTC calendar components (getUTCDate/getUTCMonth/
// getUTCFullYear), never the local ones: this codebase stores date-only
// values (Game Version release date, and every date-only string this
// helper might receive) at UTC midnight specifically so they never shift
// with the server's timezone (see parseReleaseDateInput). Reading those
// same values back with the LOCAL getDate()/getMonth() would re-introduce
// exactly the shift the storage convention exists to prevent, silently
// rendering the previous or next day in any timezone west or east of UTC.
// A full timestamp (createdAt/updatedAt/verifiedAt) is a real moment in
// time, not a date-only value — but using UTC components for it too keeps
// this one helper's output deterministic regardless of the server's own
// local timezone, which is exactly what the codebase's prior per-page
// `toISOString().slice(0, 10)` convention already guaranteed.

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

export type FormattableDate = Date | string | null | undefined;

/**
 * Formats a calendar date as "DD MMM YYYY" (e.g. "05 Sep 2026"). Accepts a
 * `Date`, an ISO timestamp string, or a date-only "YYYY-MM-DD" string —
 * `new Date(...)` parses a bare date-only string as UTC midnight already,
 * so reading it back with UTC components round-trips exactly, with no
 * timezone-driven day shift either direction.
 *
 * Returns `null` for a missing (`null`/`undefined`) or unparseable value —
 * callers apply the existing hide-empty convention (omit the row/section
 * entirely) or their own explicit fallback ("—"), matching how every
 * existing optional-date row in this codebase already behaves.
 */
export function formatDisplayDate(value: FormattableDate): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const date = typeof value === "string" ? new Date(value) : value;

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = MONTH_ABBREVIATIONS[date.getUTCMonth()];
  const year = date.getUTCFullYear();

  return `${day} ${month} ${year}`;
}
