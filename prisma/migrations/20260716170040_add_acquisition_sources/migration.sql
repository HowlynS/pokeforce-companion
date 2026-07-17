-- CreateEnum
CREATE TYPE "AcquisitionType" AS ENUM ('FORAGING', 'FISHING', 'FARMING', 'CRAFTING', 'MINING', 'ARCHAEOLOGY', 'COOKING', 'CONSTRUCTION', 'SMITHING', 'NPC_OR_SHOP', 'ENEMY_DROP', 'REWARD', 'CONTAINER', 'EXCHANGE', 'EVENT', 'OTHER');

-- CreateTable
CREATE TABLE "AcquisitionSource" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "type" "AcquisitionType" NOT NULL,
    "locationId" TEXT,
    "professionId" TEXT,
    "sourceLabel" TEXT,
    "notes" TEXT,
    "quantity" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBuildId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcquisitionSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AcquisitionSource_itemId_idx" ON "AcquisitionSource"("itemId");

-- CreateIndex
CREATE INDEX "AcquisitionSource_locationId_idx" ON "AcquisitionSource"("locationId");

-- CreateIndex
CREATE INDEX "AcquisitionSource_professionId_idx" ON "AcquisitionSource"("professionId");

-- AddForeignKey
ALTER TABLE "AcquisitionSource" ADD CONSTRAINT "AcquisitionSource_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcquisitionSource" ADD CONSTRAINT "AcquisitionSource_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcquisitionSource" ADD CONSTRAINT "AcquisitionSource_professionId_fkey" FOREIGN KEY ("professionId") REFERENCES "Profession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
