// Deterministic definition of the TEMPORARY Johto-inspired World dataset used
// to judge /world, /locations, and /shops against the real development
// database in normal local browsing.
//
// This module is pure data plus pure helpers. It is imported ONLY by
// scripts/world-dev-data-populate.ts, scripts/world-dev-data-cleanup.ts,
// scripts/world-dev-data-audit.ts, and its own unit test — never by a route,
// server action, or component, so nothing here can reach the application.
//
// Deletion namespace: every row this dataset creates carries a slug beginning
// with WORLD_DEV_SLUG_PREFIX. That prefix is the whole cleanup contract —
// removal is "delete rows whose slug starts with the prefix", never "remember
// which ids we inserted". User-authored rows never carry it and are therefore
// untouchable by the cleanup script.
//
// Anchors are the one exception: this dataset attaches to Locations that
// already exist in the development database (johto, route-32) instead of
// creating rival copies of them. An anchor row is NEVER created, modified, or
// deleted when it already exists — only referenced as a parentId. When an
// anchor is absent (a fresh database), a prefixed stand-in is created so the
// script stays portable, and that stand-in IS cleanup-eligible like any other
// prefixed row.

export const WORLD_DEV_SLUG_PREFIX = "dev-world-";

export type WorldDevLocationType =
  | "REGION"
  | "ROUTE"
  | "TOWN"
  | "BUILDING"
  | "DUNGEON"
  | "SUB_AREA"
  | "SPECIAL_AREA";

export type WorldDevAcquisitionType =
  | "FORAGING"
  | "FISHING"
  | "FARMING"
  | "MINING"
  | "ARCHAEOLOGY"
  | "CONTAINER"
  | "EXCHANGE"
  | "REWARD"
  | "EVENT"
  | "OTHER";

/** A Location that already exists in the dev database and is only referenced. */
export type WorldDevAnchor = {
  key: string;
  /** Slug to look for. Reused as-is when present; never modified. */
  existingSlug: string;
  /** Used only when the anchor slug is absent, e.g. on a fresh database. */
  fallback: {
    name: string;
    type: WorldDevLocationType;
    parentKey?: string;
    description?: string;
  };
};

export type WorldDevLocation = {
  /** Slug suffix; the real slug is WORLD_DEV_SLUG_PREFIX + key. */
  key: string;
  name: string;
  type: WorldDevLocationType;
  /** Anchor key or another location key. Omitted only for a root. */
  parentKey?: string;
  description?: string;
  accessNote?: string;
};

export type WorldDevShop = {
  key: string;
  name: string;
  locationKey: string;
  description?: string;
};

export type WorldDevListing = {
  shopKey: string;
  itemSlug: string;
  currencySlug: string;
  priceAmount: number;
  notes?: string;
};

export type WorldDevSource = {
  itemSlug: string;
  type: WorldDevAcquisitionType;
  locationKey: string;
  sourceLabel?: string;
  quantity?: string;
  notes?: string;
};

export function worldDevSlug(key: string): string {
  return `${WORLD_DEV_SLUG_PREFIX}${key}`;
}

// ---------------------------------------------------------------------------
// Anchors — existing dev rows this dataset hangs off of.
// ---------------------------------------------------------------------------

export const WORLD_DEV_ANCHORS: WorldDevAnchor[] = [
  {
    key: "johto",
    existingSlug: "johto",
    fallback: { name: "Johto", type: "REGION" },
  },
  {
    key: "route-32",
    existingSlug: "route-32",
    fallback: { name: "Route 32", type: "ROUTE", parentKey: "johto" },
  },
];

// ---------------------------------------------------------------------------
// Locations
// ---------------------------------------------------------------------------
//
// Descriptions are deliberately uneven: several Locations carry none, and most
// carry no accessNote, so the public pages' hide-empty behavior stays visible
// against real data rather than being masked by uniformly populated fields.

