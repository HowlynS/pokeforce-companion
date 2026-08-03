import type { UserRole } from "./roles";

export const CAPABILITIES = [
  "site.access.private",
  "admin.access",
  "content.create",
  "content.edit",
  "content.delete",
  "content.verify",
  "content.images.manage",
  "gameVersions.manage",
  "appearance.manage",
  "designReview.access",
  "users.view",
  "users.create",
  "users.modify",
  "users.disable",
  "users.reenable",
  "users.password.reset",
  "audit.view",
  "visibility.change",
  "owners.manage",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

const MEMBER_CAPABILITIES = ["site.access.private"] as const;
const CONTRIBUTOR_CAPABILITIES = [
  ...MEMBER_CAPABILITIES,
  "admin.access",
  "content.create",
  "content.edit",
  "content.verify",
  "content.images.manage",
] as const;
const ADMINISTRATOR_CAPABILITIES = [
  ...CONTRIBUTOR_CAPABILITIES,
  "content.delete",
  "gameVersions.manage",
  "appearance.manage",
  "designReview.access",
  "users.view",
  "users.create",
  "users.modify",
  "users.disable",
  "users.reenable",
  "users.password.reset",
  "audit.view",
] as const;

export const ROLE_CAPABILITIES: Readonly<Record<UserRole, ReadonlySet<Capability>>> = {
  MEMBER: new Set<Capability>(MEMBER_CAPABILITIES),
  CONTRIBUTOR: new Set<Capability>(CONTRIBUTOR_CAPABILITIES),
  ADMINISTRATOR: new Set<Capability>(ADMINISTRATOR_CAPABILITIES),
  OWNER: new Set<Capability>(CAPABILITIES),
};

export function hasPermission(
  role: UserRole,
  capability: Capability
): boolean {
  return ROLE_CAPABILITIES[role].has(capability);
}

export function hasAnyPermission(
  role: UserRole,
  capabilities: readonly Capability[]
): boolean {
  return capabilities.some((capability) => hasPermission(role, capability));
}

export function permissionsForRole(role: UserRole): readonly Capability[] {
  return CAPABILITIES.filter((capability) => hasPermission(role, capability));
}
