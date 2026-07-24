// Shared success-message dictionary (Admin Polish Pass 2, Part 3) — the
// single source of truth for every toast message a successful admin
// mutation can show. A flat, namespaced code (e.g. "item_saved") is the
// only thing ever placed in a redirect's `?success=` query value; the
// actual human-readable text lives here, in exactly one place, so no
// page or server action ever hard-codes a message string. Kept flat and
// case-by-case, deliberately not generated from a resource/verb pair —
// several entries (the `_image_cleanup` variants, "Ingredients saved",
// "Hierarchy saved") don't follow the plain "{Resource} {verb}" shape
// closely enough to make a generator worthwhile, and this table is the
// simplest thing that reads correctly for all of them.
export const ADMIN_SUCCESS_MESSAGES = {
  item_created: "Item created",
  item_saved: "Item saved",
  item_saved_image_cleanup:
    "Item saved, but the previous image file could not be removed from storage and may need manual cleanup in Supabase.",
  item_deleted: "Item deleted",
  item_deleted_image_cleanup:
    "Item deleted, but its image file could not be removed from storage and may need manual cleanup in Supabase.",

  recipe_created: "Recipe created",
  recipe_saved: "Recipe saved",
  recipe_saved_image_cleanup:
    "Recipe saved, but the previous image file could not be removed from storage and may need manual cleanup in Supabase.",
  recipe_deleted: "Recipe deleted",
  recipe_deleted_image_cleanup:
    "Recipe deleted, but its image file could not be removed from storage and may need manual cleanup in Supabase.",
  ingredients_saved: "Ingredients saved",

  profession_created: "Profession created",
  profession_saved: "Profession saved",
  profession_saved_image_cleanup:
    "Profession saved, but the previous image file could not be removed from storage and may need manual cleanup in Supabase.",
  profession_deleted: "Profession deleted",
  profession_deleted_image_cleanup:
    "Profession deleted, but its image file could not be removed from storage and may need manual cleanup in Supabase.",

  category_created: "Category created",
  category_saved: "Category saved",
  category_saved_image_cleanup:
    "Category saved, but the previous image file could not be removed from storage and may need manual cleanup in Supabase.",
  category_deleted: "Category deleted",
  category_deleted_image_cleanup:
    "Category deleted, but its image file could not be removed from storage and may need manual cleanup in Supabase.",

  location_created: "Location created",
  location_saved: "Location saved",
  location_saved_image_cleanup:
    "Location saved, but the previous image file could not be removed from storage and may need manual cleanup in Supabase.",
  location_deleted: "Location deleted",
  location_deleted_image_cleanup:
    "Location deleted, but its image file could not be removed from storage and may need manual cleanup in Supabase.",
  hierarchy_saved: "Hierarchy saved",

  source_created: "Acquisition source created",
  source_saved: "Acquisition source saved",
  source_deleted: "Acquisition source deleted",

  game_version_deleted: "Game version deleted",
} as const;

export type AdminSuccessCode = keyof typeof ADMIN_SUCCESS_MESSAGES;

/** Looks up the display message for a `?success=` code. Returns null for
    an absent, empty, or unrecognized code — an unrecognized code is
    treated as "no toast," never a fallback/generic message, since a
    stray or mistyped code should be silently harmless rather than show
    something misleading. */
export function adminSuccessMessage(
  code: string | null | undefined
): string | null {
  if (!code) {
    return null;
  }
  return Object.prototype.hasOwnProperty.call(ADMIN_SUCCESS_MESSAGES, code)
    ? ADMIN_SUCCESS_MESSAGES[code as AdminSuccessCode]
    : null;
}

/** Pure string transform: strips the `success` key from a query string
    (as returned by URLSearchParams#toString / next/navigation's
    useSearchParams), returning either "?remaining=params" or "" when
    nothing is left — never a bare "?". Every other param (e.g. the
    record list's own `q` filter) is preserved untouched. Used by
    AdminSuccessToast to consume the flash param via the raw History API
    rather than next/navigation's router, mirroring RecordList's own
    established reasoning (src/components/admin/record-list.tsx): a
    same-document query-string cleanup must never trigger another
    server round trip / full workspace re-render on these force-dynamic
    admin routes. */
export function removeSuccessParam(search: string): string {
  const params = new URLSearchParams(search);
  params.delete("success");
  const remaining = params.toString();
  return remaining ? `?${remaining}` : "";
}