export const WORLD_DEV_LOCATIONS: WorldDevLocation[] = [
  // --- Goldenrod City: the broadest branch (10 direct children) -------------
  {
    key: "goldenrod-city",
    name: "Goldenrod City",
    type: "TOWN",
    parentKey: "johto",
    description:
      "Johto's largest commercial hub, built around the department store and the radio tower.",
  },

  // 1. Department store, the deep branch's trunk.
  {
    key: "goldenrod-dept-store",
    name: "Goldenrod Department Store",
    type: "BUILDING",
    parentKey: "goldenrod-city",
    description: "Six retail floors and a seasonal rooftop terrace.",
  },
  {
    key: "goldenrod-dept-1f",
    name: "1F",
    type: "SUB_AREA",
    parentKey: "goldenrod-dept-store",
    description: "Service counter and general goods.",
  },
  {
    key: "goldenrod-dept-2f",
    name: "2F",
    type: "SUB_AREA",
    parentKey: "goldenrod-dept-store",
    description: "Tools and crafting supplies.",
  },
  {
    key: "goldenrod-dept-3f",
    name: "3F",
    type: "SUB_AREA",
    parentKey: "goldenrod-dept-store",
  },
  {
    key: "goldenrod-dept-4f",
    name: "4F",
    type: "SUB_AREA",
    parentKey: "goldenrod-dept-store",
    description: "Battle supplies and restoratives.",
  },
  {
    key: "goldenrod-dept-5f",
    name: "5F",
    type: "SUB_AREA",
    parentKey: "goldenrod-dept-store",
    description: "Rare goods counter and the stockroom entrance.",
  },
  {
    key: "goldenrod-dept-rooftop",
    name: "Rooftop",
    type: "SUB_AREA",
    parentKey: "goldenrod-dept-store",
    description: "Seasonal stalls, open in fair weather.",
    accessNote: "Closed during storms.",
  },

  // Deep hierarchy stress case, continuing beneath 5F:
  // johto > goldenrod-city > dept-store > 5f > stockroom > lower-stockroom
  //   > archive-vault > sealed-crate-row  (8 levels deep)
  {
    key: "goldenrod-dept-stockroom",
    name: "Stockroom",
    type: "SUB_AREA",
    parentKey: "goldenrod-dept-5f",
    description: "Staff-only storage behind the rare goods counter.",
    accessNote: "Staff access only.",
  },
  {
    key: "goldenrod-dept-lower-stockroom",
    name: "Lower Stockroom",
    type: "SUB_AREA",
    parentKey: "goldenrod-dept-stockroom",
  },
  {
    key: "goldenrod-dept-archive-vault",
    name: "Archive Vault",
    type: "SUB_AREA",
    parentKey: "goldenrod-dept-lower-stockroom",
    description: "Long-term storage for unsold stock and old ledgers.",
  },
  {
    key: "goldenrod-dept-sealed-crate-row",
    name: "Sealed Crate Row",
    type: "SUB_AREA",
    parentKey: "goldenrod-dept-archive-vault",
    description: "The deepest indexed aisle. Crates here are rarely opened.",
    accessNote: "Requires a manager key.",
  },

  // 2. Underground
  {
    key: "goldenrod-underground",
    name: "Goldenrod Underground",
    type: "DUNGEON",
    parentKey: "goldenrod-city",
    description: "A pedestrian tunnel network linking the north and south gates.",
  },
  {
    key: "goldenrod-underground-north",
    name: "North Tunnel",
    type: "SUB_AREA",
    parentKey: "goldenrod-underground",
  },
  {
    key: "goldenrod-underground-south",
    name: "South Tunnel",
    type: "SUB_AREA",
    parentKey: "goldenrod-underground",
    description: "Damp and poorly lit; traders set up along the walls.",
  },

  // 3-10. Remaining direct children of Goldenrod City.
  {
    key: "goldenrod-game-corner",
    name: "Goldenrod Game Corner",
    type: "BUILDING",
    parentKey: "goldenrod-city",
    description: "Prize counter and game floor.",
  },
  {
    key: "goldenrod-station",
    name: "Goldenrod Station",
    type: "BUILDING",
    parentKey: "goldenrod-city",
    description: "The magnet train terminal.",
  },
  {
    key: "goldenrod-flower-shop-district",
    name: "Flower Shop District",
    type: "SUB_AREA",
    parentKey: "goldenrod-city",
  },
  {
    key: "goldenrod-radio-tower-plaza",
    name: "Radio Tower Plaza",
    type: "SUB_AREA",
    parentKey: "goldenrod-city",
    description: "The open plaza beneath the broadcast tower.",
  },
  {
    key: "goldenrod-bike-shop-district",
    name: "Bike Shop District",
    type: "SUB_AREA",
    parentKey: "goldenrod-city",
  },
  {
    key: "goldenrod-market-street",
    name: "Market Street",
    type: "SUB_AREA",
    parentKey: "goldenrod-city",
    description: "An open-air run of independent traders.",
  },
  {
    key: "goldenrod-back-alley",
    name: "Back Alley",
    type: "SUB_AREA",
    parentKey: "goldenrod-city",
    accessNote: "Poorly lit after dark.",
  },
  {
    key: "goldenrod-residential-quarter",
    name: "Residential Quarter",
    type: "SUB_AREA",
    parentKey: "goldenrod-city",
  },

  // --- Violet City ---------------------------------------------------------
  {
    key: "violet-city",
    name: "Violet City",
    type: "TOWN",
    parentKey: "johto",
    description: "A quiet town of slate roofs, best known for Sprout Tower.",
  },
  {
    key: "violet-sprout-tower",
    name: "Sprout Tower",
    type: "BUILDING",
    parentKey: "violet-city",
    description: "A three-storey wooden tower built around a single swaying pillar.",
  },
  {
    key: "violet-sprout-1f",
    name: "1F",
    type: "SUB_AREA",
    parentKey: "violet-sprout-tower",
  },
  {
    key: "violet-sprout-2f",
    name: "2F",
    type: "SUB_AREA",
    parentKey: "violet-sprout-tower",
  },
  {
    key: "violet-sprout-3f",
    name: "3F",
    type: "SUB_AREA",
    parentKey: "violet-sprout-tower",
    description: "The top floor, where the central pillar is closest.",
  },
  {
    key: "violet-poke-mart",
    name: "Violet Poké Mart",
    type: "BUILDING",
    parentKey: "violet-city",
    description: "Standard-issue town supplies.",
  },
  {
    key: "violet-pokemon-center",
    name: "Violet Pokémon Center",
    type: "BUILDING",
    parentKey: "violet-city",
  },
  {
    key: "violet-training-yard",
    name: "Training Yard",
    type: "SUB_AREA",
    parentKey: "violet-city",
    description: "Packed earth and practice posts behind the gym.",
  },
  {
    key: "violet-east-gate",
    name: "East Gate",
    type: "SUB_AREA",
    parentKey: "violet-city",
  },

  // --- Olivine City --------------------------------------------------------
  {
    key: "olivine-city",
    name: "Olivine City",
    type: "TOWN",
    parentKey: "johto",
    description: "A working port town under the shadow of its lighthouse.",
  },
  {
    key: "olivine-lighthouse",
    name: "Olivine Lighthouse",
    type: "BUILDING",
    parentKey: "olivine-city",
    description: "Six floors of switchback stairs and salt-worn railings.",
  },
  {
    key: "olivine-lighthouse-1f",
    name: "1F",
    type: "SUB_AREA",
    parentKey: "olivine-lighthouse",
  },
  {
    key: "olivine-lighthouse-2f",
    name: "2F",
    type: "SUB_AREA",
    parentKey: "olivine-lighthouse",
  },
  {
    key: "olivine-lighthouse-3f",
    name: "3F",
    type: "SUB_AREA",
    parentKey: "olivine-lighthouse",
  },
  {
    key: "olivine-lighthouse-4f",
    name: "4F",
    type: "SUB_AREA",
    parentKey: "olivine-lighthouse",
  },
  {
    key: "olivine-lighthouse-5f",
    name: "5F",
    type: "SUB_AREA",
    parentKey: "olivine-lighthouse",
  },
  {
    key: "olivine-lighthouse-6f",
    name: "6F",
    type: "SUB_AREA",
    parentKey: "olivine-lighthouse",
    description: "The lamp room at the top of the tower.",
    accessNote: "Keeper's permission required.",
  },
  {
    key: "olivine-harbor",
    name: "Olivine Harbor",
    type: "SUB_AREA",
    parentKey: "olivine-city",
    description: "Deep-water berths and the ferry terminal.",
  },
  {
    key: "olivine-harbor-pier",
    name: "Pier",
    type: "SUB_AREA",
    parentKey: "olivine-harbor",
    description: "A long stone pier, popular with anglers.",
  },
  {
    key: "olivine-harbor-warehouse",
    name: "Warehouse",
    type: "SUB_AREA",
    parentKey: "olivine-harbor",
  },
  {
    key: "olivine-harbor-dock-office",
    name: "Dock Office",
    type: "SUB_AREA",
    parentKey: "olivine-harbor",
    accessNote: "Open during sailing hours.",
  },
  {
    key: "olivine-poke-mart",
    name: "Olivine Poké Mart",
    type: "BUILDING",
    parentKey: "olivine-city",
  },
  {
    key: "olivine-pokemon-center",
    name: "Olivine Pokémon Center",
    type: "BUILDING",
    parentKey: "olivine-city",
  },
  {
    key: "olivine-seaside-market",
    name: "Seaside Market",
    type: "SUB_AREA",
    parentKey: "olivine-city",
    description: "Morning stalls along the seawall.",
  },

  // --- Route 32 (attached to the existing route-32 anchor) -----------------
  {
    key: "route-32-pokemon-center",
    name: "Route 32 Pokémon Center",
    type: "BUILDING",
    parentKey: "route-32",
    description: "The waypoint centre north of Union Cave.",
  },
  {
    key: "route-32-fishing-spot",
    name: "Fishing Spot",
    type: "SUB_AREA",
    parentKey: "route-32",
    description: "A sheltered bank where the current slows.",
  },
  {
    key: "route-32-roadside-market",
    name: "Roadside Market",
    type: "SUB_AREA",
    parentKey: "route-32",
  },
  {
    key: "route-32-ruins-side-path",
    name: "Ruins-side Path",
    type: "SUB_AREA",
    parentKey: "route-32",
    description: "A narrow track running toward the Ruins of Alph.",
  },
  {
    key: "route-32-cliffside-rest-area",
    name: "Cliffside Rest Area",
    type: "SUB_AREA",
    parentKey: "route-32",
    accessNote: "Exposed in high wind.",
  },
];

