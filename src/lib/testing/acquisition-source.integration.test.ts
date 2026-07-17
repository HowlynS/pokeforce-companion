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
import { ACQUISITION_TYPES } from "@/lib/validation/acquisition-source";
import {
  ACQUISITION_TEST_SLUG_PREFIX,
  deleteAcquisitionTestRecords,
  disconnectTestPrisma,
  getVerifiedTestPrisma,
} from "./integration-database";

const P = ACQUISITION_TEST_SLUG_PREFIX;

describe("acquisition sources (integration)", () => {
  beforeAll(async () => {
    // First database contact of the run: the guard inside
    // getVerifiedTestPrisma() throws here if the environment is not the
    // verified test project. Also removes any prefix-scoped leftovers an
    // interrupted earlier run may have stranded.
    await deleteAcquisitionTestRecords();
  });

  // Backstop cleanup after every test: even a failing write test cannot
  // leave a prefixed row behind.
  afterEach(async () => {
    await deleteAcquisitionTestRecords();
  });

  afterAll(async () => {
    const remaining = await deleteAcquisitionTestRecords();
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
      expect(source.verifiedBuildId).toBeNull();
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
      // opt-in checkbox is checked: both fields stamped together.
      const stampedAt = new Date();
      const stamped = await prisma.acquisitionSource.update({
        where: { id: created.id },
        data: { verifiedAt: stampedAt, verifiedBuildId: "test-build-001" },
      });
      expect(stamped.verifiedAt?.getTime()).toBe(stampedAt.getTime());
      expect(stamped.verifiedBuildId).toBe("test-build-001");

      // The exact write shape of a NORMAL edit: verification fields are
      // omitted entirely, so Prisma must leave them untouched while the
      // automatic updatedAt still advances.
      const edited = await prisma.acquisitionSource.update({
        where: { id: created.id },
        data: { quantity: "2-4" },
      });
      expect(edited.verifiedAt?.getTime()).toBe(stampedAt.getTime());
      expect(edited.verifiedBuildId).toBe("test-build-001");
      expect(edited.updatedAt.getTime()).toBeGreaterThan(
        stamped.updatedAt.getTime()
      );
    });
  });
});
