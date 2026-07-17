/*
  Warnings:

  - You are about to drop the column `rarity` on the `Item` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Item" DROP COLUMN "rarity",
ADD COLUMN     "heldItem" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedBuildId" TEXT;
