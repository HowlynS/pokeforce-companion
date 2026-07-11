const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export type CategoryInput = {
  name: string;
  slug: string;
  description: string | null;
};

export type CategoryValidationError = "missing_name" | "invalid_slug";

export type CategoryParseResult =
  | { ok: true; value: CategoryInput }
  | { ok: false; error: CategoryValidationError };

export function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function parseCategoryInput(formData: FormData): CategoryParseResult {
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
