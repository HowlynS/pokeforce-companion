// Guarded integration tests for the Location model against the REAL
// isolated Supabase test database: partial records, the self-referencing
// parent/child hierarchy, the bounded cycle guard, deletion blocking, and
// gameplay-verification stamping. Every row created here uses the
// locations-test slug prefix and is removed by prefix-scoped,
// leaf-first-safe cleanup (see deleteLocationsTestRecords). No seeded
// Location fixtures exist, so this suite never reads pre-existing rows.
//
// Only vitest.integration.config.ts collects this file; the unit config
// excludes **/*.integration.test.ts, so `pnpm test:unit` never loads it.

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { isForeignKeyError } from "@/lib/prisma-errors";
import { LOCATION_TYPES } from "@/lib/validation/location";
import { wouldCreateLocationCycle } from "@/lib/locations/location-hierarchy";
import {
  GAME_VERSION_TEST_NAME_PREFIX,
  LOCATIONS_TEST_SLUG_PREFIX,
  deleteGameVersionTestRecords,
  deleteLocationsTestRecords,
  disconnectTestPrisma,
  getVerifiedTestPrisma,
} from "./integration-database";

const P = LOCATIONS_TEST_SLUG_PREFIX;
// The verification test's own GameVersion, scoped by the shared test name
// prefix so deleteGameVersionTestRecords can remove it.
const GV = `${GAME_VERSION_TEST_NAME_PREFIX}location-001`;

