// The ONE canonical slug rule for the whole application (Phase B1, System
// B): every resource's server-side validator (src/lib/validation/*.ts)
// previously declared its own byte-identical copy of this pattern and
// function. Extracted here so the client-side auto-generation preview
// (RecordSlugField) can share the exact same rule the server enforces —
// "do not invent a client slug algorithm that disagrees with the server
// parser." Pure string logic only, so this file is safe to import from
// both a "use client" component and server code alike.

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Lowercases, replaces any run of non-alphanumeric characters with a
 * single hyphen, and trims leading/trailing hyphens. The result either
 * matches SLUG_PATTERN or is the empty string — there is no other
 * possible outcome, since every character that could violate the pattern
 * is collapsed away by construction.
 */
export function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
