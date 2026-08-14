// Integrity checks for the temporary World development dataset. These run in
// the ordinary unit suite and touch no database — they guard the properties
// the population script relies on (resolvable parents, unique slugs, valid
// insert ordering) and the shape the task set out to stress (depth, breadth).

import { describe, expect, it } from "vitest";
import {
  WORLD_DEV_ANCHORS,
  WORLD_DEV_LISTINGS,
  WORLD_DEV_LOCATIONS,
  WORLD_DEV_SHOPS,
  WORLD_DEV_SLUG_PREFIX,
  WORLD_DEV_SOURCES,
  worldDevChildKeys,
  worldDevKnownKeys,
  worldDevLocationsInInsertOrder,
  worldDevMaxDepth,
  worldDevSlug,
} from "./world-dev-data";

describe("world dev dataset", () => {
  it("gives every location a unique key and a prefixed slug", () => {
    const keys = WORLD_DEV_LOCATIONS.map((location) => location.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) {
      expect(worldDevSlug(key).startsWith(WORLD_DEV_SLUG_PREFIX)).toBe(true);
    }
  });

  it("gives every shop a unique key and resolves its location", () => {
    const keys = WORLD_DEV_SHOPS.map((shop) => shop.key);
    expect(new Set(keys).size).toBe(keys.length);

    const locationKeys = new Set(WORLD_DEV_LOCATIONS.map((l) => l.key));
    for (const shop of WORLD_DEV_SHOPS) {
      expect(
        locationKeys.has(shop.locationKey),
        `shop "${shop.key}" references unknown location "${shop.locationKey}"`,
      ).toBe(true);
    }
  });

  it("points every parentKey at a known anchor or location", () => {
    const known = worldDevKnownKeys();
    for (const location of WORLD_DEV_LOCATIONS) {
      if (!location.parentKey) continue;
      expect(
        known.has(location.parentKey),
        `location "${location.key}" references unknown parent "${location.parentKey}"`,
      ).toBe(true);
    }
  });

  it("orders locations parents-before-children for insertion", () => {
    const ordered = worldDevLocationsInInsertOrder();
    expect(ordered).toHaveLength(WORLD_DEV_LOCATIONS.length);

    const placed = new Set(WORLD_DEV_ANCHORS.map((anchor) => anchor.key));
    for (const location of ordered) {
      if (location.parentKey) {
        expect(
          placed.has(location.parentKey),
          `"${location.key}" was ordered before its parent "${location.parentKey}"`,
        ).toBe(true);
      }
      placed.add(location.key);
    }
  });

  it("reaches a hierarchy deep enough to stress indentation", () => {
    // The task asked for at least one 6-7 level branch; this dataset runs
    // deeper on purpose so nesting, ancestor lines, and scroll containment
    // are genuinely exercised rather than just satisfied.
    expect(worldDevMaxDepth()).toBeGreaterThanOrEqual(7);
  });

  it("makes Goldenrod the broadest branch with at least 10 direct children", () => {
    const goldenrod = worldDevChildKeys("goldenrod-city");
    expect(goldenrod.length).toBeGreaterThanOrEqual(10);

    for (const other of ["violet-city", "olivine-city", "route-32"]) {
      expect(goldenrod.length).toBeGreaterThan(worldDevChildKeys(other).length);
    }
  });

  it("keeps listings unique per shop/item/currency, matching the schema key", () => {
    const seen = new Set<string>();
    for (const listing of WORLD_DEV_LISTINGS) {
      const key = `${listing.shopKey}|${listing.itemSlug}|${listing.currencySlug}`;
      expect(seen.has(key), `duplicate listing ${key}`).toBe(false);
      seen.add(key);
      expect(listing.priceAmount).toBeGreaterThan(0);
      expect(Number.isInteger(listing.priceAmount)).toBe(true);
    }
  });

  it("spreads shops across single-shop and multi-shop locations", () => {
    const perLocation = new Map<string, number>();
    for (const shop of WORLD_DEV_SHOPS) {
      perLocation.set(
        shop.locationKey,
        (perLocation.get(shop.locationKey) ?? 0) + 1,
      );
    }
    const counts = [...perLocation.values()];
    expect(counts.some((count) => count === 1)).toBe(true);
    expect(counts.some((count) => count > 1)).toBe(true);
  });

  it("varies inventory size across tiny, normal, and large shops", () => {
    const perShop = new Map<string, number>();
    for (const listing of WORLD_DEV_LISTINGS) {
      perShop.set(listing.shopKey, (perShop.get(listing.shopKey) ?? 0) + 1);
    }
    const counts = [...perShop.values()];
    expect(Math.min(...counts)).toBeLessThanOrEqual(3);
    expect(Math.max(...counts)).toBeGreaterThanOrEqual(10);
  });

  it("attaches obtainable items to enough locations, but not to all of them", () => {
    const withSources = new Set(WORLD_DEV_SOURCES.map((s) => s.locationKey));
    expect(withSources.size).toBeGreaterThanOrEqual(8);
    // Hide-empty behavior stays observable only while some locations have none.
    expect(withSources.size).toBeLessThan(WORLD_DEV_LOCATIONS.length);

    const locationKeys = new Set(WORLD_DEV_LOCATIONS.map((l) => l.key));
    for (const source of WORLD_DEV_SOURCES) {
      expect(
        locationKeys.has(source.locationKey),
        `source references unknown location "${source.locationKey}"`,
      ).toBe(true);
    }
  });

  it("leaves optional fields empty on some locations", () => {
    expect(WORLD_DEV_LOCATIONS.some((l) => !l.description)).toBe(true);
    expect(WORLD_DEV_LOCATIONS.some((l) => !l.accessNote)).toBe(true);
  });
});
