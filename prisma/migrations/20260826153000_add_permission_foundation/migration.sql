-- CreateEnum
CREATE TYPE "PermissionOverrideEffect" AS ENUM ('ALLOW', 'DENY');

-- CreateTable
CREATE TABLE "RolePermission" (
    "role" "UserRole" NOT NULL,
    "permissionKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("role", "permissionKey")
);

-- CreateTable
CREATE TABLE "UserPermissionOverride" (
    "userId" TEXT NOT NULL,
    "permissionKey" TEXT NOT NULL,
    "effect" "PermissionOverrideEffect" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPermissionOverride_pkey" PRIMARY KEY ("userId", "permissionKey")
);

-- CreateIndex
CREATE INDEX "RolePermission_permissionKey_idx" ON "RolePermission"("permissionKey");

-- CreateIndex
CREATE INDEX "UserPermissionOverride_permissionKey_idx" ON "UserPermissionOverride"("permissionKey");

-- AddForeignKey
ALTER TABLE "UserPermissionOverride" ADD CONSTRAINT "UserPermissionOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed deterministic ordinary role presets. OWNER remains intentionally empty:
-- its protected authority is resolved independently from editable grant rows.
INSERT INTO "RolePermission" ("role", "permissionKey", "updatedAt") VALUES
  ('MEMBER', 'site.access.private', CURRENT_TIMESTAMP),
  ('CONTRIBUTOR', 'site.access.private', CURRENT_TIMESTAMP),
  ('CONTRIBUTOR', 'contributions.submit', CURRENT_TIMESTAMP),
  ('CONTRIBUTOR', 'contributions.withdraw-own', CURRENT_TIMESTAMP),
  ('ADMINISTRATOR', 'site.access.private', CURRENT_TIMESTAMP),
  ('ADMINISTRATOR', 'admin.access', CURRENT_TIMESTAMP),
  ('ADMINISTRATOR', 'contributions.review', CURRENT_TIMESTAMP),
  ('ADMINISTRATOR', 'contributions.approve', CURRENT_TIMESTAMP),
  ('ADMINISTRATOR', 'contributions.reject', CURRENT_TIMESTAMP),
  ('ADMINISTRATOR', 'content.images.manage', CURRENT_TIMESTAMP),
  ('ADMINISTRATOR', 'content.items.create', CURRENT_TIMESTAMP),
  ('ADMINISTRATOR', 'content.items.edit', CURRENT_TIMESTAMP),
  ('ADMINISTRATOR', 'content.items.delete', CURRENT_TIMESTAMP),
  ('ADMINISTRATOR', 'content.items.verify', CURRENT_TIMESTAMP),
  ('ADMINISTRATOR', 'content.recipes.create', CURRENT_TIMESTAMP),
  ('ADMINISTRATOR', 'content.recipes.edit', CURRENT_TIMESTAMP),
  ('ADMINISTRATOR', 'content.recipes.delete', CURRENT_TIMESTAMP),
  ('ADMINISTRATOR', 'content.recipes.verify', CURRENT_TIMESTAMP),
  ('ADMINISTRATOR', 'content.professions.create', CURRENT_TIMESTAMP),
  ('ADMINISTRATOR', 'content.professions.edit', CURRENT_TIMESTAMP),
  ('ADMINISTRATOR', 'content.professions.delete', CURRENT_TIMESTAMP),
  ('ADMINISTRATOR', 'content.professions.verify', CURRENT_TIMESTAMP),
  ('ADMINISTRATOR', 'content.classes.create', CURRENT_TIMESTAMP),
  ('ADMINISTRATOR', 'content.classes.edit', CURRENT_TIMESTAMP),
  ('ADMINISTRATOR', 'content.classes.delete', CURRENT_TIMESTAMP),
  ('ADMINISTRATOR', 'content.classes.verify', CURRENT_TIMESTAMP),
  ('ADMINISTRATOR', 'content.locations.create', CURRENT_TIMESTAMP),
  ('ADMINISTRATOR', 'content.locations.edit', CURRENT_TIMESTAMP),
  ('ADMINISTRATOR', 'content.locations.delete', CURRENT_TIMESTAMP),
  ('ADMINISTRATOR', 'content.locations.verify', CURRENT_TIMESTAMP),
  ('ADMINISTRATOR', 'content.shops.create', CURRENT_TIMESTAMP),
  ('ADMINISTRATOR', 'content.shops.edit', CURRENT_TIMESTAMP),
  ('ADMINISTRATOR', 'content.shops.delete', CURRENT_TIMESTAMP),
  ('ADMINISTRATOR', 'content.shops.verify', CURRENT_TIMESTAMP),
  ('ADMINISTRATOR', 'content.currencies.create', CURRENT_TIMESTAMP),
  ('ADMINISTRATOR', 'content.currencies.edit', CURRENT_TIMESTAMP),
  ('ADMINISTRATOR', 'content.currencies.delete', CURRENT_TIMESTAMP),
  ('ADMINISTRATOR', 'content.currencies.verify', CURRENT_TIMESTAMP),
  ('ADMINISTRATOR', 'content.categories.create', CURRENT_TIMESTAMP),
  ('ADMINISTRATOR', 'content.categories.edit', CURRENT_TIMESTAMP),
  ('ADMINISTRATOR', 'content.game-versions.create', CURRENT_TIMESTAMP),
  ('ADMINISTRATOR', 'content.game-versions.edit', CURRENT_TIMESTAMP),
  ('ADMINISTRATOR', 'content.game-versions.delete', CURRENT_TIMESTAMP),
  ('ADMINISTRATOR', 'site.appearance.manage', CURRENT_TIMESTAMP),
  ('ADMINISTRATOR', 'site.design-review.view', CURRENT_TIMESTAMP),
  ('ADMINISTRATOR', 'users.view', CURRENT_TIMESTAMP),
  ('ADMINISTRATOR', 'audit.view', CURRENT_TIMESTAMP);
