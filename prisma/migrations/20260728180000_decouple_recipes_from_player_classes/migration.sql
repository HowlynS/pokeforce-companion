-- Player Classes remain independent resources. Recipes no longer belong to
-- or require a Player Class.
--
-- This migration removes only the obsolete Recipe -> PlayerClass relation.
-- It preserves every Recipe row, every PlayerClass row, and every unrelated
-- Recipe field.

-- DropForeignKey
ALTER TABLE "Recipe" DROP CONSTRAINT "Recipe_playerClassId_fkey";

-- DropIndex
DROP INDEX "Recipe_playerClassId_idx";

-- AlterTable
ALTER TABLE "Recipe" DROP COLUMN "playerClassId";
