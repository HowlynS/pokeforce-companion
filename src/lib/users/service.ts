import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { UserRole } from "@/lib/auth/roles";
import { hasPermission } from "@/lib/auth/permissions";
import { canCreateRole, canManageUser } from "./policy";

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
  if (!actor || actor.status !== "ACTIVE" || !hasPermission(actor.role, "users.modify")) {
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

async function ensureAnotherActiveOwner(
  tx: Prisma.TransactionClient
) {
  const activeOwners = await tx.appUser.count({
    where: { role: "OWNER", status: "ACTIVE" },
  });
  if (activeOwners <= 1) {
    throw new UserManagementError("final_owner");
  }
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
    !hasPermission(actor.role, "users.create") ||
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
    if (!canCreateRole(actor.role, role)) {
      throw new UserManagementError("permission_denied");
    }
    if (target.role === "OWNER" && role !== "OWNER" && target.status === "ACTIVE") {
      await ensureAnotherActiveOwner(tx);
    }
    return tx.appUser.update({ where: { id: target.id }, data: { role } });
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
    const required = status === "ACTIVE" ? "users.reenable" : "users.disable";
    if (!hasPermission(actor.role, required)) {
      throw new UserManagementError("permission_denied");
    }
    if (target.role === "OWNER" && target.status === "ACTIVE" && status === "DISABLED") {
      await ensureAnotherActiveOwner(tx);
    }
    return tx.appUser.update({
      where: { id: target.id },
      data:
        status === "DISABLED"
          ? { status, disabledAt: new Date(), disabledById: actor.id }
          : { status, disabledAt: null, disabledById: null },
    });
  });
}

export async function validateUserStatusChange(
  client: PrismaClient,
  actorId: string,
  targetId: string,
  status: "ACTIVE" | "DISABLED"
) {
  return client.$transaction(async (tx) => {
    await lockOwnerMutations(tx);
    const { actor, target } = await loadActorAndTarget(tx, actorId, targetId);
    const required = status === "ACTIVE" ? "users.reenable" : "users.disable";
    if (!hasPermission(actor.role, required)) {
      throw new UserManagementError("permission_denied");
    }
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
    const { actor, target } = await loadActorAndTarget(tx, actorId, targetId);
    if (!hasPermission(actor.role, "users.password.reset")) {
      throw new UserManagementError("permission_denied");
    }
    return target;
  });
}