describe("location hierarchy and verification (integration)", () => {
  beforeAll(async () => {
    // First database contact of the run: the guard inside
    // getVerifiedTestPrisma() throws here if the environment is not the
    // verified test project. Also removes any prefix-scoped leftovers an
    // interrupted earlier run may have stranded.
    await deleteLocationsTestRecords();
  });

  // Backstop cleanup after every test: even a failing write test cannot
  // leave a prefixed row behind. Only prefix-scoped rows are deleted, in a
  // leaf-first order safe for the self-referencing hierarchy; rows go
  // before test GameVersions because every verifiedGameVersionId relation
  // is ON DELETE RESTRICT.
  afterEach(async () => {
    await deleteLocationsTestRecords();
    await deleteGameVersionTestRecords();
  });

  afterAll(async () => {
    const remaining =
      (await deleteLocationsTestRecords()) +
      (await deleteGameVersionTestRecords());
    await disconnectTestPrisma();
    // Fail loudly if cleanup was still needed at the very end — afterEach
    // should already have removed everything.
    expect(remaining).toBe(0);
  });

  describe("partial records", () => {
    it("creates a location with only the required fields", async () => {
      const prisma = await getVerifiedTestPrisma();

      const location = await prisma.location.create({
        data: {
          name: "Test Integration Location Minimal",
          slug: `${P}minimal`,
          type: "REGION",
        },
      });

      expect(location.parentId).toBeNull();
      expect(location.description).toBeNull();
      expect(location.image).toBeNull();
      expect(location.accessNote).toBeNull();
      expect(location.verifiedAt).toBeNull();
      expect(location.verifiedGameVersionId).toBeNull();
    });

    it("accepts every declared LocationType", async () => {
      const prisma = await getVerifiedTestPrisma();

      for (const type of LOCATION_TYPES) {
        const location = await prisma.location.create({
          data: {
            name: `Test Integration Location ${type}`,
            slug: `${P}type-${type.toLowerCase().replace(/_/g, "-")}`,
            type,
          },
        });
        expect(location.type).toBe(type);
      }
    });

    it("rejects a second location with the same slug", async () => {
      const prisma = await getVerifiedTestPrisma();

      await prisma.location.create({
        data: {
          name: "Test Integration Location Unique",
          slug: `${P}unique-slug`,
          type: "TOWN",
        },
      });

      let caught: unknown = null;
      try {
        await prisma.location.create({
          data: {
            name: "Test Integration Location Unique Again",
            slug: `${P}unique-slug`,
            type: "TOWN",
          },
        });
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
      expect((caught as Prisma.PrismaClientKnownRequestError).code).toBe(
        "P2002"
      );
    });
  });

  describe("parent/child hierarchy", () => {
    it("links a child to its parent and lists it in the parent's children", async () => {
      const prisma = await getVerifiedTestPrisma();

      const parent = await prisma.location.create({
        data: {
          name: "Test Integration Location Parent",
          slug: `${P}parent`,
          type: "REGION",
        },
      });
      const child = await prisma.location.create({
        data: {
          name: "Test Integration Location Child",
          slug: `${P}child`,
          type: "TOWN",
          parentId: parent.id,
        },
      });

      const reloadedParent = await prisma.location.findUnique({
        where: { id: parent.id },
        include: { children: true },
      });

      expect(child.parentId).toBe(parent.id);
      expect(reloadedParent?.children.map((c) => c.id)).toEqual([child.id]);
    });

    it("rejects a location assigned as its own parent (self_parent)", async () => {
      const prisma = await getVerifiedTestPrisma();

      const location = await prisma.location.create({
        data: {
          name: "Test Integration Location Self",
          slug: `${P}self`,
          type: "TOWN",
        },
      });

      expect(
        await wouldCreateLocationCycle(prisma, location.id, location.id)
      ).toBe(true);
    });

    it("rejects assigning a descendant as the parent (descendant_cycle)", async () => {
      const prisma = await getVerifiedTestPrisma();

      // A -> B -> C chain.
      const a = await prisma.location.create({
        data: { name: "Test Integration Location A", slug: `${P}a`, type: "REGION" },
      });
      const b = await prisma.location.create({
        data: {
          name: "Test Integration Location B",
          slug: `${P}b`,
          type: "TOWN",
          parentId: a.id,
        },
      });
      const c = await prisma.location.create({
        data: {
          name: "Test Integration Location C",
          slug: `${P}c`,
          type: "BUILDING",
          parentId: b.id,
        },
      });

      // Assigning C (a descendant of A) as A's new parent would create a
      // cycle: A -> B -> C -> A.
      expect(await wouldCreateLocationCycle(prisma, a.id, c.id)).toBe(true);
      // B is also a descendant of A, so the same holds one level up.
      expect(await wouldCreateLocationCycle(prisma, a.id, b.id)).toBe(true);
      // Unrelated reassignment stays safe: C can become a child of a fresh
      // unrelated location.
      const unrelated = await prisma.location.create({
        data: {
          name: "Test Integration Location Unrelated",
          slug: `${P}unrelated`,
          type: "REGION",
        },
      });
      expect(
        await wouldCreateLocationCycle(prisma, c.id, unrelated.id)
      ).toBe(false);
    });

    it("blocks deletion while a child references the location, then succeeds once removed", async () => {
      const prisma = await getVerifiedTestPrisma();

      const parent = await prisma.location.create({
        data: {
          name: "Test Integration Location Delete Parent",
          slug: `${P}delete-parent`,
          type: "REGION",
        },
      });
      const child = await prisma.location.create({
        data: {
          name: "Test Integration Location Delete Child",
          slug: `${P}delete-child`,
          type: "TOWN",
          parentId: parent.id,
        },
      });

      // The exact relation query deleteLocationAction runs immediately
      // before deleting.
      const blocked = await prisma.location.findUnique({
        where: { id: parent.id },
        include: { _count: { select: { children: true } } },
      });
      expect(blocked?._count.children).toBe(1);

      // The database itself also refuses the delete (onDelete: Restrict) —
      // a genuine P2003, not just the application's friendly pre-check.
      let caught: unknown = null;
      try {
        await prisma.location.delete({ where: { id: parent.id } });
      } catch (error) {
        caught = error;
      }
      expect(isForeignKeyError(caught)).toBe(true);

      // The safe workflow: remove the child first.
      await prisma.location.delete({ where: { id: child.id } });

      const unblocked = await prisma.location.findUnique({
        where: { id: parent.id },
        include: { _count: { select: { children: true } } },
      });
      expect(unblocked?._count.children).toBe(0);

      await prisma.location.delete({ where: { id: parent.id } });
      expect(
        await prisma.location.findUnique({ where: { id: parent.id } })
      ).toBeNull();
    });
  });

  describe("gameplay-verification metadata", () => {
    it("preserves verification metadata through a normal edit and advances updatedAt", async () => {
      const prisma = await getVerifiedTestPrisma();

      const created = await prisma.location.create({
        data: {
          name: "Test Integration Location Verified",
          slug: `${P}verified`,
          type: "DUNGEON",
        },
      });

      // The exact write shape updateLocationAction uses when the opt-in
      // checkbox is checked: the timestamp plus a RELATIONAL Game Version
      // reference, stamped together.
      const version = await prisma.gameVersion.create({
        data: { name: GV },
      });
      const stampedAt = new Date();
      const stamped = await prisma.location.update({
        where: { id: created.id },
        data: { verifiedAt: stampedAt, verifiedGameVersionId: version.id },
      });
      expect(stamped.verifiedAt?.getTime()).toBe(stampedAt.getTime());
      expect(stamped.verifiedGameVersionId).toBe(version.id);

      // The exact write shape of a NORMAL edit: verification fields are
      // omitted entirely, so Prisma must leave them untouched while the
      // automatic updatedAt still advances.
      const edited = await prisma.location.update({
        where: { id: created.id },
        data: { name: "Test Integration Location Verified Renamed" },
      });
      expect(edited.verifiedAt?.getTime()).toBe(stampedAt.getTime());
      expect(edited.verifiedGameVersionId).toBe(version.id);
      expect(edited.updatedAt.getTime()).toBeGreaterThan(
        stamped.updatedAt.getTime()
      );
    });
  });
});
