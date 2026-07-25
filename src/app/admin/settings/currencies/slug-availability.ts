"use server";

import {
  MAX_RECORD_SLUG_LENGTH,
  isCurrencySlugTaken,
  normalizeRecordSlugCandidate,
  type RecordSlugAvailability,
} from "@/lib/admin/record-slug";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";

export async function checkCurrencySlugAvailability(
  rawSlug: string,
  rawExcludeId?: string
): Promise<RecordSlugAvailability> {
  await requireAdminUser();
  const slug = normalizeRecordSlugCandidate(rawSlug);

  if (slug === "" || slug.length > MAX_RECORD_SLUG_LENGTH) {
    return "unchecked";
  }

  const excludeId = String(rawExcludeId ?? "").trim().slice(0, 64);
  return (await isCurrencySlugTaken(prisma, slug, excludeId || undefined))
    ? "taken"
    : "available";
}
