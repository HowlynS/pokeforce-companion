-- Slice 9A: relational Game Version verification.
--
-- Replaces the string column `verifiedBuildId` (Item, Location,
-- AcquisitionSource) with a relational `verifiedGameVersionId` reference to
-- the new GameVersion table, and adds verification fields to Recipe and
-- Profession. Category deliberately gains nothing — it stays
-- non-verifiable.
--
-- This migration was written by hand (not applied from the auto-generated
-- diff) because the generated SQL would have dropped `verifiedBuildId`
-- while it still held data. The order below preserves every existing
-- verification stamp:
--   1. create GameVersion;
--   2. add the new nullable columns alongside the legacy ones;
--   3. create one GameVersion row per distinct legacy build identifier
--      (name = the exact legacy string, isCurrent = false — an admin
--      promotes a version explicitly through the new settings screen);
--   4. point every legacy-stamped row at its GameVersion;
--   5. VERIFY (fail the whole migration if any stamped row was not
--      linked) — historical verification data is never silently dropped;
--   6. only then drop the legacy columns;
--   7. add indexes and RESTRICT foreign keys.

-- 1. CreateTable
CREATE TABLE "GameVersion" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "releaseDate" TIMESTAMP(3),
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GameVersion_name_key" ON "GameVersion"("name");

-- 2. Add the new columns; the legacy verifiedBuildId columns stay in place
--    until the data has been carried over and verified.
ALTER TABLE "Item" ADD COLUMN "verifiedGameVersionId" TEXT;
ALTER TABLE "Location" ADD COLUMN "verifiedGameVersionId" TEXT;
ALTER TABLE "AcquisitionSource" ADD COLUMN "verifiedGameVersionId" TEXT;
ALTER TABLE "Recipe" ADD COLUMN "verifiedAt" TIMESTAMP(3),
    ADD COLUMN "verifiedGameVersionId" TEXT;
ALTER TABLE "Profession" ADD COLUMN "verifiedAt" TIMESTAMP(3),
    ADD COLUMN "verifiedGameVersionId" TEXT;

-- 3. One GameVersion per distinct legacy build identifier. The name is the
--    exact legacy string (e.g. "dev-build-1"), so the historical meaning of
--    every stamp is preserved verbatim. gen_random_uuid() is available on
--    Supabase Postgres (pgcrypto); the id column is TEXT, matching Prisma's
--    client-generated cuids, so a uuid string is a valid id.
INSERT INTO "GameVersion" ("id", "name", "isCurrent", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, legacy.build, false, now(), now()
FROM (
    SELECT DISTINCT "verifiedBuildId" AS build FROM "Item" WHERE "verifiedBuildId" IS NOT NULL
    UNION
    SELECT DISTINCT "verifiedBuildId" FROM "Location" WHERE "verifiedBuildId" IS NOT NULL
    UNION
    SELECT DISTINCT "verifiedBuildId" FROM "AcquisitionSource" WHERE "verifiedBuildId" IS NOT NULL
) AS legacy;

-- 4. Link every legacy-stamped row to its GameVersion by exact name match.
--    verifiedAt is not touched: every historical timestamp survives as-is.
UPDATE "Item" i
SET "verifiedGameVersionId" = gv."id"
FROM "GameVersion" gv
WHERE i."verifiedBuildId" IS NOT NULL AND gv."name" = i."verifiedBuildId";

UPDATE "Location" l
SET "verifiedGameVersionId" = gv."id"
FROM "GameVersion" gv
WHERE l."verifiedBuildId" IS NOT NULL AND gv."name" = l."verifiedBuildId";

UPDATE "AcquisitionSource" s
SET "verifiedGameVersionId" = gv."id"
FROM "GameVersion" gv
WHERE s."verifiedBuildId" IS NOT NULL AND gv."name" = s."verifiedBuildId";

-- 5. Fail closed: if any stamped row was somehow not linked, abort the
--    whole migration (it runs in a transaction) instead of dropping data.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "Item" WHERE "verifiedBuildId" IS NOT NULL AND "verifiedGameVersionId" IS NULL)
       OR EXISTS (SELECT 1 FROM "Location" WHERE "verifiedBuildId" IS NOT NULL AND "verifiedGameVersionId" IS NULL)
       OR EXISTS (SELECT 1 FROM "AcquisitionSource" WHERE "verifiedBuildId" IS NOT NULL AND "verifiedGameVersionId" IS NULL)
    THEN
        RAISE EXCEPTION 'Refusing to drop verifiedBuildId: a verified row was not linked to a GameVersion.';
    END IF;
END
$$;

-- 6. Only now is the legacy column safe to drop.
ALTER TABLE "Item" DROP COLUMN "verifiedBuildId";
ALTER TABLE "Location" DROP COLUMN "verifiedBuildId";
ALTER TABLE "AcquisitionSource" DROP COLUMN "verifiedBuildId";

-- 7. CreateIndex
CREATE INDEX "AcquisitionSource_verifiedGameVersionId_idx" ON "AcquisitionSource"("verifiedGameVersionId");
CREATE INDEX "Item_verifiedGameVersionId_idx" ON "Item"("verifiedGameVersionId");
CREATE INDEX "Location_verifiedGameVersionId_idx" ON "Location"("verifiedGameVersionId");
CREATE INDEX "Profession_verifiedGameVersionId_idx" ON "Profession"("verifiedGameVersionId");
CREATE INDEX "Recipe_verifiedGameVersionId_idx" ON "Recipe"("verifiedGameVersionId");

-- AddForeignKey: RESTRICT, so the database itself refuses to delete a
-- GameVersion while any verification stamp still references it.
ALTER TABLE "Item" ADD CONSTRAINT "Item_verifiedGameVersionId_fkey" FOREIGN KEY ("verifiedGameVersionId") REFERENCES "GameVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Profession" ADD CONSTRAINT "Profession_verifiedGameVersionId_fkey" FOREIGN KEY ("verifiedGameVersionId") REFERENCES "GameVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_verifiedGameVersionId_fkey" FOREIGN KEY ("verifiedGameVersionId") REFERENCES "GameVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Location" ADD CONSTRAINT "Location_verifiedGameVersionId_fkey" FOREIGN KEY ("verifiedGameVersionId") REFERENCES "GameVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AcquisitionSource" ADD CONSTRAINT "AcquisitionSource_verifiedGameVersionId_fkey" FOREIGN KEY ("verifiedGameVersionId") REFERENCES "GameVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