// ---------------------------------------------------------------------------
// Shops
// ---------------------------------------------------------------------------
// Coverage this spread is designed to exercise: one shop at a Location, two
// shops at one Location (market-street, seaside-market), shops nested several
// levels deep inside a building, and tiny/normal/large inventories.

export const WORLD_DEV_SHOPS: WorldDevShop[] = [
  {
    key: "dept-1f-service-counter",
    name: "1F Service Counter",
    locationKey: "goldenrod-dept-1f",
    description: "General goods and gift wrapping.",
  },
  {
    key: "dept-2f-tools",
    name: "2F Tools & Crafting",
    locationKey: "goldenrod-dept-2f",
    description: "The largest tool counter in Johto.",
  },
  {
    key: "dept-3f-household",
    name: "3F Household Goods",
    locationKey: "goldenrod-dept-3f",
  },
  {
    key: "dept-4f-battle-supplies",
    name: "4F Battle Supplies",
    locationKey: "goldenrod-dept-4f",
    description: "Restoratives and field gear.",
  },
  {
    key: "dept-5f-rare-goods",
    name: "5F Rare Goods",
    locationKey: "goldenrod-dept-5f",
    description: "Limited stock, rotated weekly.",
  },
  {
    key: "dept-rooftop-stand",
    name: "Rooftop Seasonal Stand",
    locationKey: "goldenrod-dept-rooftop",
  },
  {
    key: "goldenrod-bike-shop",
    name: "Goldenrod Bike Shop",
    locationKey: "goldenrod-bike-shop-district",
    description: "Repairs, parts, and the occasional trade-in.",
  },
  {
    key: "goldenrod-flower-shop",
    name: "Goldenrod Flower Shop",
    locationKey: "goldenrod-flower-shop-district",
  },
  {
    key: "market-street-grocer",
    name: "Market Street Grocer",
    locationKey: "goldenrod-market-street",
    description: "Produce, water, and preserved goods.",
  },
  {
    key: "market-street-ore-trader",
    name: "Market Street Ore Trader",
    locationKey: "goldenrod-market-street",
    description: "Raw ore bought and sold by weight.",
  },
  {
    key: "underground-bargain-stall",
    name: "Underground Bargain Stall",
    locationKey: "goldenrod-underground-north",
  },
  {
    key: "goldenrod-station-kiosk",
    name: "Station Kiosk",
    locationKey: "goldenrod-station",
  },
  {
    key: "violet-poke-mart-shop",
    name: "Violet Poké Mart",
    locationKey: "violet-poke-mart",
    description: "Standard town stock.",
  },
  {
    key: "olivine-poke-mart-shop",
    name: "Olivine Poké Mart",
    locationKey: "olivine-poke-mart",
  },
  {
    key: "harbor-supply-shop",
    name: "Harbor Supply Shop",
    locationKey: "olivine-harbor-warehouse",
    description: "Rope, tackle, and bulk crafting stock for the docks.",
  },
  {
    key: "seaside-market-stall",
    name: "Seaside Market Stall",
    locationKey: "olivine-seaside-market",
  },
  {
    key: "seaside-fishmonger",
    name: "Seaside Fishmonger",
    locationKey: "olivine-seaside-market",
    description: "Whatever came in on the morning boats.",
  },
  {
    key: "route-32-roadside-vendor",
    name: "Route 32 Roadside Vendor",
    locationKey: "route-32-roadside-market",
  },
];

