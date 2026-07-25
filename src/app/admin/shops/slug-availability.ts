"use server";

import {
  MAX_RECORD_SLUG_LENGTH,
  isShopSlugTaken,
  normalizeRecordSlugCandidate,
  type RecordSlugAvailability,
} from "@/lib/admin/record-slug";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";

export async function checkShopSlugAvailability(
  rawSlug: string,
  rawExcludeId?: string
): Promise<RecordSlugAvailability> {
  await requireAdminUser();
  const slug = normalizeRecordSlugCandidate(rawSlug);
  if (slug === "" || slug.length > MAX_RECORD_SLUG_LENGTH) {
    return "unchecked";
  }
  const excludeId = String(rawExcludeId ?? "").trim().slice(0, 64);
  return (await isShopSlugTaken(prisma, slug, excludeId || undefined))
    ? "taken"
    : "available";
}
