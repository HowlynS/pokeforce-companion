import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { UserRole } from "@/lib/auth/roles";
import { canCreateRole, canManageUser } from "./policy";
import { auditActor, writeAuditEvent } from "@/lib/audit/writer";

const OWNER_MUTATION_LOCK_ID = 1_946_608_012;

export class UserManagementError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

async function lockOwnerMutations(tx: Prisma.TransactionClient) {
  await tx.$executeRawUnsafe(
    `SELECT pg_advisory_xact_lock(${OWNER_MUTATION_LOCK_ID})`
  );
}

async function loadActorAndTarget(
  tx: Prisma.TransactionClient,
  actorId: string,
  targetId: string
) {
  const [actor, target] = await Promise.all([
    tx.appUser.findUnique({ where: { id: actorId } }),
    tx.appUser.findUnique({ where: { id: targetId } }),
  ]);
  if (!actor || actor.status !== "ACTIVE" || actor.role !== "OWNER") {
    throw new UserManagementError("permission_denied");
  }
  if (!target) {
    throw new UserManagementError("missing_user");
  }
  if (!canManageUser(actor, target)) {
    throw new UserManagementError("permission_denied");
  }
  return { actor, target };
}

export async function validateUserCreation(
  client: PrismaClient,
  actorId: string,
  requestedRole: UserRole
) {
  const actor = await client.appUser.findUnique({ where: { id: actorId } });
  if (
    !actor ||
    actor.status !== "ACTIVE" ||
    !canCreateRole(actor.role, requestedRole)
  ) {
    throw new UserManagementError("permission_denied");
  }
  return actor;
}

export async function changeUserRole(
  client: PrismaClient,
  actorId: string,
  targetId: string,
  role: UserRole
) {
  return client.$transaction(async (tx) => {
    await lockOwnerMutations(tx);
    const { actor, target } = await loadActorAndTarget(tx, actorId, targetId);
    if (!canCreateRole(actor.role, role) || target.role === "OWNER") {
      throw new UserManagementError("owner_protected");
    }
    const updated = await tx.appUser.update({
      where: { id: target.id },
      data: { role },
    });
    await writeAuditEvent(tx, {
      actor: auditActor(actor),
      action: "access.role_change",
      targetType: "USER",
      targetId: target.id,
      targetLabel: target.email,
      metadata: { previous: target.role, next: role },
    });
    return updated;
  });
}

export async function setUserStatus(
  client: PrismaClient,
  actorId: string,
  targetId: string,
  status: "ACTIVE" | "DISABLED"
) {
  return client.$transaction(async (tx) => {
    await lockOwnerMutations(tx);
    const { actor, target } = await loadActorAndTarget(tx, actorId, targetId);
    const updated = await tx.appUser.update({
      where: { id: target.id },
      data:
        status === "DISABLED"
          ? { status, disabledAt: new Date(), disabledById: actor.id }
          : { status, disabledAt: null, disabledById: null },
    });
    await writeAuditEvent(tx, {
      actor: auditActor(actor),
      action:
        status === "DISABLED" ? "access.user_disable" : "access.user_reenable",
      targetType: "USER",
      targetId: target.id,
      targetLabel: target.email,
      metadata: { previous: target.status, next: status },
    });
    return updated;
  });
}

export async function validateUserStatusChange(
  client: PrismaClient,
  actorId: string,
  targetId: string
) {
  return client.$transaction(async (tx) => {
    await lockOwnerMutations(tx);
    const { target } = await loadActorAndTarget(tx, actorId, targetId);
    return target;
  });
}

export async function validatePasswordReset(
  client: PrismaClient,
  actorId: string,
  targetId: string
) {
  return client.$transaction(async (tx) => {
    await lockOwnerMutations(tx);
    const { target } = await loadActorAndTarget(tx, actorId, targetId);
    return target;
  });
}
