import type { User } from "@supabase/supabase-js";
import type { PrismaClient } from "@/generated/prisma/client";
import { writeAuditEvent } from "@/lib/audit/writer";

export const SITE_ACCESS_SETTINGS_ID = "site";
const OWNER_BOOTSTRAP_LOCK_ID = 1_946_608_011;

export type AuthIdentity = Pick<User, "id" | "email">;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Resolve the application-owned identity, bootstrapping only the configured
 * legacy ADMIN_EMAIL as Owner. A transaction-scoped advisory lock serializes
 * first-request races across application instances.
 */
export async function resolveApplicationUserForIdentity(
  client: PrismaClient,
  identity: AuthIdentity,
  configuredAdminEmail: string | undefined
) {
  if (!identity.email) {
    return null;
  }

  const existing = await client.appUser.findUnique({
    where: { authUserId: identity.id },
  });
  if (existing) {
    return existing;
  }

  const normalizedEmail = normalizeEmail(identity.email);
  if (
    !configuredAdminEmail ||
    normalizedEmail !== normalizeEmail(configuredAdminEmail)
  ) {
    return null;
  }

  return client.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SELECT pg_advisory_xact_lock(${OWNER_BOOTSTRAP_LOCK_ID})`
    );

    const byAuthId = await tx.appUser.findUnique({
      where: { authUserId: identity.id },
    });
    if (byAuthId) {
      return byAuthId;
    }

    const byEmail = await tx.appUser.findUnique({
      where: { email: normalizedEmail },
    });
    if (byEmail) {
      const reconciled = await tx.appUser.update({
        where: { id: byEmail.id },
        data: {
          authUserId: identity.id,
          role: "OWNER",
          status: "ACTIVE",
          disabledAt: null,
          disabledById: null,
        },
      });
      await writeAuditEvent(tx, {
        actor: null,
        action: "access.owner_bootstrap",
        targetType: "USER",
        targetId: reconciled.id,
        targetLabel: reconciled.email,
        metadata: { reconciled: true },
      });
      return reconciled;
    }

    await tx.siteAccessSettings.upsert({
      where: { id: SITE_ACCESS_SETTINGS_ID },
      update: {},
      create: {
        id: SITE_ACCESS_SETTINGS_ID,
        visibility: "PRIVATE_BETA",
      },
    });

    const owner = await tx.appUser.create({
      data: {
        authUserId: identity.id,
        email: normalizedEmail,
        role: "OWNER",
        status: "ACTIVE",
      },
    });
    await writeAuditEvent(tx, {
      actor: null,
      action: "access.owner_bootstrap",
      targetType: "USER",
      targetId: owner.id,
      targetLabel: owner.email,
      metadata: { reconciled: false },
    });
    return owner;
  });
}
