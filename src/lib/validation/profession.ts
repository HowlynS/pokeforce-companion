const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export type ProfessionInput = {
  name: string;
  slug: string;
  description: string | null;
};

export type ProfessionValidationError = "missing_name" | "invalid_slug";

export type ProfessionParseResult =
  | { ok: true; value: ProfessionInput }
  | { ok: false; error: ProfessionValidationError };

export function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function parseProfessionInput(formData: FormData): ProfessionParseResult {
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
