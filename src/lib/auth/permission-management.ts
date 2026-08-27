import "server-only";

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { auditActor, writeAuditEvent } from "@/lib/audit/writer";
import { isUserRole, USER_ROLE_LABELS, type UserRole } from "./roles";
import {
  isPermissionKey,
  isProtectedPermission,
  type PermissionKey,
} from "./permission-registry";
import type { PermissionOverrideEffect } from "./permission-resolver";

const SECURITY_MUTATION_LOCK_ID = 1_946_608_014;

export class PermissionManagementError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

function requireOrdinaryPermission(value: unknown): PermissionKey {
  if (!isPermissionKey(value)) {
    throw new PermissionManagementError("invalid_permission");
  }
  if (isProtectedPermission(value)) {
    throw new PermissionManagementError("protected_permission");
  }
  return value;
}

function requireOrdinaryRole(value: unknown): Exclude<UserRole, "OWNER"> {
  if (!isUserRole(value)) {
    throw new PermissionManagementError("invalid_role");
  }
  if (value === "OWNER") {
    throw new PermissionManagementError("owner_protected");
  }
  return value;
}

function requireOverrideEffect(value: unknown): PermissionOverrideEffect | null {
  if (value === null || value === "ALLOW" || value === "DENY") {
    return value;
  }
  throw new PermissionManagementError("invalid_override");
}

async function requireOwnerActor(
  tx: Prisma.TransactionClient,
  actorId: string
) {
  const actor = await tx.appUser.findUnique({ where: { id: actorId } });
  if (!actor || actor.status !== "ACTIVE" || actor.role !== "OWNER") {
    throw new PermissionManagementError("permission_denied");
  }
  return actor;
}

export async function setRolePermission(
  client: PrismaClient,
  actorId: string,
  roleInput: unknown,
  permissionInput: unknown,
  grantedInput: unknown
) {
  const role = requireOrdinaryRole(roleInput);
  const permissionKey = requireOrdinaryPermission(permissionInput);
  if (typeof grantedInput !== "boolean") {
    throw new PermissionManagementError("invalid_grant");
  }
  const granted = grantedInput;

  return client.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SELECT pg_advisory_xact_lock(${SECURITY_MUTATION_LOCK_ID})`
    );
    const actor = await requireOwnerActor(tx, actorId);
    const existing = await tx.rolePermission.findUnique({
      where: { role_permissionKey: { role, permissionKey } },
    });

    if (Boolean(existing) === granted) {
      return { role, permissionKey, granted, changed: false };
    }

    if (granted) {
      await tx.rolePermission.create({ data: { role, permissionKey } });
    } else {
      await tx.rolePermission.delete({
        where: { role_permissionKey: { role, permissionKey } },
      });
    }

    await writeAuditEvent(tx, {
      actor: auditActor(actor),
      action: granted
        ? "security.role_permission_grant"
        : "security.role_permission_revoke",
      targetType: "ROLE",
      targetId: role,
      targetLabel: USER_ROLE_LABELS[role],
      metadata: {
        permissionKey,
        previous: !granted,
        next: granted,
      },
    });

    return { role, permissionKey, granted, changed: true };
  });
}

export async function setUserPermissionOverride(
  client: PrismaClient,
  actorId: string,
  targetUserId: string,
  permissionInput: unknown,
  effectInput: unknown
) {
  const permissionKey = requireOrdinaryPermission(permissionInput);
  const effect = requireOverrideEffect(effectInput);

  return client.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SELECT pg_advisory_xact_lock(${SECURITY_MUTATION_LOCK_ID})`
    );
    const actor = await requireOwnerActor(tx, actorId);
    const target = await tx.appUser.findUnique({
      where: { id: targetUserId },
    });
    if (!target) {
      throw new PermissionManagementError("missing_user");
    }
    if (target.role === "OWNER") {
      throw new PermissionManagementError("owner_protected");
    }

    const key = { userId_permissionKey: { userId: target.id, permissionKey } };
    const existing = await tx.userPermissionOverride.findUnique({ where: key });
    const previous = existing?.effect ?? "INHERIT";
    const next = effect ?? "INHERIT";
    if (previous === next) {
      return { userId: target.id, permissionKey, effect, changed: false };
    }

    if (effect === null) {
      await tx.userPermissionOverride.delete({ where: key });
    } else {
      await tx.userPermissionOverride.upsert({
        where: key,
        update: { effect },
        create: { userId: target.id, permissionKey, effect },
      });
    }

    await writeAuditEvent(tx, {
      actor: auditActor(actor),
      action:
        effect === "ALLOW"
          ? "security.personal_permission_allow"
          : effect === "DENY"
            ? "security.personal_permission_deny"
            : "security.personal_permission_inherit",
      targetType: "USER",
      targetId: target.id,
      targetLabel: target.email,
      metadata: { permissionKey, previous, next },
    });

    return { userId: target.id, permissionKey, effect, changed: true };
  });
}
