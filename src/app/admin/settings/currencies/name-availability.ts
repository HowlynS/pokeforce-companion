"use server";

import {
  MAX_RECORD_NAME_LENGTH,
  isCurrencyNameTaken,
  normalizeRecordNameInput,
  type RecordNameAvailability,
} from "@/lib/admin/record-name";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";

export async function checkCurrencyNameAvailability(
  rawName: string,
  rawExcludeId?: string
): Promise<RecordNameAvailability> {
  await requireAdminUser();
  const name = normalizeRecordNameInput(rawName);

  if (name === "" || name.length > MAX_RECORD_NAME_LENGTH) {
    return "unchecked";
  }

  const excludeId = String(rawExcludeId ?? "").trim().slice(0, 64);
  return (await isCurrencyNameTaken(prisma, name, excludeId || undefined))
    ? "taken"
    : "available";
}
