export const USER_ROLES = [
  "MEMBER",
  "CONTRIBUTOR",
  "ADMINISTRATOR",
  "OWNER",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  MEMBER: "Member",
  CONTRIBUTOR: "Contributor",
  ADMINISTRATOR: "Administrator",
  OWNER: "Owner",
};

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && USER_ROLES.includes(value as UserRole);
}