// ---------------------------------------------------------------------------
// Shop inventory
// ---------------------------------------------------------------------------
// Item and currency slugs are resolved against whatever the development
// database actually holds; a listing whose item or currency is missing is
// skipped with a warning rather than failing the run.

export const WORLD_DEV_LISTINGS: WorldDevListing[] = [
  // Large: 2F Tools (11)
  { shopKey: "dept-2f-tools", itemSlug: "smiths-hammer", currencySlug: "poke-yen", priceAmount: 2400 },
  { shopKey: "dept-2f-tools", itemSlug: "whetstone", currencySlug: "poke-yen", priceAmount: 700 },
  { shopKey: "dept-2f-tools", itemSlug: "iron-ingot", currencySlug: "poke-yen", priceAmount: 950 },
  { shopKey: "dept-2f-tools", itemSlug: "copper-ingot", currencySlug: "poke-yen", priceAmount: 820 },
  { shopKey: "dept-2f-tools", itemSlug: "leather-strap", currencySlug: "poke-yen", priceAmount: 260 },
  { shopKey: "dept-2f-tools", itemSlug: "wood", currencySlug: "poke-yen", priceAmount: 90 },
  { shopKey: "dept-2f-tools", itemSlug: "charcoal", currencySlug: "poke-yen", priceAmount: 140 },
  { shopKey: "dept-2f-tools", itemSlug: "iron-ore", currencySlug: "poke-yen", priceAmount: 180 },
  { shopKey: "dept-2f-tools", itemSlug: "copper-ore", currencySlug: "poke-yen", priceAmount: 160 },
  { shopKey: "dept-2f-tools", itemSlug: "iron-sword", currencySlug: "poke-yen", priceAmount: 5200 },
  {
    shopKey: "dept-2f-tools",
    itemSlug: "smiths-hammer",
    currencySlug: "runes",
    priceAmount: 12,
    notes: "Members' price.",
  },

  // Large: 5F Rare Goods (10)
  { shopKey: "dept-5f-rare-goods", itemSlug: "reinforced-shield", currencySlug: "poke-yen", priceAmount: 8800 },
  { shopKey: "dept-5f-rare-goods", itemSlug: "iron-sword", currencySlug: "runes", priceAmount: 40 },
  { shopKey: "dept-5f-rare-goods", itemSlug: "copper-dagger", currencySlug: "runes", priceAmount: 28 },
  { shopKey: "dept-5f-rare-goods", itemSlug: "reinforced-shield", currencySlug: "runes", priceAmount: 55 },
  { shopKey: "dept-5f-rare-goods", itemSlug: "minor-healing-tonic", currencySlug: "runes", priceAmount: 6 },
  { shopKey: "dept-5f-rare-goods", itemSlug: "stamina-brew", currencySlug: "runes", priceAmount: 8 },
  { shopKey: "dept-5f-rare-goods", itemSlug: "herb-leaf", currencySlug: "poke-yen", priceAmount: 120 },
  { shopKey: "dept-5f-rare-goods", itemSlug: "spring-water", currencySlug: "poke-yen", priceAmount: 80 },
  { shopKey: "dept-5f-rare-goods", itemSlug: "whetstone", currencySlug: "runes", priceAmount: 4 },
  { shopKey: "dept-5f-rare-goods", itemSlug: "iron-ingot", currencySlug: "runes", priceAmount: 9 },

  // Normal: 1F Service Counter (6)
  { shopKey: "dept-1f-service-counter", itemSlug: "minor-healing-tonic", currencySlug: "poke-yen", priceAmount: 300 },
  { shopKey: "dept-1f-service-counter", itemSlug: "stamina-brew", currencySlug: "poke-yen", priceAmount: 350 },
  { shopKey: "dept-1f-service-counter", itemSlug: "spring-water", currencySlug: "poke-yen", priceAmount: 70 },
  { shopKey: "dept-1f-service-counter", itemSlug: "herb-leaf", currencySlug: "poke-yen", priceAmount: 110 },
  { shopKey: "dept-1f-service-counter", itemSlug: "wood", currencySlug: "poke-yen", priceAmount: 95 },
  { shopKey: "dept-1f-service-counter", itemSlug: "charcoal", currencySlug: "poke-yen", priceAmount: 150 },

  // Normal: 3F Household (5)
  { shopKey: "dept-3f-household", itemSlug: "wood", currencySlug: "poke-yen", priceAmount: 100 },
  { shopKey: "dept-3f-household", itemSlug: "charcoal", currencySlug: "poke-yen", priceAmount: 155 },
  { shopKey: "dept-3f-household", itemSlug: "leather-strap", currencySlug: "poke-yen", priceAmount: 280 },
  { shopKey: "dept-3f-household", itemSlug: "spring-water", currencySlug: "poke-yen", priceAmount: 75 },
  { shopKey: "dept-3f-household", itemSlug: "whetstone", currencySlug: "poke-yen", priceAmount: 760 },

  // Normal: 4F Battle Supplies (7)
  { shopKey: "dept-4f-battle-supplies", itemSlug: "minor-healing-tonic", currencySlug: "poke-yen", priceAmount: 290 },
  { shopKey: "dept-4f-battle-supplies", itemSlug: "stamina-brew", currencySlug: "poke-yen", priceAmount: 340 },
  { shopKey: "dept-4f-battle-supplies", itemSlug: "iron-sword", currencySlug: "poke-yen", priceAmount: 5400 },
  { shopKey: "dept-4f-battle-supplies", itemSlug: "copper-dagger", currencySlug: "poke-yen", priceAmount: 3100 },
  { shopKey: "dept-4f-battle-supplies", itemSlug: "reinforced-shield", currencySlug: "poke-yen", priceAmount: 9100 },
  { shopKey: "dept-4f-battle-supplies", itemSlug: "leather-strap", currencySlug: "poke-yen", priceAmount: 270 },
  { shopKey: "dept-4f-battle-supplies", itemSlug: "whetstone", currencySlug: "poke-yen", priceAmount: 720 },

  // Tiny: Rooftop stand (2)
  { shopKey: "dept-rooftop-stand", itemSlug: "spring-water", currencySlug: "poke-yen", priceAmount: 90, notes: "Chilled." },
  { shopKey: "dept-rooftop-stand", itemSlug: "herb-leaf", currencySlug: "poke-yen", priceAmount: 130 },

  // Tiny: Station kiosk (3)
  { shopKey: "goldenrod-station-kiosk", itemSlug: "minor-healing-tonic", currencySlug: "poke-yen", priceAmount: 320 },
  { shopKey: "goldenrod-station-kiosk", itemSlug: "spring-water", currencySlug: "poke-yen", priceAmount: 85 },
  { shopKey: "goldenrod-station-kiosk", itemSlug: "stamina-brew", currencySlug: "poke-yen", priceAmount: 360 },

  // Normal: Bike shop (5)
  { shopKey: "goldenrod-bike-shop", itemSlug: "leather-strap", currencySlug: "poke-yen", priceAmount: 240 },
  { shopKey: "goldenrod-bike-shop", itemSlug: "iron-ingot", currencySlug: "poke-yen", priceAmount: 980 },
  { shopKey: "goldenrod-bike-shop", itemSlug: "copper-ingot", currencySlug: "poke-yen", priceAmount: 860 },
  { shopKey: "goldenrod-bike-shop", itemSlug: "whetstone", currencySlug: "poke-yen", priceAmount: 690 },
  { shopKey: "goldenrod-bike-shop", itemSlug: "smiths-hammer", currencySlug: "poke-yen", priceAmount: 2500 },

  // Tiny: Flower shop (3)
  { shopKey: "goldenrod-flower-shop", itemSlug: "herb-leaf", currencySlug: "poke-yen", priceAmount: 100 },
  { shopKey: "goldenrod-flower-shop", itemSlug: "spring-water", currencySlug: "poke-yen", priceAmount: 60 },
  { shopKey: "goldenrod-flower-shop", itemSlug: "wood", currencySlug: "poke-yen", priceAmount: 85 },

  // Normal: Market Street Grocer (6)
  { shopKey: "market-street-grocer", itemSlug: "herb-leaf", currencySlug: "poke-yen", priceAmount: 95 },
  { shopKey: "market-street-grocer", itemSlug: "spring-water", currencySlug: "poke-yen", priceAmount: 55 },
  { shopKey: "market-street-grocer", itemSlug: "minor-healing-tonic", currencySlug: "poke-yen", priceAmount: 280 },
  { shopKey: "market-street-grocer", itemSlug: "stamina-brew", currencySlug: "poke-yen", priceAmount: 330 },
  { shopKey: "market-street-grocer", itemSlug: "charcoal", currencySlug: "poke-yen", priceAmount: 135 },
  { shopKey: "market-street-grocer", itemSlug: "wood", currencySlug: "poke-yen", priceAmount: 80 },

  // Normal: Market Street Ore Trader (5)
  { shopKey: "market-street-ore-trader", itemSlug: "iron-ore", currencySlug: "poke-yen", priceAmount: 165 },
  { shopKey: "market-street-ore-trader", itemSlug: "copper-ore", currencySlug: "poke-yen", priceAmount: 145 },
  { shopKey: "market-street-ore-trader", itemSlug: "iron-ingot", currencySlug: "poke-yen", priceAmount: 900 },
  { shopKey: "market-street-ore-trader", itemSlug: "copper-ingot", currencySlug: "poke-yen", priceAmount: 790 },
  { shopKey: "market-street-ore-trader", itemSlug: "charcoal", currencySlug: "poke-yen", priceAmount: 130 },

  // Tiny: Underground bargain stall (3)
  { shopKey: "underground-bargain-stall", itemSlug: "iron-ore", currencySlug: "poke-yen", priceAmount: 140 },
  { shopKey: "underground-bargain-stall", itemSlug: "copper-ore", currencySlug: "poke-yen", priceAmount: 125 },
  { shopKey: "underground-bargain-stall", itemSlug: "whetstone", currencySlug: "runes", priceAmount: 3 },

  // Normal: Violet Poké Mart (6)
  { shopKey: "violet-poke-mart-shop", itemSlug: "minor-healing-tonic", currencySlug: "poke-yen", priceAmount: 300 },
  { shopKey: "violet-poke-mart-shop", itemSlug: "stamina-brew", currencySlug: "poke-yen", priceAmount: 350 },
  { shopKey: "violet-poke-mart-shop", itemSlug: "spring-water", currencySlug: "poke-yen", priceAmount: 70 },
  { shopKey: "violet-poke-mart-shop", itemSlug: "herb-leaf", currencySlug: "poke-yen", priceAmount: 115 },
  { shopKey: "violet-poke-mart-shop", itemSlug: "wood", currencySlug: "poke-yen", priceAmount: 90 },
  { shopKey: "violet-poke-mart-shop", itemSlug: "leather-strap", currencySlug: "poke-yen", priceAmount: 265 },

  // Normal: Olivine Poké Mart (5)
  { shopKey: "olivine-poke-mart-shop", itemSlug: "minor-healing-tonic", currencySlug: "poke-yen", priceAmount: 305 },
  { shopKey: "olivine-poke-mart-shop", itemSlug: "stamina-brew", currencySlug: "poke-yen", priceAmount: 355 },
  { shopKey: "olivine-poke-mart-shop", itemSlug: "spring-water", currencySlug: "poke-yen", priceAmount: 65 },
  { shopKey: "olivine-poke-mart-shop", itemSlug: "charcoal", currencySlug: "poke-yen", priceAmount: 145 },
  { shopKey: "olivine-poke-mart-shop", itemSlug: "whetstone", currencySlug: "poke-yen", priceAmount: 740 },

  // Large: Harbor Supply Shop (10)
  { shopKey: "harbor-supply-shop", itemSlug: "leather-strap", currencySlug: "poke-yen", priceAmount: 250 },
  { shopKey: "harbor-supply-shop", itemSlug: "wood", currencySlug: "poke-yen", priceAmount: 78 },
  { shopKey: "harbor-supply-shop", itemSlug: "charcoal", currencySlug: "poke-yen", priceAmount: 132 },
  { shopKey: "harbor-supply-shop", itemSlug: "iron-ore", currencySlug: "poke-yen", priceAmount: 170 },
  { shopKey: "harbor-supply-shop", itemSlug: "copper-ore", currencySlug: "poke-yen", priceAmount: 150 },
  { shopKey: "harbor-supply-shop", itemSlug: "iron-ingot", currencySlug: "poke-yen", priceAmount: 930 },
  { shopKey: "harbor-supply-shop", itemSlug: "copper-ingot", currencySlug: "poke-yen", priceAmount: 810 },
  { shopKey: "harbor-supply-shop", itemSlug: "smiths-hammer", currencySlug: "poke-yen", priceAmount: 2450 },
  { shopKey: "harbor-supply-shop", itemSlug: "whetstone", currencySlug: "poke-yen", priceAmount: 710 },
  { shopKey: "harbor-supply-shop", itemSlug: "spring-water", currencySlug: "poke-yen", priceAmount: 62 },

  // Tiny: Seaside Market Stall (3)
  { shopKey: "seaside-market-stall", itemSlug: "herb-leaf", currencySlug: "poke-yen", priceAmount: 105 },
  { shopKey: "seaside-market-stall", itemSlug: "spring-water", currencySlug: "poke-yen", priceAmount: 58 },
  { shopKey: "seaside-market-stall", itemSlug: "wood", currencySlug: "poke-yen", priceAmount: 82 },

  // Tiny: Seaside Fishmonger (2)
  { shopKey: "seaside-fishmonger", itemSlug: "spring-water", currencySlug: "poke-yen", priceAmount: 60 },
  { shopKey: "seaside-fishmonger", itemSlug: "herb-leaf", currencySlug: "runes", priceAmount: 2 },

  // Normal: Route 32 Roadside Vendor (5)
  { shopKey: "route-32-roadside-vendor", itemSlug: "minor-healing-tonic", currencySlug: "poke-yen", priceAmount: 330 },
  { shopKey: "route-32-roadside-vendor", itemSlug: "spring-water", currencySlug: "poke-yen", priceAmount: 75 },
  { shopKey: "route-32-roadside-vendor", itemSlug: "herb-leaf", currencySlug: "poke-yen", priceAmount: 125 },
  { shopKey: "route-32-roadside-vendor", itemSlug: "wood", currencySlug: "poke-yen", priceAmount: 88 },
  { shopKey: "route-32-roadside-vendor", itemSlug: "charcoal", currencySlug: "poke-yen", priceAmount: 148 },
];

