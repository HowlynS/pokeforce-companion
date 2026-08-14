// Removes the temporary Johto-inspired World dataset from the DEVELOPMENT
// database.
//
//   pnpm world:dev:cleanup
//
// Targeting: every row this deletes is identified by the deterministic
// WORLD_DEV_SLUG_PREFIX slug namespace — never by a remembered id list, and
// never by "everything in the table". User-authored rows (johto, route-31,
// route-32, real Items, real Currencies) carry no such prefix and are
// therefore unreachable from here. The prefix is length-checked first, so a
// mistyped or empty constant refuses to run rather than matching everything.
//
// Ordering respects the foreign keys the schema declares:
//   ShopListing (Restrict -> Shop)        deleted first
//   AcquisitionSource (SetNull -> Location) deleted before its Locations, so
//     cleanup leaves no orphaned source rows silently detached from a Location
//   Shop (Restrict -> Location)           deleted before its Locations
//   Location (Restrict -> parent Location) deleted deepest-first
//
// Idempotent: a second run finds nothing and reports zeroes.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { WORLD_DEV_SLUG_PREFIX } from "../src/lib/dev/world-dev-data";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  if (!WORLD_DEV_SLUG_PREFIX || WORLD_DEV_SLUG_PREFIX.length < 8) {
    throw new Error(
      "Refusing world dev cleanup: the slug prefix is missing or too short to be safe.",
    );
  }
  const prefix = { startsWith: WORLD_DEV_SLUG_PREFIX };

  const demoLocations = await prisma.location.findMany({
    where: { slug: prefix },
    select: { id: true },
  });
  const demoLocationIds = demoLocations.map((row) => row.id);

  const demoShops = await prisma.shop.findMany({
    where: { slug: prefix },
    select: { id: true },
  });
  const demoShopIds = demoShops.map((row) => row.id);

  // 1. Listings belonging to demo shops.
  const listings = await prisma.shopListing.deleteMany({
    where: { shopId: { in: demoShopIds } },
  });

  // 2. Acquisition sources attached to demo locations. Location's FK is
  //    SetNull, so skipping this would leave detached sources behind rather
  //    than blocking the delete — removed explicitly for that reason.
  const sources = await prisma.acquisitionSource.deleteMany({
    where: { locationId: { in: demoLocationIds } },
  });

  // 3. Demo shops.
  const shops = await prisma.shop.deleteMany({ where: { slug: prefix } });

  // 4. Demo locations, deepest-first. The parent self-relation is Restrict,
  //    so a parent cannot go before its children. Repeatedly delete rows that
  //    no longer have any child, which drains the tree from the leaves up.
  let locationsDeleted = 0;
  for (let pass = 0; pass < 25; pass += 1) {
    const remaining = await prisma.location.findMany({
      where: { slug: prefix },
      select: { id: true, _count: { select: { children: true } } },
    });
    if (remaining.length === 0) break;

    const leafIds = remaining
      .filter((row) => row._count.children === 0)
      .map((row) => row.id);
    if (leafIds.length === 0) {
      throw new Error(
        "Refusing to continue: demo locations remain but none is a leaf. " +
          "A non-demo Location may have been re-parented under demo data.",
      );
    }
    const result = await prisma.location.deleteMany({
      where: { id: { in: leafIds } },
    });
    locationsDeleted += result.count;
  }

  const [locationTotal, shopTotal, listingTotal, sourceTotal] = await Promise.all([
    prisma.location.count(),
    prisma.shop.count(),
    prisma.shopListing.count(),
    prisma.acquisitionSource.count(),
  ]);

  console.log("--- world dev data cleanup ---");
  console.log("listings deleted  :", listings.count);
  console.log("sources deleted   :", sources.count);
  console.log("shops deleted     :", shops.count);
  console.log("locations deleted :", locationsDeleted);
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
