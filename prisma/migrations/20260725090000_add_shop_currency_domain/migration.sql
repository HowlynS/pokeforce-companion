-- CreateTable
CREATE TABLE "Currency" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "symbol" TEXT,
    "description" TEXT,
    "image" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedGameVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Currency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "locationId" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "verifiedGameVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopListing" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "currencyId" TEXT NOT NULL,
    "priceAmount" INTEGER NOT NULL,
    "notes" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedGameVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopListing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Currency_slug_key" ON "Currency"("slug");

-- CreateIndex
CREATE INDEX "Currency_verifiedGameVersionId_idx" ON "Currency"("verifiedGameVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "Shop_slug_key" ON "Shop"("slug");

-- CreateIndex
CREATE INDEX "Shop_locationId_idx" ON "Shop"("locationId");

-- CreateIndex
CREATE INDEX "Shop_verifiedGameVersionId_idx" ON "Shop"("verifiedGameVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopListing_shopId_itemId_currencyId_key" ON "ShopListing"("shopId", "itemId", "currencyId");

-- CreateIndex
CREATE INDEX "ShopListing_itemId_idx" ON "ShopListing"("itemId");

-- CreateIndex
CREATE INDEX "ShopListing_currencyId_idx" ON "ShopListing"("currencyId");

-- CreateIndex
CREATE INDEX "ShopListing_verifiedGameVersionId_idx" ON "ShopListing"("verifiedGameVersionId");

-- AddForeignKey
ALTER TABLE "Currency" ADD CONSTRAINT "Currency_verifiedGameVersionId_fkey" FOREIGN KEY ("verifiedGameVersionId") REFERENCES "GameVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shop" ADD CONSTRAINT "Shop_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shop" ADD CONSTRAINT "Shop_verifiedGameVersionId_fkey" FOREIGN KEY ("verifiedGameVersionId") REFERENCES "GameVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopListing" ADD CONSTRAINT "ShopListing_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopListing" ADD CONSTRAINT "ShopListing_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopListing" ADD CONSTRAINT "ShopListing_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopListing" ADD CONSTRAINT "ShopListing_verifiedGameVersionId_fkey" FOREIGN KEY ("verifiedGameVersionId") REFERENCES "GameVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
