import type { UserRole } from "./roles";
import type { PermissionKey } from "./permission-registry";

const MEMBER_PERMISSIONS = ["site.access.private"] as const;

const CONTRIBUTOR_PERMISSIONS = [
  ...MEMBER_PERMISSIONS,
  "contributions.submit",
  "contributions.withdraw-own",
] as const;

const ADMINISTRATOR_PERMISSIONS = [
  ...MEMBER_PERMISSIONS,
  "admin.access",
  "contributions.review",
  "contributions.approve",
  "contributions.reject",
  "content.images.manage",
  "content.items.create",
  "content.items.edit",
  "content.items.delete",
  "content.items.verify",
  "content.recipes.create",
  "content.recipes.edit",
  "content.recipes.delete",
  "content.recipes.verify",
  "content.professions.create",
  "content.professions.edit",
  "content.professions.delete",
  "content.professions.verify",
  "content.classes.create",
  "content.classes.edit",
  "content.classes.delete",
  "content.classes.verify",
  "content.locations.create",
  "content.locations.edit",
  "content.locations.delete",
  "content.locations.verify",
  "content.shops.create",
  "content.shops.edit",
  "content.shops.delete",
  "content.shops.verify",
  "content.currencies.create",
  "content.currencies.edit",
  "content.currencies.delete",
  "content.currencies.verify",
  "content.categories.create",
  "content.categories.edit",
  "content.game-versions.create",
  "content.game-versions.edit",
  "content.game-versions.delete",
  "site.appearance.manage",
  "site.design-review.view",
  "users.view",
  "audit.view",
] as const;

// OWNER intentionally has no editable preset rows. Owner authority is a
// protected invariant resolved in code, independent from this table.
export const INITIAL_ROLE_PERMISSION_PRESETS = {
  MEMBER: MEMBER_PERMISSIONS,
  CONTRIBUTOR: CONTRIBUTOR_PERMISSIONS,
  ADMINISTRATOR: ADMINISTRATOR_PERMISSIONS,
  OWNER: [],
} as const satisfies Readonly<Record<UserRole, readonly PermissionKey[]>>;

