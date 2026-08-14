// Populates the DEVELOPMENT database with the temporary Johto-inspired World
// dataset defined in src/lib/dev/world-dev-data.ts.
//
//   pnpm world:dev:populate
//
// Idempotent: every Location/Shop is upserted by its deterministic prefixed
// slug, and every ShopListing by its (shopId, itemId, currencyId) unique key,
// so a second run updates in place instead of duplicating. AcquisitionSource
// has no natural unique key, so this script instead replaces exactly the
// sources attached to the demo Locations it owns (see below).
//
// Never destructive to user-authored data: it creates and updates only rows
// whose slug carries WORLD_DEV_SLUG_PREFIX, and references existing anchor
// Locations (johto, route-32) without modifying them. It issues no reset, no
// truncate, and no unscoped delete.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  WORLD_DEV_ANCHORS,
  WORLD_DEV_LISTINGS,
  WORLD_DEV_SHOPS,
  WORLD_DEV_SOURCES,
  worldDevLocationsInInsertOrder,
  worldDevMaxDepth,
  worldDevSlug,
} from "../src/lib/dev/world-dev-data";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  /** key -> Location id, for anchors and demo locations alike. */
  const locationIdByKey = new Map<string, string>();
  let anchorsReused = 0;
  let anchorsCreated = 0;

  // --- Anchors: reuse existing rows untouched; create only when absent. ----
  for (const anchor of WORLD_DEV_ANCHORS) {
    const existing = await prisma.location.findUnique({
      where: { slug: anchor.existingSlug },
      select: { id: true },
    });
    if (existing) {
      locationIdByKey.set(anchor.key, existing.id);
      anchorsReused += 1;
      continue;
    }
    const parentId = anchor.fallback.parentKey
      ? locationIdByKey.get(anchor.fallback.parentKey)
      : undefined;
    const created = await prisma.location.upsert({
      where: { slug: worldDevSlug(anchor.key) },
      update: {
        name: anchor.fallback.name,
        type: anchor.fallback.type,
        parentId: parentId ?? null,
      },
      create: {
        slug: worldDevSlug(anchor.key),
        name: anchor.fallback.name,
        type: anchor.fallback.type,
        parentId: parentId ?? null,
        description: anchor.fallback.description ?? null,
      },
      select: { id: true },
    });
    locationIdByKey.set(anchor.key, created.id);
    anchorsCreated += 1;
  }

  // --- Locations: parents before children, upserted by prefixed slug. ------
  const ordered = worldDevLocationsInInsertOrder();
  for (const location of ordered) {
    const parentId = location.parentKey
      ? locationIdByKey.get(location.parentKey)
      : undefined;
    if (location.parentKey && !parentId) {
      throw new Error(
        `Missing parent "${location.parentKey}" for location "${location.key}"`,
      );
    }
    const record = await prisma.location.upsert({
      where: { slug: worldDevSlug(location.key) },
      update: {
        name: location.name,
        type: location.type,
        parentId: parentId ?? null,
        description: location.description ?? null,
        accessNote: location.accessNote ?? null,
      },
      create: {
        slug: worldDevSlug(location.key),
        name: location.name,
        type: location.type,
        parentId: parentId ?? null,
        description: location.description ?? null,
        accessNote: location.accessNote ?? null,
      },
      select: { id: true },
    });
    locationIdByKey.set(location.key, record.id);
  }

  // --- Shops --------------------------------------------------------------
  const shopIdByKey = new Map<string, string>();
  for (const shop of WORLD_DEV_SHOPS) {
    const locationId = locationIdByKey.get(shop.locationKey);
    if (!locationId) {
      throw new Error(`Missing location "${shop.locationKey}" for shop "${shop.key}"`);
    }
    const record = await prisma.shop.upsert({
      where: { slug: worldDevSlug(shop.key) },
      update: {
        name: shop.name,
        locationId,
        description: shop.description ?? null,
      },
      create: {
        slug: worldDevSlug(shop.key),
        name: shop.name,
        locationId,
        description: shop.description ?? null,
      },
      select: { id: true },
    });
    shopIdByKey.set(shop.key, record.id);
  }

  // --- Resolve real Items and Currencies ----------------------------------
  const [items, currencies] = await Promise.all([
    prisma.item.findMany({ select: { id: true, slug: true } }),
    prisma.currency.findMany({ select: { id: true, slug: true } }),
  ]);
  const itemIdBySlug = new Map(items.map((i) => [i.slug, i.id] as const));
  const currencyIdBySlug = new Map(currencies.map((c) => [c.slug, c.id] as const));

  // --- ShopListings: upsert on the (shopId, itemId, currencyId) unique key -
  let listingsWritten = 0;
  const skippedListings: string[] = [];
  for (const listing of WORLD_DEV_LISTINGS) {
    const shopId = shopIdByKey.get(listing.shopKey);
    const itemId = itemIdBySlug.get(listing.itemSlug);
    const currencyId = currencyIdBySlug.get(listing.currencySlug);
    if (!shopId || !itemId || !currencyId) {
      skippedListings.push(
        `${listing.shopKey}/${listing.itemSlug}/${listing.currencySlug}`,
      );
      continue;
    }
    await prisma.shopListing.upsert({
      where: {
        shopId_itemId_currencyId: { shopId, itemId, currencyId },
      },
      update: {
        priceAmount: listing.priceAmount,
        notes: listing.notes ?? null,
      },
      create: {
        shopId,
        itemId,
        currencyId,
        priceAmount: listing.priceAmount,
        notes: listing.notes ?? null,
      },
    });
    listingsWritten += 1;
  }

  // --- AcquisitionSources -------------------------------------------------
  // No natural unique key exists, so idempotency comes from replacing exactly
  // the sources attached to the demo Locations this script owns. The delete is
  // scoped by locationId to those Locations only, so a user-authored source on
  // a NON-demo location (including the anchors) is never touched.
  const demoLocationIds = [...locationIdByKey.entries()]
    .filter(([key]) => !WORLD_DEV_ANCHORS.some((a) => a.key === key))
    .map(([, id]) => id);

  let sourcesWritten = 0;
  const skippedSources: string[] = [];
  await prisma.$transaction(async (tx) => {
    await tx.acquisitionSource.deleteMany({
      where: { locationId: { in: demoLocationIds } },
    });
    for (const source of WORLD_DEV_SOURCES) {
      const locationId = locationIdByKey.get(source.locationKey);
      const itemId = itemIdBySlug.get(source.itemSlug);
      if (!locationId || !itemId) {
        skippedSources.push(`${source.locationKey}/${source.itemSlug}`);
        continue;
      }
      await tx.acquisitionSource.create({
        data: {
          itemId,
          locationId,
          type: source.type,
          sourceLabel: source.sourceLabel ?? null,
          quantity: source.quantity ?? null,
          notes: source.notes ?? null,
        },
      });
      sourcesWritten += 1;
    }
  });

  // --- Report -------------------------------------------------------------
  const [locationTotal, shopTotal, listingTotal, sourceTotal] = await Promise.all([
    prisma.location.count(),
    prisma.shop.count(),
    prisma.shopListing.count(),
    prisma.acquisitionSource.count(),
  ]);

  console.log("--- world dev data populated ---");
  console.log("anchors reused        :", anchorsReused);
  console.log("anchors created       :", anchorsCreated);
  console.log("demo locations written:", ordered.length);
  console.log("demo shops written    :", shopIdByKey.size);
  console.log("listings written      :", listingsWritten);
  console.log("sources written       :", sourcesWritten);
  console.log("max hierarchy depth   :", worldDevMaxDepth());
  if (skippedListings.length > 0) {
    console.log("skipped listings (missing item/currency):", skippedListings.join(", "));
  }
  if (skippedSources.length > 0) {
    console.log("skipped sources (missing item):", skippedSources.join(", "));
  }
  console.log("\n--- database totals ---");
  console.log("Locations         :", locationTotal);
  console.log("Shops             :", shopTotal);
  console.log("ShopListings      :", listingTotal);
  console.log("AcquisitionSources:", sourceTotal);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
