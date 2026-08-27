import type { UserRole } from "@/lib/auth/roles";

export const ORDINARY_USER_ROLES = [
  "MEMBER",
  "CONTRIBUTOR",
  "ADMINISTRATOR",
] as const;

export function canCreateRole(actorRole: UserRole, requestedRole: UserRole): boolean {
  return (
    actorRole === "OWNER" &&
    ORDINARY_USER_ROLES.includes(
      requestedRole as (typeof ORDINARY_USER_ROLES)[number]
    )
  );
}

export function canManageUser(
  actor: { id: string; role: UserRole },
  target: { id: string; role: UserRole }
): boolean {
  if (actor.id === target.id) {
    return false;
  }
  return actor.role === "OWNER" && target.role !== "OWNER";
}

export function assignableRoles(actorRole: UserRole): readonly UserRole[] {
  return actorRole === "OWNER"
    ? ORDINARY_USER_ROLES
    : [];
}
