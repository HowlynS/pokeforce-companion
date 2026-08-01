import type { PrismaClient, SiteVisibility } from "@/generated/prisma/client";
import { hasPermission } from "@/lib/auth/permissions";
import { auditActor, writeAuditEvent } from "@/lib/audit/writer";
import { SITE_ACCESS_SETTINGS_ID } from "@/lib/auth/bootstrap-owner";

const VISIBILITY_LOCK_ID = 1_946_608_013;

export async function changeSiteVisibility(
  client: PrismaClient,
  actorId: string,
  visibility: SiteVisibility
) {
  return client.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SELECT pg_advisory_xact_lock(${VISIBILITY_LOCK_ID})`
    );
    const actor = await tx.appUser.findUnique({ where: { id: actorId } });
    if (
      !actor ||
      actor.status !== "ACTIVE" ||
      !hasPermission(actor.role, "visibility.change")
    ) {
      throw new Error("permission_denied");
    }

    const previous = await tx.siteAccessSettings.findUnique({
      where: { id: SITE_ACCESS_SETTINGS_ID },
    });
    const settings = await tx.siteAccessSettings.upsert({
      where: { id: SITE_ACCESS_SETTINGS_ID },
      update: { visibility },
      create: { id: SITE_ACCESS_SETTINGS_ID, visibility },
    });
    await writeAuditEvent(tx, {
      actor: auditActor(actor),
      action: "access.visibility_change",
      targetType: "SITE_VISIBILITY",
      targetId: settings.id,
      targetLabel: "Site visibility",
      metadata: {
        previous: previous?.visibility ?? "PRIVATE_BETA",
        next: visibility,
      },
    });
    return { previous: previous?.visibility ?? "PRIVATE_BETA", settings };
  });
}
