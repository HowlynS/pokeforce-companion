import { SLUG_PATTERN, normalizeSlug } from "@/lib/slug";

export type PlayerClassInput = {
  name: string;
  slug: string;
  description: string | null;
};

export type PlayerClassValidationError = "missing_name" | "invalid_slug";

export type PlayerClassParseResult =
  | { ok: true; value: PlayerClassInput }
  | { ok: false; error: PlayerClassValidationError };

/** Mirrors parseProfessionInput exactly — the same field set (name, slug,
    optional description), the same slug-from-name fallback, the same
    validation rules. PlayerClass carries no fields Profession doesn't
    already have. */
export function parsePlayerClassInput(
  formData: FormData
): PlayerClassParseResult {
  const name = String(formData.get("name") ?? "").trim();
  const rawSlug = String(formData.get("slug") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!name) {
    return { ok: false, error: "missing_name" };
  }

  // Slug is optional in the form; fall back to deriving it from the name.
  const slug = normalizeSlug(rawSlug || name);

  if (!slug || !SLUG_PATTERN.test(slug)) {
    return { ok: false, error: "invalid_slug" };
  }

  return {
    ok: true,
    value: {
      name,
      slug,
      description: description || null,
    },
  };
}