// ---------------------------------------------------------------------------
// Acquisition sources
// ---------------------------------------------------------------------------
// Each source's locationId is the EXACT Location named here. Public Location
// pages deliberately never aggregate a descendant's sources into its parent,
// so these are spread across specific leaf areas — and several Locations are
// left with none on purpose, to keep the hide-empty path visible.

export const WORLD_DEV_SOURCES: WorldDevSource[] = [
  {
    itemSlug: "herb-leaf",
    type: "FORAGING",
    locationKey: "route-32-ruins-side-path",
    sourceLabel: "Roadside verges",
    quantity: "1-3",
  },
  {
    itemSlug: "wood",
    type: "FORAGING",
    locationKey: "route-32-ruins-side-path",
    sourceLabel: "Fallen branches",
  },
  {
    itemSlug: "spring-water",
    type: "FORAGING",
    locationKey: "route-32-cliffside-rest-area",
    sourceLabel: "Cliffside spring",
    notes: "Clearest after rain.",
  },
  {
    itemSlug: "spring-water",
    type: "FISHING",
    locationKey: "route-32-fishing-spot",
    sourceLabel: "Slow water near the bank",
    quantity: "1",
  },
  {
    itemSlug: "herb-leaf",
    type: "FISHING",
    locationKey: "route-32-fishing-spot",
    sourceLabel: "Snagged river weed",
  },
  {
    itemSlug: "spring-water",
    type: "FISHING",
    locationKey: "olivine-harbor-pier",
    sourceLabel: "Pier end, high tide",
    quantity: "1-2",
  },
  {
    itemSlug: "leather-strap",
    type: "CONTAINER",
    locationKey: "olivine-harbor-warehouse",
    sourceLabel: "Unclaimed crate",
  },
  {
    itemSlug: "charcoal",
    type: "CONTAINER",
    locationKey: "olivine-harbor-warehouse",
    sourceLabel: "Fuel bin",
    quantity: "2-4",
  },
  {
    itemSlug: "iron-ore",
    type: "MINING",
    locationKey: "goldenrod-underground-south",
    sourceLabel: "Exposed seam",
    quantity: "1-2",
    notes: "Between the support beams.",
  },
  {
    itemSlug: "copper-ore",
    type: "MINING",
    locationKey: "goldenrod-underground-south",
    sourceLabel: "Exposed seam",
  },
  {
    itemSlug: "whetstone",
    type: "CONTAINER",
    locationKey: "goldenrod-dept-sealed-crate-row",
    sourceLabel: "Sealed crate",
    notes: "Deepest aisle; rarely opened.",
  },
  {
    itemSlug: "iron-ingot",
    type: "CONTAINER",
    locationKey: "goldenrod-dept-sealed-crate-row",
    sourceLabel: "Sealed crate",
  },
  {
    itemSlug: "copper-ingot",
    type: "CONTAINER",
    locationKey: "goldenrod-dept-archive-vault",
    sourceLabel: "Old stock shelf",
  },
  {
    itemSlug: "herb-leaf",
    type: "FORAGING",
    locationKey: "violet-training-yard",
    sourceLabel: "Yard edge",
  },
  {
    itemSlug: "wood",
    type: "FORAGING",
    locationKey: "violet-training-yard",
    sourceLabel: "Broken practice posts",
    quantity: "1-2",
  },
  {
    itemSlug: "charcoal",
    type: "ARCHAEOLOGY",
    locationKey: "violet-sprout-3f",
    sourceLabel: "Old brazier residue",
  },
  {
    itemSlug: "spring-water",
    type: "FORAGING",
    locationKey: "olivine-lighthouse-6f",
    sourceLabel: "Condensation basin",
    notes: "A trickle at dawn.",
  },
  {
    itemSlug: "wood",
    type: "CONTAINER",
    locationKey: "goldenrod-back-alley",
    sourceLabel: "Discarded pallet",
  },
];

