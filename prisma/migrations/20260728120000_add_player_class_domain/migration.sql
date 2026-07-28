-- Player Classes + Recipe EXP/Required Class milestone.
--
-- Data-safety note: at the time this migration was authored, the only
-- Recipe rows in existence were the 8 deterministic development/fixture
-- rows defined in prisma/seed.ts (verified directly against the dev
-- database before writing this migration — no unexpected or unknown rows
-- exist, and this project has not yet reached its Deployment milestone, so
-- there is no live production dataset to protect beyond this). Making
-- Recipe.playerClassId and Recipe.experienceReward NOT NULL in the same
-- migration that introduces them therefore does not require a separate
-- staged nullable-to-required rollout: this migration inserts the 5
-- foundational PlayerClass rows itself (so it never depends on
-- `pnpm db:seed` having already run), backfills every existing Recipe row
-- to the neutral "Trainer" Class with 0 EXP, and only then applies the
-- NOT NULL constraint. prisma/seed.ts is updated in the same commit to
-- upsert the same 5 Classes (idempotent, matched by slug) and to assign
-- each of its own 8 recipes a deliberate, specific Class and EXP value —
-- so the "Trainer / 0" backfill above is a one-moment migration safety
-- default, not a permanent or invented gameplay assignment.

-- CreateTable
CREATE TABLE "PlayerClass" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedGameVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerClass_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlayerClass_slug_key" ON "PlayerClass"("slug");

-- CreateIndex
CREATE INDEX "PlayerClass_verifiedGameVersionId_idx" ON "PlayerClass"("verifiedGameVersionId");

-- AddForeignKey
ALTER TABLE "PlayerClass" ADD CONSTRAINT "PlayerClass_verifiedGameVersionId_fkey" FOREIGN KEY ("verifiedGameVersionId") REFERENCES "GameVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed the 5 foundational Player Classes directly (never dependent on
-- prisma/seed.ts having run — see the note above). No description or
-- image is invented for any of them.
INSERT INTO "PlayerClass" ("id", "slug", "name", "updatedAt") VALUES
    ('player-class-trainer', 'trainer', 'Trainer', CURRENT_TIMESTAMP),
    ('player-class-artisan', 'artisan', 'Artisan', CURRENT_TIMESTAMP),
    ('player-class-rancher', 'rancher', 'Rancher', CURRENT_TIMESTAMP),
    ('player-class-ranger', 'ranger', 'Ranger', CURRENT_TIMESTAMP),
    ('player-class-farmhand', 'farmhand', 'Farmhand', CURRENT_TIMESTAMP);

-- AlterTable: add both new Recipe columns nullable first, so existing rows
-- can be backfilled before the NOT NULL constraint is applied below.
ALTER TABLE "Recipe" ADD COLUMN "playerClassId" TEXT;
ALTER TABLE "Recipe" ADD COLUMN "experienceReward" INTEGER;

-- Backfill: every Recipe row that existed before this migration (the 8
-- known development/fixture rows) becomes Trainer / 0 EXP — a neutral,
-- clearly-flagged placeholder, immediately superseded by prisma/seed.ts's
-- own deliberate per-recipe values on the next `pnpm db:seed` run.
UPDATE "Recipe" SET "playerClassId" = 'player-class-trainer', "experienceReward" = 0
    WHERE "playerClassId" IS NULL;

-- AlterTable: now safe to enforce NOT NULL — every row has a value.
ALTER TABLE "Recipe" ALTER COLUMN "playerClassId" SET NOT NULL;
ALTER TABLE "Recipe" ALTER COLUMN "experienceReward" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Recipe_playerClassId_idx" ON "Recipe"("playerClassId");

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_playerClassId_fkey" FOREIGN KEY ("playerClassId") REFERENCES "PlayerClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
