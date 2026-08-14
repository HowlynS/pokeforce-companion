// Read-only audit of the DEVELOPMENT database's world-related tables.
//
//   pnpm world:dev:audit
//
// Reads .env (the same connection prisma/seed.ts uses) and never writes. Pass
// --verify to additionally re-run the shapes the public routes themselves
// query (/world, /locations, /locations/[slug], /shops, /shops/[slug]), so the
// populated data can be checked without needing to browse the gated site.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { WORLD_DEV_SLUG_PREFIX } from "../src/lib/dev/world-dev-data";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const prefix = { startsWith: WORLD_DEV_SLUG_PREFIX };

async function counts() {
  const [
    locations,
    shops,
    listings,
    sources,
    items,
    currencies,
    demoLocations,
    demoShops,
    demoListings,
    demoSources,
  ] = await Promise.all([
    prisma.location.count(),
    prisma.shop.count(),
    prisma.shopListing.count(),
    prisma.acquisitionSource.count(),
    prisma.item.count(),
    prisma.currency.count(),
    prisma.location.count({ where: { slug: prefix } }),
    prisma.shop.count({ where: { slug: prefix } }),
    prisma.shopListing.count({ where: { shop: { slug: prefix } } }),
    prisma.acquisitionSource.count({ where: { location: { slug: prefix } } }),
  ]);

  console.log("--- development database: world tables ---");
  console.log(`Locations          : ${locations}  (demo ${demoLocations}, other ${locations - demoLocations})`);
  console.log(`Shops              : ${shops}  (demo ${demoShops}, other ${shops - demoShops})`);
  console.log(`ShopListings       : ${listings}  (demo ${demoListings}, other ${listings - demoListings})`);
  console.log(`AcquisitionSources : ${sources}  (demo ${demoSources}, other ${sources - demoSources})`);
  console.log(`Items              : ${items}`);
  console.log(`Currencies         : ${currencies}`);

  const nonDemo = await prisma.location.findMany({
    where: { NOT: { slug: prefix } },
    select: { slug: true, name: true, type: true },
    orderBy: { slug: "asc" },
  });
  console.log("\n--- non-demo (user-authored) Locations, must be preserved ---");
  for (const row of nonDemo) console.log(`  ${row.slug}  [${row.type}]  ${row.name}`);
}

/** Depth of a location by walking parentId, root = 1. */
async function depthOf(id: string): Promise<number> {
  let depth = 1;
  let current: string | null = id;
  for (let step = 0; step < 25 && current; step += 1) {
    const row: { parentId: string | null } | null =
      await prisma.location.findUnique({
        where: { id: current },
        select: { parentId: true },
      });
    if (!row?.parentId) break;
    depth += 1;
    current = row.parentId;
  }
  return depth;
}

