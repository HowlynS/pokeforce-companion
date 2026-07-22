"use server";

import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import {
  MAX_RECORD_SLUG_LENGTH,
  isItemSlugTaken,
  normalizeRecordSlugCandidate,
  type RecordSlugAvailability,
} from "@/lib/admin/record-slug";

/**
 * Read-only availability probe for the Item Page address field, invoked
 * from the client while typing (Phase B1, System B). Admin authentication
 * is enforced exactly like every mutation and every Name availability
 * check: requireAdminUser() runs first and redirects any
 * unauthenticated/unauthorized caller, so the check never runs for them
 * (the client treats that as a failed request, which never blocks
 * submission). The candidate is normalized through the same canonical
 * src/lib/slug.ts rule the server parser applies, then length-bounded;
 * nothing is logged; the database is only read. The submission-time
 * uniqueness check inside createItemAction/updateItemAction remains the
 * authoritative protection — this is feedback only.
 */
export async function checkItemSlugAvailability(
  rawSlug: string,
  rawExcludeId?: string
): Promise<RecordSlugAvailability> {
  await requireAdminUser();

  const slug = normalizeRecordSlugCandidate(rawSlug);

  if (slug === "" || slug.length > MAX_RECORD_SLUG_LENGTH) {
    return "unchecked";
  }

  // The exclude id comes from the edit form's own hidden field; bounding it
  // keeps arbitrary long input out of the query. A wrong value can only
  // make the FEEDBACK wrong — the authoritative submission check derives
  // its exclusion from the server-loaded record, not from this value.
  const excludeId = String(rawExcludeId ?? "").trim().slice(0, 64);

  const taken = await isItemSlugTaken(prisma, slug, excludeId || undefined);

  return taken ? "taken" : "available";
}
