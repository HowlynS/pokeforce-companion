import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import {
  ORDINARY_PERMISSION_KEYS,
  PERMISSION_GROUPS,
  PERMISSION_REGISTRY,
  PROTECTED_PERMISSION_KEYS,
  type PermissionDefinition,
  type PermissionGroup,
  type PermissionKey,
} from "./permission-registry";
import {
  createPermissionContext,
  hasEffectivePermission,
  loadPermissionContext,
  type PermissionContext,
  type PermissionOverrideEffect,
  type PermissionUser,
} from "./permission-resolver";
import type { UserRole } from "./roles";

export type OrdinaryUserRole = Exclude<UserRole, "OWNER">;
export type PersonalPermissionSetting =
  | PermissionOverrideEffect
  | "INHERIT";
export type EffectivePermissionSource =
  | "OWNER"
  | "PERSONAL_ALLOW"
  | "PERSONAL_DENY"
  | "ROLE"
  | "DEFAULT_DENY";

export type PermissionDefinitionReadModel = Readonly<{
  key: PermissionKey;
  label: string;
  description: string;
  group: PermissionGroup;
  dangerous: boolean;
}>;

export type GroupedPermissionReadModel<Row> = Readonly<{
  group: PermissionGroup;
  permissions: readonly Row[];
}>;

export type RolePermissionRowReadModel = PermissionDefinitionReadModel &
  Readonly<{ granted: boolean }>;

export type RolePermissionReadModel = Readonly<{
  role: OrdinaryUserRole;
  groups: readonly GroupedPermissionReadModel<RolePermissionRowReadModel>[];
}>;

export type PersonalPermissionRowReadModel = PermissionDefinitionReadModel &
  Readonly<{
    roleGranted: boolean;
    personalSetting: PersonalPermissionSetting;
    effective: boolean;
    effectiveSource: EffectivePermissionSource;
  }>;

export type UserPermissionReadModel = Readonly<{
  user: PermissionUser;
  ownerProtected: boolean;
  groups: readonly GroupedPermissionReadModel<PersonalPermissionRowReadModel>[];
}>;

export type ProtectedPermissionReadModel = PermissionDefinitionReadModel &
  Readonly<{
    protection: "OWNER_SYSTEM";
  }>;

type PermissionReadClient = Pick<
  Prisma.TransactionClient,
  "rolePermission" | "userPermissionOverride"
>;

export function ordinaryRoleFrom(
  value: unknown,
  fallback: OrdinaryUserRole = "MEMBER"
): OrdinaryUserRole {
  return value === "MEMBER" ||
    value === "CONTRIBUTOR" ||
    value === "ADMINISTRATOR"
    ? value
    : fallback;
}

function definitionFor(key: PermissionKey): PermissionDefinitionReadModel {
  const definition: PermissionDefinition = PERMISSION_REGISTRY[key];
  return {
    key,
    label: definition.label,
    description: definition.description,
    group: definition.group,
    dangerous: definition.dangerous === true,
  };
}

function groupRows<Row extends { group: PermissionGroup }>(
  rows: readonly Row[]
): readonly GroupedPermissionReadModel<Row>[] {
  return PERMISSION_GROUPS.flatMap((group) => {
    const permissions = rows.filter((row) => row.group === group);
    return permissions.length ? [{ group, permissions }] : [];
  });
}

export function protectedPermissionReadModel(): readonly ProtectedPermissionReadModel[] {
  return PROTECTED_PERMISSION_KEYS.map((key) => ({
    ...definitionFor(key),
    protection: "OWNER_SYSTEM" as const,
  }));
}

export function buildRolePermissionReadModel(
  role: OrdinaryUserRole,
  storedPermissionKeys: readonly string[]
): RolePermissionReadModel {
  const context = createPermissionContext({
    user: { id: `role:${role}`, role },
    rolePermissionKeys: storedPermissionKeys,
  });
  const rows = ORDINARY_PERMISSION_KEYS.map((key) => ({
    ...definitionFor(key),
    granted: hasEffectivePermission(context, key),
  }));

  return { role, groups: groupRows(rows) };
}

function effectiveSource(
  context: PermissionContext,
  key: PermissionKey,
  roleGranted: boolean
): EffectivePermissionSource {
  if (context.user.role === "OWNER") {
    return "OWNER";
  }

  const override = context.userOverrides.get(key);
  if (override === "ALLOW") {
    return "PERSONAL_ALLOW";
  }
  if (override === "DENY") {
    return "PERSONAL_DENY";
  }
  return roleGranted ? "ROLE" : "DEFAULT_DENY";
}

export function buildUserPermissionReadModel(
  context: PermissionContext
): UserPermissionReadModel {
  const roleContext = createPermissionContext({
    user: context.user,
    rolePermissionKeys: [...context.roleGrants],
  });
  const rows = ORDINARY_PERMISSION_KEYS.map((key) => {
    const roleGranted = hasEffectivePermission(roleContext, key);
    const personalSetting: PersonalPermissionSetting =
      context.userOverrides.get(key) ?? "INHERIT";
    return {
      ...definitionFor(key),
      roleGranted,
      personalSetting,
      effective: hasEffectivePermission(context, key),
      effectiveSource: effectiveSource(context, key, roleGranted),
    };
  });

  return {
    user: context.user,
    ownerProtected: context.user.role === "OWNER",
    groups: groupRows(rows),
  };
}

export async function loadRolePermissionReadModel(
  client: PermissionReadClient,
  role: OrdinaryUserRole
): Promise<RolePermissionReadModel> {
  const grants = await client.rolePermission.findMany({
    where: { role },
    select: { permissionKey: true },
  });
  return buildRolePermissionReadModel(
    role,
    grants.map(({ permissionKey }) => permissionKey)
  );
}

export async function loadUserPermissionReadModel(
  client: PermissionReadClient,
  user: PermissionUser
): Promise<UserPermissionReadModel> {
  const context = await loadPermissionContext(client, user);
  return buildUserPermissionReadModel(context);
}
