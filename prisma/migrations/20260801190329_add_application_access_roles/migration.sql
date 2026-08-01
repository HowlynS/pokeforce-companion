-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('MEMBER', 'CONTRIBUTOR', 'ADMINISTRATOR', 'OWNER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "SiteVisibility" AS ENUM ('PRIVATE_BETA', 'PUBLIC');

-- CreateTable
CREATE TABLE "AppUser" (
    "id" TEXT NOT NULL,
    "authUserId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'MEMBER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "disabledAt" TIMESTAMP(3),
    "disabledById" TEXT,
    "lastKnownSignInAt" TIMESTAMP(3),

    CONSTRAINT "AppUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteAccessSettings" (
    "id" TEXT NOT NULL DEFAULT 'site',
    "visibility" "SiteVisibility" NOT NULL DEFAULT 'PRIVATE_BETA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteAccessSettings_pkey" PRIMARY KEY ("id")
);

-- Start fail-closed. Runtime code also upserts this singleton defensively,
-- but the migration itself must never leave a fresh deployment public.
INSERT INTO "SiteAccessSettings" ("id", "visibility", "createdAt", "updatedAt")
VALUES ('site', 'PRIVATE_BETA', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- CreateIndex
CREATE UNIQUE INDEX "AppUser_authUserId_key" ON "AppUser"("authUserId");

-- CreateIndex
CREATE UNIQUE INDEX "AppUser_email_key" ON "AppUser"("email");

-- CreateIndex
CREATE INDEX "AppUser_role_status_idx" ON "AppUser"("role", "status");

-- CreateIndex
CREATE INDEX "AppUser_createdById_idx" ON "AppUser"("createdById");

-- CreateIndex
CREATE INDEX "AppUser_disabledById_idx" ON "AppUser"("disabledById");

-- AddForeignKey
ALTER TABLE "AppUser" ADD CONSTRAINT "AppUser_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppUser" ADD CONSTRAINT "AppUser_disabledById_fkey" FOREIGN KEY ("disabledById") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
