import { SLUG_PATTERN, normalizeSlug } from "@/lib/slug";

// Re-exported so existing imports of normalizeSlug from this module keep
// working unchanged — the canonical implementation now lives in
// src/lib/slug.ts (Phase B1, System B), shared with the client-side slug
// auto-generation preview.
export { normalizeSlug };

export type ProfessionInput = {
  name: string;
  slug: string;
  description: string | null;
};

export type ProfessionValidationError = "missing_name" | "invalid_slug";

export type ProfessionParseResult =
  | { ok: true; value: ProfessionInput }
  | { ok: false; error: ProfessionValidationError };

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