// ---------------------------------------------------------------------------
// Pure helpers (used by the scripts and by the dataset's unit test)
// ---------------------------------------------------------------------------

/** Every key that a parentKey may legally point at. */
export function worldDevKnownKeys(): Set<string> {
  return new Set([
    ...WORLD_DEV_ANCHORS.map((anchor) => anchor.key),
    ...WORLD_DEV_LOCATIONS.map((location) => location.key),
  ]);
}

/**
 * Depth of a location key counted in levels from its root, where a root
 * (an anchor with no parent) is level 1.
 */
export function worldDevDepth(key: string): number {
  const byKey = new Map(WORLD_DEV_LOCATIONS.map((l) => [l.key, l] as const));
  const anchorsByKey = new Map(WORLD_DEV_ANCHORS.map((a) => [a.key, a] as const));

  let depth = 1;
  let current: string | undefined = key;
  const seen = new Set<string>();
  while (current) {
    if (seen.has(current)) {
      throw new Error(`Cycle in world dev hierarchy at "${current}"`);
    }
    seen.add(current);
    const parent: string | undefined =
      byKey.get(current)?.parentKey ?? anchorsByKey.get(current)?.fallback.parentKey;
    if (!parent) break;
    depth += 1;
    current = parent;
  }
  return depth;
}

/** The deepest level any location in the dataset reaches. */
export function worldDevMaxDepth(): number {
  return WORLD_DEV_LOCATIONS.reduce(
    (max, location) => Math.max(max, worldDevDepth(location.key)),
    0,
  );
}

/** Direct children of a key, by key. */
export function worldDevChildKeys(key: string): string[] {
  return WORLD_DEV_LOCATIONS.filter((l) => l.parentKey === key).map((l) => l.key);
}

/** Ordered parents-before-children, so inserts never violate the self-relation. */
export function worldDevLocationsInInsertOrder(): WorldDevLocation[] {
  const remaining = [...WORLD_DEV_LOCATIONS];
  const placed = new Set<string>(WORLD_DEV_ANCHORS.map((a) => a.key));
  const ordered: WorldDevLocation[] = [];

  while (remaining.length > 0) {
    const index = remaining.findIndex(
      (location) => !location.parentKey || placed.has(location.parentKey),
    );
    if (index === -1) {
      throw new Error(
        `Unresolvable world dev hierarchy; unplaced: ${remaining
          .map((l) => l.key)
          .join(", ")}`,
      );
    }
    const [next] = remaining.splice(index, 1);
    placed.add(next.key);
    ordered.push(next);
  }
  return ordered;
}
