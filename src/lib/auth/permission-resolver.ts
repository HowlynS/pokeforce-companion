import type { Prisma } from "@/generated/prisma/client";
import type { UserRole } from "./roles";
import {
  isPermissionKey,
  isProtectedPermission,
  type PermissionKey,
} from "./permission-registry";

export type PermissionOverrideEffect = "ALLOW" | "DENY";

export type PermissionUser = Readonly<{
  id: string;
  role: UserRole;
}>;

export type PermissionContext = Readonly<{
  user: PermissionUser;
  roleGrants: ReadonlySet<PermissionKey>;
  userOverrides: ReadonlyMap<PermissionKey, PermissionOverrideEffect>;
}>;

type PermissionClient = Pick<
  Prisma.TransactionClient,
  "rolePermission" | "userPermissionOverride"
>;

function registeredOrdinaryPermissions(
  storedKeys: readonly string[]
): Set<PermissionKey> {
  return new Set(
    storedKeys.filter(
      (key): key is PermissionKey =>
        isPermissionKey(key) && !isProtectedPermission(key)
    )
  );
}

export function createPermissionContext(input: {
  user: PermissionUser;
  rolePermissionKeys?: readonly string[];
  userOverrides?: ReadonlyArray<{
    permissionKey: string;
    effect: PermissionOverrideEffect;
  }>;
}): PermissionContext {
  const overrides = new Map<PermissionKey, PermissionOverrideEffect>();
  for (const override of input.userOverrides ?? []) {
    if (
      isPermissionKey(override.permissionKey) &&
      !isProtectedPermission(override.permissionKey)
    ) {
      overrides.set(override.permissionKey, override.effect);
    }
  }

  return {
    user: input.user,
    roleGrants: registeredOrdinaryPermissions(input.rolePermissionKeys ?? []),
    userOverrides: overrides,
  };
}

/**
 * Load all mutable permission state for one actor in two bounded queries.
 * Callers reuse the returned context for every check in the operation.
 */
export async function loadPermissionContext(
  client: PermissionClient,
  user: PermissionUser
): Promise<PermissionContext> {
  const [roleGrants, userOverrides] = await Promise.all([
    client.rolePermission.findMany({
      where: { role: user.role },
      select: { permissionKey: true },
    }),
    client.userPermissionOverride.findMany({
      where: { userId: user.id },
      select: { permissionKey: true, effect: true },
    }),
  ]);

  return createPermissionContext({
    user,
    rolePermissionKeys: roleGrants.map(({ permissionKey }) => permissionKey),
    userOverrides,
  });
}

/**
 * Canonical effective-permission algorithm:
 * registered key -> protected Owner invariant -> DENY -> ALLOW -> role -> deny.
 */
export function hasEffectivePermission(
  context: PermissionContext,
  requestedPermission: unknown
): requestedPermission is PermissionKey {
  if (!isPermissionKey(requestedPermission)) {
    return false;
  }

  if (context.user.role === "OWNER") {
    return true;
  }

  if (isProtectedPermission(requestedPermission)) {
    return false;
  }

  const override = context.userOverrides.get(requestedPermission);
  if (override === "DENY") {
    return false;
  }
  if (override === "ALLOW") {
    return true;
  }

  return context.roleGrants.has(requestedPermission);
}
