// Pure parser for the admin Game Version forms, following the same pattern
// as the other validation modules: FormData in, a typed ok/error result
// out, no database or environment access.

const RELEASE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type GameVersionInput = {
  name: string;
  releaseDate: Date | null;
};

export type GameVersionValidationError =
  | "missing_name"
  | "invalid_release_date";

export type GameVersionParseResult =
  | { ok: true; value: GameVersionInput }
  | { ok: false; error: GameVersionValidationError };

/**
 * Parses the release-date value a browser `<input type="date">` submits:
 * an empty string means "no release date" (the field is optional), and a
 * non-empty value must be a real calendar date in YYYY-MM-DD form. The
 * date is anchored to UTC midnight so the stored value never shifts with
 * the server's timezone, and the round-trip check rejects values like
 * 2026-02-31 that JavaScript's Date would otherwise silently roll over.
 */
export function parseReleaseDateInput(
  raw: string
): { ok: true; value: Date | null } | { ok: false } {
  const value = raw.trim();

  if (value === "") {
    return { ok: true, value: null };
  }

  if (!RELEASE_DATE_PATTERN.test(value)) {
    return { ok: false };
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    return { ok: false };
  }

  return { ok: true, value: date };
}

export function parseGameVersionInput(
  formData: FormData
): GameVersionParseResult {
  const name = String(formData.get("name") ?? "").trim();
  const rawReleaseDate = String(formData.get("releaseDate") ?? "");

  if (!name) {
    return { ok: false, error: "missing_name" };
  }

  const releaseDate = parseReleaseDateInput(rawReleaseDate);

  if (!releaseDate.ok) {
    return { ok: false, error: "invalid_release_date" };
  }

  return {
    ok: true,
    value: { name, releaseDate: releaseDate.value },
  };
}

export type GameVersionEditInput = GameVersionInput & {
  description: string | null;
};

export type GameVersionEditParseResult =
  | { ok: true; value: GameVersionEditInput }
  | { ok: false; error: GameVersionValidationError };

/**
 * The Edit Game Version form's own parser: the same name/release-date
 * rules as parseGameVersionInput (never reimplemented — reused directly),
 * plus the optional description only the edit form exposes. Trimmed the
 * same way every other optional-text field in this codebase normalizes
 * (item/location/profession/category description) — .trim() strips only
 * leading/trailing whitespace, so internal line breaks a contributor
 * typed are preserved exactly; an empty or whitespace-only value becomes
 * null, never an empty string, matching the same `value || null` pattern.
 */
export function parseGameVersionEditInput(
  formData: FormData
): GameVersionEditParseResult {
  const base = parseGameVersionInput(formData);

  if (!base.ok) {
    return base;
  }

  const description = String(formData.get("description") ?? "").trim();

  return {
    ok: true,
    value: { ...base.value, description: description || null },
  };
}
