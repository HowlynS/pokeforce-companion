import type { Prisma } from "@/generated/prisma/client";
import { sanitizeAuditMetadata } from "./sanitize";

type AuditClient = Pick<Prisma.TransactionClient, "auditEvent">;

export type AuditActor = {
  id: string;
  email: string;
  displayName: string | null;
} | null;

export type AuditEventInput = {
  actor: AuditActor;
  action: string;
  targetType: string;
  targetId?: string | null;
  targetLabel: string;
  metadata?: Record<string, unknown> | null;
};

export async function writeAuditEvent(
  client: AuditClient,
  event: AuditEventInput
) {
  const metadata = sanitizeAuditMetadata(event.metadata);
  return client.auditEvent.create({
    data: {
      actorUserId: event.actor?.id ?? null,
      actorEmailSnapshot: event.actor?.email ?? "system",
      actorDisplayNameSnapshot: event.actor?.displayName ?? null,
      action: event.action,
      targetType: event.targetType,
      targetId: event.targetId ?? null,
      targetLabelSnapshot: event.targetLabel.slice(0, 240),
      ...(metadata ? { metadata: metadata as Prisma.InputJsonValue } : {}),
    },
  });
}

export function auditActor(user: {
  id: string;
  email: string;
  displayName: string | null;
}): NonNullable<AuditActor> {
  return { id: user.id, email: user.email, displayName: user.displayName };
}
