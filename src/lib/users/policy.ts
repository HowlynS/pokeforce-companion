import type { UserRole } from "@/lib/auth/roles";

export const ADMINISTRATOR_MANAGED_ROLES = ["MEMBER", "CONTRIBUTOR"] as const;

export function canCreateRole(actorRole: UserRole, requestedRole: UserRole): boolean {
  return actorRole === "OWNER"
    ? true
    : actorRole === "ADMINISTRATOR" &&
        ADMINISTRATOR_MANAGED_ROLES.includes(
          requestedRole as (typeof ADMINISTRATOR_MANAGED_ROLES)[number]
        );
}

export function canManageUser(
  actor: { id: string; role: UserRole },
  target: { id: string; role: UserRole }
): boolean {
  if (actor.id === target.id) {
    return false;
  }
  if (actor.role === "OWNER") {
    return true;
  }
  return (
    actor.role === "ADMINISTRATOR" &&
    ADMINISTRATOR_MANAGED_ROLES.includes(
      target.role as (typeof ADMINISTRATOR_MANAGED_ROLES)[number]
    )
  );
}

export function assignableRoles(actorRole: UserRole): readonly UserRole[] {
  return actorRole === "OWNER"
    ? ["MEMBER", "CONTRIBUTOR", "ADMINISTRATOR", "OWNER"]
    : actorRole === "ADMINISTRATOR"
      ? ADMINISTRATOR_MANAGED_ROLES
      : [];
}
