// Guarded integration tests for the AcquisitionSource model against the
// REAL isolated Supabase test database: partial records, every acquisition
// type, multiple sources per item, gameplay-verification stamping, item
// cascade deletion, location/profession SetNull, and invalid foreign key
// rejection. Every row created here uses the test-acquisition- slug prefix
// (on the Item/Location/Profession it attaches to — AcquisitionSource has
// no slug of its own) and is removed by deleteAcquisitionTestRecords.
//
// Only vitest.integration.config.ts collects this file; the unit config
// excludes **/*.integration.test.ts, so `pnpm test:unit` never loads it.

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { isForeignKeyError } from "@/lib/prisma-errors";
import {
  ACQUISITION_TYPES,
  groupObtainableItemsByType,
} from "@/lib/validation/acquisition-source";
import { sortLocationAcquisitionSourcesByType } from "@/lib/admin/location-workspace";
import {
  ACQUISITION_TEST_SLUG_PREFIX,
  GAME_VERSION_TEST_NAME_PREFIX,
  deleteAcquisitionTestRecords,
  deleteGameVersionTestRecords,
  disconnectTestPrisma,
  getVerifiedTestPrisma,
} from "./integration-database";

const P = ACQUISITION_TEST_SLUG_PREFIX;
// The verification test's own GameVersion, scoped by the shared test name
// prefix so deleteGameVersionTestRecords can remove it.
const GV = `${GAME_VERSION_TEST_NAME_PREFIX}acquisition-001`;

