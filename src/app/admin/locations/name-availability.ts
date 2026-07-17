"use server";

import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import {
  MAX_RECORD_NAME_LENGTH,
  isLocationNameTaken,
  normalizeRecordNameInput,
  type RecordNameAvailability,
} from "@/lib/admin/record-name";

/**
 * Read-only availability probe for the Location name field, invoked from
 * the client while typing. Admin authentication is enforced exactly like
 * every mutation: requireAdminUser() runs first and redirects any
 * unauthenticated/unauthorized caller, so the check never runs for them
 * (the client treats that as a failed request, which never blocks
 * submission). Input is trimmed and length-bounded; nothing is logged; the
 * database is only read. The submission-time check inside the create/edit
 * actions remains the authoritative protection — this is feedback only.
 */
export async function checkLocationNameAvailability(
  rawName: string,
  rawExcludeId?: string
): Promise<RecordNameAvailability> {
  await requireAdminUser();

  const name = normalizeRecordNameInput(rawName);

  if (name === "" || name.length > MAX_RECORD_NAME_LENGTH) {
    return "unchecked";
  }

  // The exclude id comes from the edit form's own hidden field; bounding it
  // keeps arbitrary long input out of the query. A wrong value can only
  // make the FEEDBACK wrong — the authoritative submission check derives
  // its exclusion from the server-loaded record, not from this value.
  const excludeId = String(rawExcludeId ?? "").trim().slice(0, 64);

  const taken = await isLocationNameTaken(prisma, name, excludeId || undefined);

  return taken ? "taken" : "available";
}
