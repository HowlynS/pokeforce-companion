"use server";

import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import {
  MAX_RECORD_SLUG_LENGTH,
  isCategorySlugTaken,
  normalizeRecordSlugCandidate,
  type RecordSlugAvailability,
} from "@/lib/admin/record-slug";

/**
 * Read-only availability probe for the Category Page address field,
 * invoked from the client while typing (Phase B1, System B). Admin
 * authentication is enforced exactly like every mutation and every Name
 * availability check: requireAdminUser() runs first and redirects any
 * unauthenticated/unauthorized caller, so the check never runs for them
 * (the client treats that as a failed request, which never blocks
 * submission). The candidate is normalized through the same canonical
 * src/lib/slug.ts rule the server parser applies, then length-bounded;
 * nothing is logged; the database is only read. The submission-time
 * uniqueness check inside the create/edit actions remains the
 * authoritative protection — this is feedback only.
 */
export async function checkCategorySlugAvailability(
  rawSlug: string,
  rawExcludeId?: string
): Promise<RecordSlugAvailability> {
  await requireAdminUser();

  const slug = normalizeRecordSlugCandidate(rawSlug);

  if (slug === "" || slug.length > MAX_RECORD_SLUG_LENGTH) {
    return "unchecked";
  }

  const excludeId = String(rawExcludeId ?? "").trim().slice(0, 64);

  const taken = await isCategorySlugTaken(prisma, slug, excludeId || undefined);

  return taken ? "taken" : "available";
}