describe("acquisition sources (integration)", () => {
  beforeAll(async () => {
    // First database contact of the run: the guard inside
    // getVerifiedTestPrisma() throws here if the environment is not the
    // verified test project. Also removes any prefix-scoped leftovers an
    // interrupted earlier run may have stranded.
    await deleteAcquisitionTestRecords();
  });

  // Backstop cleanup after every test: even a failing write test cannot
  // leave a prefixed row behind. Rows first, then test GameVersions —
  // every verifiedGameVersionId relation is ON DELETE RESTRICT.
  afterEach(async () => {
    await deleteAcquisitionTestRecords();
    await deleteGameVersionTestRecords();
  });

  afterAll(async () => {
    const remaining =
      (await deleteAcquisitionTestRecords()) +
      (await deleteGameVersionTestRecords());
    await disconnectTestPrisma();
    // Fail loudly if cleanup was still needed at the very end — afterEach
    // should already have removed everything.
    expect(remaining).toBe(0);
  });

  describe("partial records", () => {
    it("creates a source with only the required item and type", async () => {
      const prisma = await getVerifiedTestPrisma();

      const item = await prisma.item.create({
        data: { name: "Acquisition Test Item Minimal", slug: `${P}item-minimal` },
      });

      const source = await prisma.acquisitionSource.create({
        data: { itemId: item.id, type: "FORAGING" },
      });

      expect(source.locationId).toBeNull();
      expect(source.professionId).toBeNull();
      expect(source.sourceLabel).toBeNull();
      expect(source.notes).toBeNull();
      expect(source.quantity).toBeNull();
      expect(source.verifiedAt).toBeNull();
      expect(source.verifiedGameVersionId).toBeNull();
    });

    it("accepts a source label without any named NPC record", async () => {
      const prisma = await getVerifiedTestPrisma();

      const item = await prisma.item.create({
        data: { name: "Acquisition Test Item Vendor", slug: `${P}item-vendor` },
      });

      const source = await prisma.acquisitionSource.create({
        data: {
          itemId: item.id,
          type: "NPC_OR_SHOP",
          sourceLabel: "Seed Merchant",
          quantity: "1-3",
        },
      });

      expect(source.sourceLabel).toBe("Seed Merchant");
      expect(source.quantity).toBe("1-3");
    });

    it("accepts every declared AcquisitionType", async () => {
      const prisma = await getVerifiedTestPrisma();

      const item = await prisma.item.create({
        data: { name: "Acquisition Test Item All Types", slug: `${P}item-all-types` },
      });

      for (const type of ACQUISITION_TYPES) {
        const source = await prisma.acquisitionSource.create({
          data: { itemId: item.id, type },
        });
        expect(source.type).toBe(type);
      }
    });

    it("allows multiple sources for the same item", async () => {
      const prisma = await getVerifiedTestPrisma();

      const item = await prisma.item.create({
        data: { name: "Acquisition Test Item Multi", slug: `${P}item-multi` },
      });

      await prisma.acquisitionSource.create({
        data: { itemId: item.id, type: "FORAGING" },
      });
      await prisma.acquisitionSource.create({
        data: { itemId: item.id, type: "MINING" },
      });
      await prisma.acquisitionSource.create({
        data: { itemId: item.id, type: "ENEMY_DROP" },
      });

      const reloaded = await prisma.item.findUnique({
        where: { id: item.id },
        include: { acquisitionSources: true },
      });
      expect(reloaded?.acquisitionSources).toHaveLength(3);
    });
  });

  describe("relations", () => {
    it("links an existing location and profession", async () => {
      const prisma = await getVerifiedTestPrisma();

      const item = await prisma.item.create({
        data: { name: "Acquisition Test Item Linked", slug: `${P}item-linked` },
      });
      const location = await prisma.location.create({
        data: { name: "Acquisition Test Location", slug: `${P}location`, type: "ROUTE" },
      });
      const profession = await prisma.profession.create({
        data: { name: "Acquisition Test Profession", slug: `${P}profession` },
      });

      const source = await prisma.acquisitionSource.create({
        data: {
          itemId: item.id,
          type: "CRAFTING",
          locationId: location.id,
          professionId: profession.id,
        },
      });

      expect(source.locationId).toBe(location.id);
      expect(source.professionId).toBe(profession.id);
    });

    it("rejects a nonexistent location id with a genuine foreign-key error", async () => {
      const prisma = await getVerifiedTestPrisma();

      const item = await prisma.item.create({
        data: {
          name: "Acquisition Test Item Bad Location",
          slug: `${P}item-bad-location`,
        },
      });

      let caught: unknown = null;
      try {
        await prisma.acquisitionSource.create({
          data: {
            itemId: item.id,
            type: "FISHING",
            locationId: `${P}nonexistent-location-id`,
          },
        });
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
      expect(isForeignKeyError(caught)).toBe(true);
    });

    it("rejects a nonexistent profession id with a genuine foreign-key error", async () => {
      const prisma = await getVerifiedTestPrisma();

      const item = await prisma.item.create({
        data: {
          name: "Acquisition Test Item Bad Profession",
          slug: `${P}item-bad-profession`,
        },
      });

      let caught: unknown = null;
      try {
        await prisma.acquisitionSource.create({
          data: {
            itemId: item.id,
            type: "COOKING",
            professionId: `${P}nonexistent-profession-id`,
          },
        });
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
      expect(isForeignKeyError(caught)).toBe(true);
    });

    it("cascades deletion when the item is deleted", async () => {
      const prisma = await getVerifiedTestPrisma();

      const item = await prisma.item.create({
        data: { name: "Acquisition Test Item Cascade", slug: `${P}item-cascade` },
      });
      const source = await prisma.acquisitionSource.create({
        data: { itemId: item.id, type: "REWARD" },
      });

      await prisma.item.delete({ where: { id: item.id } });

      expect(
        await prisma.acquisitionSource.findUnique({ where: { id: source.id } })
      ).toBeNull();
    });

    it("sets locationId to null (does not delete the source) when the location is deleted", async () => {
      const prisma = await getVerifiedTestPrisma();

      const item = await prisma.item.create({
        data: {
          name: "Acquisition Test Item Location SetNull",
          slug: `${P}item-location-setnull`,
        },
      });
      const location = await prisma.location.create({
        data: {
          name: "Acquisition Test Location SetNull",
          slug: `${P}location-setnull`,
          type: "TOWN",
        },
      });
      const source = await prisma.acquisitionSource.create({
        data: { itemId: item.id, type: "EXCHANGE", locationId: location.id },
      });

      await prisma.location.delete({ where: { id: location.id } });

      const reloaded = await prisma.acquisitionSource.findUnique({
        where: { id: source.id },
      });
      expect(reloaded).not.toBeNull();
      expect(reloaded?.locationId).toBeNull();
    });

    it("sets professionId to null (does not delete the source) when the profession is deleted", async () => {
      const prisma = await getVerifiedTestPrisma();

      const item = await prisma.item.create({
        data: {
          name: "Acquisition Test Item Profession SetNull",
          slug: `${P}item-profession-setnull`,
        },
      });
      const profession = await prisma.profession.create({
        data: {
          name: "Acquisition Test Profession SetNull",
          slug: `${P}profession-setnull`,
        },
      });
      const source = await prisma.acquisitionSource.create({
        data: { itemId: item.id, type: "CONSTRUCTION", professionId: profession.id },
      });

      await prisma.profession.delete({ where: { id: profession.id } });

      const reloaded = await prisma.acquisitionSource.findUnique({
        where: { id: source.id },
      });
      expect(reloaded).not.toBeNull();
      expect(reloaded?.professionId).toBeNull();
    });
  });

  describe("gameplay-verification metadata", () => {
    it("preserves verification metadata through a normal edit and advances updatedAt", async () => {
      const prisma = await getVerifiedTestPrisma();

      const item = await prisma.item.create({
        data: { name: "Acquisition Test Item Verified", slug: `${P}item-verified` },
      });
      const created = await prisma.acquisitionSource.create({
        data: { itemId: item.id, type: "EVENT" },
      });

      // The exact write shape updateAcquisitionSourceAction uses when the
      // opt-in checkbox is checked: the timestamp plus a RELATIONAL Game
      // Version reference, stamped together.
      const version = await prisma.gameVersion.create({
        data: { name: GV },
      });
      const stampedAt = new Date();
      const stamped = await prisma.acquisitionSource.update({
        where: { id: created.id },
        data: { verifiedAt: stampedAt, verifiedGameVersionId: version.id },
      });
      expect(stamped.verifiedAt?.getTime()).toBe(stampedAt.getTime());
      expect(stamped.verifiedGameVersionId).toBe(version.id);

      // The exact write shape of a NORMAL edit: verification fields are
      // omitted entirely, so Prisma must leave them untouched while the
      // automatic updatedAt still advances.
      const edited = await prisma.acquisitionSource.update({
        where: { id: created.id },
        data: { quantity: "2-4" },
      });
      expect(edited.verifiedAt?.getTime()).toBe(stampedAt.getTime());
      expect(edited.verifiedGameVersionId).toBe(version.id);
      expect(edited.updatedAt.getTime()).toBeGreaterThan(
        stamped.updatedAt.getTime()
      );
    });
  });

  describe("Location Sources tab query (Slice 9F.4)", () => {
    it("returns Acquisition Sources whose locationId references this location, with Item and Profession populated", async () => {
      const prisma = await getVerifiedTestPrisma();

      const location = await prisma.location.create({
        data: {
          name: "Acquisition Test Location Sources",
          slug: `${P}location-sources`,
          type: "TOWN",
        },
      });
      const item = await prisma.item.create({
        data: { name: "Acquisition Test Item Sources", slug: `${P}item-sources` },
      });
      const profession = await prisma.profession.create({
        data: {
          name: "Acquisition Test Profession Sources",
          slug: `${P}profession-sources`,
        },
      });
      await prisma.acquisitionSource.create({
        data: {
          itemId: item.id,
          type: "FISHING",
          locationId: location.id,
          professionId: profession.id,
          sourceLabel: "Riverbank",
          quantity: "1-2",
          notes: "Best at dawn.",
        },
      });

      // The exact query shape the Location Sources tab page uses.
      const reloaded = await prisma.location.findUnique({
        where: { id: location.id },
        include: {
          acquisitionSources: {
            include: { item: true, profession: true },
            orderBy: { item: { name: "asc" } },
          },
        },
      });

      expect(reloaded?.acquisitionSources).toHaveLength(1);
      const [source] = reloaded?.acquisitionSources ?? [];
      expect(source.item.name).toBe(item.name);
      expect(source.profession?.name).toBe(profession.name);
      expect(source.type).toBe("FISHING");
      expect(source.sourceLabel).toBe("Riverbank");
      expect(source.quantity).toBe("1-2");
      expect(source.notes).toBe("Best at dawn.");
    });

    it("orders sources by item name, and grouping by type preserves that order within each group", async () => {
      const prisma = await getVerifiedTestPrisma();

      const location = await prisma.location.create({
        data: {
          name: "Acquisition Test Location Ordering",
          slug: `${P}location-ordering`,
          type: "REGION",
        },
      });
      // Created out of alphabetical order, so a correct query result can
      // only come from an explicit orderBy, never insertion order.
      const zebraItem = await prisma.item.create({
        data: { name: "Zebra Fish", slug: `${P}item-zebra-fish` },
      });
      const alphaItem = await prisma.item.create({
        data: { name: "Alpha Fish", slug: `${P}item-alpha-fish` },
      });
      const miningItem = await prisma.item.create({
        data: { name: "Middle Ore", slug: `${P}item-middle-ore` },
      });

      await prisma.acquisitionSource.create({
        data: { itemId: zebraItem.id, type: "FISHING", locationId: location.id },
      });
      await prisma.acquisitionSource.create({
        data: { itemId: alphaItem.id, type: "FISHING", locationId: location.id },
      });
      await prisma.acquisitionSource.create({
        data: { itemId: miningItem.id, type: "MINING", locationId: location.id },
      });

      const reloaded = await prisma.location.findUnique({
        where: { id: location.id },
        include: {
          acquisitionSources: {
            include: { item: true, profession: true },
            orderBy: { item: { name: "asc" } },
          },
        },
      });

      // FISHING is declared before MINING in ACQUISITION_TYPES; supplying
      // MINING first here proves grouping does not rely on creation order.
      expect(
        ACQUISITION_TYPES.indexOf("FISHING") <
          ACQUISITION_TYPES.indexOf("MINING")
      ).toBe(true);

      const grouped = sortLocationAcquisitionSourcesByType(
        reloaded?.acquisitionSources ?? []
      );

      expect(grouped.map((source) => source.item.name)).toEqual([
        "Alpha Fish",
        "Zebra Fish",
        "Middle Ore",
      ]);
    });

    it("keeps sparse optional source values valid (no source label, profession, quantity, or notes)", async () => {
      const prisma = await getVerifiedTestPrisma();

      const location = await prisma.location.create({
        data: {
          name: "Acquisition Test Location Sparse Source",
          slug: `${P}location-sparse-source`,
          type: "DUNGEON",
        },
      });
      const item = await prisma.item.create({
        data: {
          name: "Acquisition Test Item Sparse Source",
          slug: `${P}item-sparse-source`,
        },
      });
      await prisma.acquisitionSource.create({
        data: { itemId: item.id, type: "ENEMY_DROP", locationId: location.id },
      });

      const reloaded = await prisma.location.findUnique({
        where: { id: location.id },
        include: {
          acquisitionSources: {
            include: { item: true, profession: true },
            orderBy: { item: { name: "asc" } },
          },
        },
      });

      expect(reloaded?.acquisitionSources).toHaveLength(1);
      const [source] = reloaded?.acquisitionSources ?? [];
      expect(source.profession).toBeNull();
      expect(source.sourceLabel).toBeNull();
      expect(source.quantity).toBeNull();
      expect(source.notes).toBeNull();
    });

    it("returns an empty collection for a location with no acquisition sources", async () => {
      const prisma = await getVerifiedTestPrisma();

      const location = await prisma.location.create({
        data: {
          name: "Acquisition Test Location No Sources",
          slug: `${P}location-no-sources`,
          type: "SPECIAL_AREA",
        },
      });

      const reloaded = await prisma.location.findUnique({
        where: { id: location.id },
        include: {
          acquisitionSources: {
            include: { item: true, profession: true },
            orderBy: { item: { name: "asc" } },
          },
        },
      });

      expect(reloaded?.acquisitionSources).toEqual([]);
    });

    it("never includes acquisition sources that reference a different location", async () => {
      const prisma = await getVerifiedTestPrisma();

      const locationA = await prisma.location.create({
        data: {
          name: "Acquisition Test Location A",
          slug: `${P}location-a`,
          type: "REGION",
        },
      });
      const locationB = await prisma.location.create({
        data: {
          name: "Acquisition Test Location B",
          slug: `${P}location-b`,
          type: "REGION",
        },
      });
      const itemA = await prisma.item.create({
        data: { name: "Acquisition Test Item A", slug: `${P}item-a` },
      });
      const itemB = await prisma.item.create({
        data: { name: "Acquisition Test Item B", slug: `${P}item-b` },
      });
      await prisma.acquisitionSource.create({
        data: { itemId: itemA.id, type: "FARMING", locationId: locationA.id },
      });
      await prisma.acquisitionSource.create({
        data: { itemId: itemB.id, type: "FARMING", locationId: locationB.id },
      });

      const reloadedA = await prisma.location.findUnique({
        where: { id: locationA.id },
        include: {
          acquisitionSources: {
            include: { item: true, profession: true },
            orderBy: { item: { name: "asc" } },
          },
        },
      });

      expect(reloadedA?.acquisitionSources).toHaveLength(1);
      expect(reloadedA?.acquisitionSources[0].item.name).toBe(itemA.name);
    });
  });

  describe("public Location Obtainable Items query (Slice 10A)", () => {
    // The exact restrained `select` shape the public Location detail page
    // uses — never a database id, never verification/Game Version fields.
    async function loadObtainableSources(locationId: string) {
      const prisma = await getVerifiedTestPrisma();
      const reloaded = await prisma.location.findUnique({
        where: { id: locationId },
        include: {
          acquisitionSources: {
            select: {
              type: true,
              sourceLabel: true,
              quantity: true,
              notes: true,
              profession: { select: { name: true } },
              item: { select: { slug: true, name: true, image: true } },
            },
            orderBy: { item: { name: "asc" } },
          },
        },
      });
      return reloaded?.acquisitionSources ?? [];
    }

    it("returns only Acquisition Sources whose locationId references this location", async () => {
      const prisma = await getVerifiedTestPrisma();

      const location = await prisma.location.create({
        data: {
          name: "Acquisition Test Location Public Own",
          slug: `${P}location-public-own`,
          type: "TOWN",
        },
      });
      const item = await prisma.item.create({
        data: { name: "Acquisition Test Item Public Own", slug: `${P}item-public-own` },
      });
      await prisma.acquisitionSource.create({
        data: { itemId: item.id, type: "FISHING", locationId: location.id },
      });

      const sources = await loadObtainableSources(location.id);
      expect(sources).toHaveLength(1);
      expect(sources[0].item.name).toBe(item.name);
    });

    it("excludes Acquisition Sources that reference a different location", async () => {
      const prisma = await getVerifiedTestPrisma();

      const locationA = await prisma.location.create({
        data: {
          name: "Acquisition Test Location Public A",
          slug: `${P}location-public-a`,
          type: "REGION",
        },
      });
      const locationB = await prisma.location.create({
        data: {
          name: "Acquisition Test Location Public B",
          slug: `${P}location-public-b`,
          type: "REGION",
        },
      });
      const itemB = await prisma.item.create({
        data: { name: "Acquisition Test Item Public B", slug: `${P}item-public-b` },
      });
      await prisma.acquisitionSource.create({
        data: { itemId: itemB.id, type: "FARMING", locationId: locationB.id },
      });

      const sources = await loadObtainableSources(locationA.id);
      expect(sources).toEqual([]);
    });

    it("excludes Acquisition Sources with no location at all", async () => {
      const prisma = await getVerifiedTestPrisma();

      const location = await prisma.location.create({
        data: {
          name: "Acquisition Test Location Public No Location Source",
          slug: `${P}location-public-no-loc-source`,
          type: "DUNGEON",
        },
      });
      const item = await prisma.item.create({
        data: {
          name: "Acquisition Test Item Public Unlocated",
          slug: `${P}item-public-unlocated`,
        },
      });
      // Deliberately no locationId at all.
      await prisma.acquisitionSource.create({
        data: { itemId: item.id, type: "REWARD" },
      });

      const sources = await loadObtainableSources(location.id);
      expect(sources).toEqual([]);
    });

    it("returns related Item data and handles an absent Profession", async () => {
      const prisma = await getVerifiedTestPrisma();

      const location = await prisma.location.create({
        data: {
          name: "Acquisition Test Location Public Item Data",
          slug: `${P}location-public-item-data`,
          type: "ROUTE",
        },
      });
      const item = await prisma.item.create({
        data: {
          name: "Acquisition Test Item Public Item Data",
          slug: `${P}item-public-item-data`,
        },
      });
      await prisma.acquisitionSource.create({
        data: { itemId: item.id, type: "FORAGING", locationId: location.id },
      });

      const sources = await loadObtainableSources(location.id);
      expect(sources).toHaveLength(1);
      expect(sources[0].item).toEqual({
        slug: item.slug,
        name: item.name,
        image: null,
      });
      expect(sources[0].profession).toBeNull();
    });

    it("returns the linked Profession's name when one is set", async () => {
      const prisma = await getVerifiedTestPrisma();

      const location = await prisma.location.create({
        data: {
          name: "Acquisition Test Location Public Profession",
          slug: `${P}location-public-profession`,
          type: "TOWN",
        },
      });
      const item = await prisma.item.create({
        data: {
          name: "Acquisition Test Item Public Profession",
          slug: `${P}item-public-profession`,
        },
      });
      const profession = await prisma.profession.create({
        data: {
          name: "Acquisition Test Profession Public",
          slug: `${P}profession-public`,
        },
      });
      await prisma.acquisitionSource.create({
        data: {
          itemId: item.id,
          type: "COOKING",
          locationId: location.id,
          professionId: profession.id,
        },
      });

      const sources = await loadObtainableSources(location.id);
      expect(sources[0].profession?.name).toBe(profession.name);
    });

    it("keeps repeated source rows for the same item as distinct rows, so unique-item grouping has correct input", async () => {
      const prisma = await getVerifiedTestPrisma();

      const location = await prisma.location.create({
        data: {
          name: "Acquisition Test Location Public Repeated",
          slug: `${P}location-public-repeated`,
          type: "DUNGEON",
        },
      });
      const item = await prisma.item.create({
        data: {
          name: "Acquisition Test Item Public Repeated",
          slug: `${P}item-public-repeated`,
        },
      });
      await prisma.acquisitionSource.create({
        data: {
          itemId: item.id,
          type: "MINING",
          locationId: location.id,
          notes: "Common.",
        },
      });
      await prisma.acquisitionSource.create({
        data: {
          itemId: item.id,
          type: "MINING",
          locationId: location.id,
          notes: "Rare vein.",
        },
      });

      const sources = await loadObtainableSources(location.id);
      // The raw query correctly returns both rows...
      expect(sources).toHaveLength(2);

      // ...and the pure grouping function collapses them into one item.
      const groups = groupObtainableItemsByType(sources);
      expect(groups).toHaveLength(1);
      expect(groups[0].items).toHaveLength(1);
      expect(groups[0].items[0].description).toContain("Notes: Common.");
      expect(groups[0].items[0].description).toContain("Notes: Rare vein.");
    });

    it("orders multiple Acquisition Types canonically once grouped", async () => {
      const prisma = await getVerifiedTestPrisma();

      const location = await prisma.location.create({
        data: {
          name: "Acquisition Test Location Public Multi Type",
          slug: `${P}location-public-multi-type`,
          type: "SPECIAL_AREA",
        },
      });
      const miningItem = await prisma.item.create({
        data: {
          name: "Acquisition Test Item Public Mining",
          slug: `${P}item-public-mining`,
        },
      });
      const foragingItem = await prisma.item.create({
        data: {
          name: "Acquisition Test Item Public Foraging",
          slug: `${P}item-public-foraging`,
        },
      });
      // Created out of enum order — MINING first — so a correct grouped
      // result can only come from the canonical ACQUISITION_TYPES order.
      await prisma.acquisitionSource.create({
        data: { itemId: miningItem.id, type: "MINING", locationId: location.id },
      });
      await prisma.acquisitionSource.create({
        data: { itemId: foragingItem.id, type: "FORAGING", locationId: location.id },
      });

      const sources = await loadObtainableSources(location.id);
      const groups = groupObtainableItemsByType(sources);

      expect(groups.map((group) => group.type)).toEqual(["FORAGING", "MINING"]);
      expect(
        ACQUISITION_TYPES.indexOf("FORAGING") < ACQUISITION_TYPES.indexOf("MINING")
      ).toBe(true);
    });

    it("keeps a sparse location (zero Acquisition Sources) valid, with no groups", async () => {
      const prisma = await getVerifiedTestPrisma();

      const location = await prisma.location.create({
        data: {
          name: "Acquisition Test Location Public Sparse",
          slug: `${P}location-public-sparse`,
          type: "SUB_AREA",
        },
      });

      const sources = await loadObtainableSources(location.id);
      expect(sources).toEqual([]);
      expect(groupObtainableItemsByType(sources)).toEqual([]);
    });
  });
});