async function verify() {
  console.log("\n=== route-shaped verification (read-only) ===");

  // /locations — flat alphabetical index.
  const index = await prisma.location.findMany({
    select: { slug: true, name: true },
    orderBy: [{ name: "asc" }, { slug: "asc" }],
  });
  console.log(`\n/locations           : ${index.length} entries`);

  // /world — the containment tree.
  const all = await prisma.location.findMany({
    select: { id: true, slug: true, name: true, type: true, parentId: true },
  });
  const roots = all.filter((l) => !l.parentId);
  const childrenOf = new Map<string, typeof all>();
  for (const row of all) {
    if (!row.parentId) continue;
    childrenOf.set(row.parentId, [...(childrenOf.get(row.parentId) ?? []), row]);
  }
  console.log(`/world roots         : ${roots.map((r) => r.name).join(", ")}`);

  let deepest = { name: "", depth: 0, path: "" };
  for (const row of all) {
    const depth = await depthOf(row.id);
    if (depth > deepest.depth) {
      // Rebuild the path for the report.
      const path: string[] = [];
      let cursor: string | null = row.id;
      for (let step = 0; step < 25 && cursor; step += 1) {
        const node = all.find((l) => l.id === cursor);
        if (!node) break;
        path.unshift(node.name);
        cursor = node.parentId;
      }
      deepest = { name: row.name, depth, path: path.join(" > ") };
    }
  }
  console.log(`deepest branch       : ${deepest.depth} levels`);
  console.log(`                       ${deepest.path}`);

  const broadest = [...childrenOf.entries()]
    .map(([id, kids]) => ({
      name: all.find((l) => l.id === id)?.name ?? "?",
      count: kids.length,
    }))
    .sort((a, b) => b.count - a.count)[0];
  console.log(`broadest branch      : ${broadest.name} (${broadest.count} direct children)`);

  // /shops — list with location and inventory counts.
  const shops = await prisma.shop.findMany({
    select: {
      slug: true,
      name: true,
      location: { select: { name: true } },
      _count: { select: { listings: true } },
    },
    orderBy: [{ name: "asc" }],
  });
  console.log(`\n/shops               : ${shops.length} shops`);
  for (const shop of shops) {
    console.log(
      `  ${shop.name.padEnd(28)} @ ${(shop.location.name + "").padEnd(22)} ${shop._count.listings} listings`,
    );
  }

  // Locations with more than one Shop.
  const byLocation = new Map<string, number>();
  for (const shop of shops) {
    byLocation.set(shop.location.name, (byLocation.get(shop.location.name) ?? 0) + 1);
  }
  const multi = [...byLocation.entries()].filter(([, n]) => n > 1);
  console.log(
    `locations w/ >1 shop : ${multi.map(([name, n]) => `${name} (${n})`).join(", ") || "none"}`,
  );

  // /locations/[slug] — obtainable items come ONLY from sources whose own
  // locationId is that location; parents never aggregate descendants.
  const withSources = await prisma.location.findMany({
    where: { acquisitionSources: { some: {} } },
    select: {
      name: true,
      slug: true,
      _count: { select: { acquisitionSources: true } },
    },
    orderBy: { name: "asc" },
  });
  console.log(`\nlocations w/ obtainable items : ${withSources.length}`);
  for (const row of withSources) {
    console.log(`  ${row.name.padEnd(28)} ${row._count.acquisitionSources} source(s)`);
  }

  // Non-aggregation spot check: Goldenrod City itself must have zero direct
  // sources even though its descendants have several.
  const goldenrod = await prisma.location.findUnique({
    where: { slug: `${WORLD_DEV_SLUG_PREFIX}goldenrod-city` },
    select: { _count: { select: { acquisitionSources: true, shops: true, children: true } } },
  });
  console.log(
    `\nGoldenrod City direct : ${goldenrod?._count.children ?? 0} children, ` +
      `${goldenrod?._count.shops ?? 0} shops, ` +
      `${goldenrod?._count.acquisitionSources ?? 0} acquisition sources ` +
      `(0 expected — descendants are never aggregated)`,
  );

  // /shops/[slug] — a sample inventory with real currency prices.
  const sample = await prisma.shop.findUnique({
    where: { slug: `${WORLD_DEV_SLUG_PREFIX}dept-2f-tools` },
    select: {
      name: true,
      location: { select: { name: true } },
      listings: {
        select: {
          priceAmount: true,
          item: { select: { name: true } },
          currency: { select: { name: true, symbol: true } },
        },
        orderBy: { item: { name: "asc" } },
      },
    },
  });
  if (sample) {
    console.log(`\n/shops/…dept-2f-tools : ${sample.name} @ ${sample.location.name}`);
    for (const listing of sample.listings) {
      console.log(
        `  ${listing.item.name.padEnd(22)} ${listing.priceAmount} ${listing.currency.symbol ?? listing.currency.name}`,
      );
    }
  }
}

async function main() {
  await counts();
  if (process.argv.includes("--verify")) await verify();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
