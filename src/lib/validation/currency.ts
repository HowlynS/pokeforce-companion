import { SLUG_PATTERN, normalizeSlug } from "@/lib/slug";

export type CurrencyInput = {
  name: string;
  slug: string;
  symbol: string | null;
  description: string | null;
};

export type CurrencyValidationError = "missing_name" | "invalid_slug";

export type CurrencyParseResult =
  | { ok: true; value: CurrencyInput }
  | { ok: false; error: CurrencyValidationError };

export function parseCurrencyInput(formData: FormData): CurrencyParseResult {
  const name = String(formData.get("name") ?? "").trim();
  const rawSlug = String(formData.get("slug") ?? "").trim();
  const symbol = String(formData.get("symbol") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!name) {
    return { ok: false, error: "missing_name" };
  }

  const slug = normalizeSlug(rawSlug || name);

  if (!slug || !SLUG_PATTERN.test(slug)) {
    return { ok: false, error: "invalid_slug" };
  }

  return {
    ok: true,
    value: {
      name,
      slug,
      symbol: symbol || null,
      description: description || null,
    },
  };
}
