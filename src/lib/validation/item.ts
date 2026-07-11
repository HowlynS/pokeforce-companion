const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export type ItemInput = {
  name: string;
  slug: string;
  description: string | null;
  rarity: string | null;
  tradeable: boolean;
  baseValue: number | null;
  categoryId: string | null;
};

export type ItemValidationError =
  | "missing_name"
  | "invalid_slug"
  | "invalid_base_value";

export type ItemParseResult =
  | { ok: true; value: ItemInput }
  | { ok: false; error: ItemValidationError };

export function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function parseItemInput(formData: FormData): ItemParseResult {
  const name = String(formData.get("name") ?? "").trim();
  const rawSlug = String(formData.get("slug") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const rarity = String(formData.get("rarity") ?? "").trim();
  const tradeable = formData.get("tradeable") === "on";
  const rawBaseValue = String(formData.get("baseValue") ?? "").trim();
  const rawCategoryId = String(formData.get("categoryId") ?? "").trim();

  if (!name) {
    return { ok: false, error: "missing_name" };
  }

  // Slug is optional in the form; fall back to deriving it from the name.
  const slug = normalizeSlug(rawSlug || name);

  if (!slug || !SLUG_PATTERN.test(slug)) {
    return { ok: false, error: "invalid_slug" };
  }

  let baseValue: number | null = null;

  if (rawBaseValue) {
    const parsedBaseValue = Number(rawBaseValue);

    if (
      !Number.isInteger(parsedBaseValue) ||
      parsedBaseValue < 0 ||
      !Number.isFinite(parsedBaseValue)
    ) {
      return { ok: false, error: "invalid_base_value" };
    }

    baseValue = parsedBaseValue;
  }

  return {
    ok: true,
    value: {
      name,
      slug,
      description: description || null,
      rarity: rarity || null,
      tradeable,
      baseValue,
      categoryId: rawCategoryId || null,
    },
  };
}
