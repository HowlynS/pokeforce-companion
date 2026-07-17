const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Mirrors the Prisma LocationType enum exactly; kept here (not imported from
// the generated client) so this module stays a plain, dependency-free
// parser like the other validation files.
export const LOCATION_TYPES = [
  "REGION",
  "ROUTE",
  "TOWN",
  "BUILDING",
  "DUNGEON",
  "SUB_AREA",
  "SPECIAL_AREA",
] as const;

export type LocationType = (typeof LOCATION_TYPES)[number];

// Admin- and public-facing display labels for each type.
export const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  REGION: "Region",
  ROUTE: "Route",
  TOWN: "Town",
  BUILDING: "Building or interior",
  DUNGEON: "Dungeon",
  SUB_AREA: "Sub-area",
  SPECIAL_AREA: "Special area",
};

export type LocationInput = {
  name: string;
  slug: string;
  type: LocationType;
  parentId: string | null;
  description: string | null;
  accessNote: string | null;
};

export type LocationValidationError =
  | "missing_name"
  | "invalid_slug"
  | "missing_type"
  | "invalid_type";

export type LocationParseResult =
  | { ok: true; value: LocationInput }
  | { ok: false; error: LocationValidationError };

export function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isLocationType(value: string): value is LocationType {
  return (LOCATION_TYPES as readonly string[]).includes(value);
}

export function parseLocationInput(formData: FormData): LocationParseResult {
  const name = String(formData.get("name") ?? "").trim();
  const rawSlug = String(formData.get("slug") ?? "").trim();
  const rawType = String(formData.get("type") ?? "").trim();
  const rawParentId = String(formData.get("parentId") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const accessNote = String(formData.get("accessNote") ?? "").trim();

  if (!name) {
    return { ok: false, error: "missing_name" };
  }

  // Slug is optional in the form; fall back to deriving it from the name.
  const slug = normalizeSlug(rawSlug || name);

  if (!slug || !SLUG_PATTERN.test(slug)) {
    return { ok: false, error: "invalid_slug" };
  }

  if (!rawType) {
    return { ok: false, error: "missing_type" };
  }

  if (!isLocationType(rawType)) {
    return { ok: false, error: "invalid_type" };
  }

  return {
    ok: true,
    value: {
      name,
      slug,
      type: rawType,
      parentId: rawParentId || null,
      description: description || null,
      accessNote: accessNote || null,
    },
  };
}
