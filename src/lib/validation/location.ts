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

/** The Location General editor's own field set (Slice 9F.3) — everything
    `LocationInput` carries except `parentId`, which now belongs to the
    separate Hierarchy tab. */
export type LocationGeneralInput = Omit<LocationInput, "parentId">;

/** Hierarchy tab's own field set (Slice 9F.3) — nothing but the parent
    assignment. */
export type LocationHierarchyInput = {
  parentId: string | null;
};

export type LocationValidationError =
  | "missing_name"
  | "invalid_slug"
  | "missing_type"
  | "invalid_type";

export type LocationParseResult =
  | { ok: true; value: LocationInput }
  | { ok: false; error: LocationValidationError };

export type LocationGeneralParseResult =
  | { ok: true; value: LocationGeneralInput }
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

function parseParentId(formData: FormData): string | null {
  const rawParentId = String(formData.get("parentId") ?? "").trim();
  return rawParentId || null;
}

// Every field EXCEPT parentId — shared by the full parser (create page,
// which still submits parent selection together) and the General-only
// parser (Slice 9F.3's edit page, which never touches parentId).
// Extracted once so the two callers can never validate these fields
// differently.
function parseLocationGeneralFields(
  formData: FormData
): LocationGeneralParseResult {
  const name = String(formData.get("name") ?? "").trim();
  const rawSlug = String(formData.get("slug") ?? "").trim();
  const rawType = String(formData.get("type") ?? "").trim();
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
      description: description || null,
      accessNote: accessNote || null,
    },
  };
}

/** The Location General editor's own parser (Slice 9F.3): every field
    except parentId, reusing the exact field-by-field validation
    `parseLocationInput` has always used — never a second
    implementation. */
export function parseLocationGeneralInput(
  formData: FormData
): LocationGeneralParseResult {
  return parseLocationGeneralFields(formData);
}

/** The Hierarchy tab's own parser (Slice 9F.3): reuses the exact same
    parentId parsing rule `parseLocationInput` has always used — trim,
    empty means "No parent". Existence and cycle validation happen in the
    action (`wouldCreateLocationCycle`), exactly as they always have —
    never duplicated here. */
export function parseLocationHierarchyInput(
  formData: FormData
): LocationHierarchyInput {
  return { parentId: parseParentId(formData) };
}

export function parseLocationInput(formData: FormData): LocationParseResult {
  const generalResult = parseLocationGeneralFields(formData);

  if (!generalResult.ok) {
    return generalResult;
  }

  return {
    ok: true,
    value: { ...generalResult.value, parentId: parseParentId(formData) },
  };
}
