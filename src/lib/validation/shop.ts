import { SLUG_PATTERN, normalizeSlug } from "@/lib/slug";
import {
  parseRichDescriptionInput,
  type RichTextValue,
} from "@/lib/rich-text";

export type ShopInput = {
  name: string;
  slug: string;
  locationId: string;
  description: string | null;
  descriptionRich: RichTextValue | null;
};

export type ShopValidationError =
  | "missing_name"
  | "invalid_slug"
  | "missing_location"
  | "invalid_rich_description";

export type ShopParseResult =
  | { ok: true; value: ShopInput }
  | { ok: false; error: ShopValidationError };

export function parseShopInput(formData: FormData): ShopParseResult {
  const name = String(formData.get("name") ?? "").trim();
  const rawSlug = String(formData.get("slug") ?? "").trim();
  const locationId = String(formData.get("locationId") ?? "").trim();

  if (!name) {
    return { ok: false, error: "missing_name" };
  }

  const slug = normalizeSlug(rawSlug || name);

  if (!slug || !SLUG_PATTERN.test(slug)) {
    return { ok: false, error: "invalid_slug" };
  }

  if (!locationId) {
    return { ok: false, error: "missing_location" };
  }

  const description = parseRichDescriptionInput(formData);
  if (!description.ok) {
    return description;
  }

  return {
    ok: true,
    value: {
      name,
      slug,
      locationId,
      ...description.value,
    },
  };
}
