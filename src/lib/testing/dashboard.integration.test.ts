// Guarded integration tests for the /admin dashboard's own count queries
// (Slice 9G.1) against the REAL isolated Supabase test database: proving
// the exact restrained query shapes the dashboard page uses — count()
// queries, never full collection loads — return correct deltas when rows
// are created, that the root-location count query only counts locations
// with no parent, that a zero-match count is a valid zero (not an error),
// and that the current-Game-Version query is the same getCurrentGameVersion
// semantics every verification stamp already relies on.
//
// Every row created here reuses the existing, already-guarded
// test-acquisition- prefix (Item/Location/AcquisitionSource together), so
// cleanup (deleteAcquisitionTestRecords) is already exhaustive — no new
// cleanup surface is introduced for this slice.
//
// Only vitest.integration.config.ts collects this file; the unit config
// excludes **/*.integration.test.ts, so `pnpm test:unit` never loads it.

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { getCurrentGameVersion } from "@/lib/game-versions";
import {
  ACQUISITION_TEST_SLUG_PREFIX,
  deleteAcquisitionTestRecords,
  disconnectTestPrisma,
  getVerifiedTestPrisma,
} from "./integration-database";

const P = ACQUISITION_TEST_SLUG_PREFIX;

describe("admin dashboard counts (integration)", () => {
  beforeAll(async () => {
    await deleteAcquisitionTestRecords();
  });

  afterEach(async () => {
    await deleteAcquisitionTestRecords();
  });

  afterAll(async () => {
    const remaining = await deleteAcquisitionTestRecords();
    await disconnectTestPrisma();
    expect(remaining).toBe(0);
  });

  it("item and acquisition source counts reflect real inserted records", async () => {
    const prisma = await getVerifiedTestPrisma();

    const beforeItems = await prisma.item.count();
    const beforeSources = await prisma.acquisitionSource.count();

    const item = await prisma.item.create({
      data: { name: "Dashboard Test Item", slug: `${P}item-dashboard` },
    });
    await prisma.acquisitionSource.create({
      data: { itemId: item.id, type: "FORAGING" },
    });

    expect(await prisma.item.count()).toBe(beforeItems + 1);
    expect(await prisma.acquisitionSource.count()).toBe(beforeSources + 1);
  });

  it("the root-location count query counts only locations with no parent", async () => {
    const prisma = await getVerifiedTestPrisma();

    const beforeTotal = await prisma.location.count();
    const beforeRoot = await prisma.location.count({
      where: { parentId: null },
    });

    const root = await prisma.location.create({
      data: {
        name: "Dashboard Test Root Location",
        slug: `${P}location-root`,
        type: "REGION",
      },
    });
    await prisma.location.create({
      data: {
        name: "Dashboard Test Child Location",
        slug: `${P}location-child`,
        type: "TOWN",
        parentId: root.id,
      },
    });

    // Two new locations total, but only the root has no parent.
    expect(await prisma.location.count()).toBe(beforeTotal + 2);
    expect(await prisma.location.count({ where: { parentId: null } })).toBe(
      beforeRoot + 1
    );
  });

  it("a resource with zero matching rows returns a valid zero count, not an error", async () => {
    const prisma = await getVerifiedTestPrisma();

    const count = await prisma.item.count({
      where: { slug: `${P}definitely-does-not-exist` },
    });

    expect(count).toBe(0);
  });

  it("the current Game Version query uses the same semantics every verification stamp relies on", async () => {
    const prisma = await getVerifiedTestPrisma();

    // Whatever the isolated test project's current state is (the guarded
    // E2E fixture keeps one version current across the whole suite),
    // getCurrentGameVersion must return either null or a row whose own
    // isCurrent flag is true in the database — never a stale or
    // fabricated result.
    const current = await getCurrentGameVersion(prisma);

    if (current) {
      const reloaded = await prisma.gameVersion.findUnique({
        where: { id: current.id },
      });
      expect(reloaded?.isCurrent).toBe(true);
    } else {
      expect(
        await prisma.gameVersion.count({ where: { isCurrent: true } })
      ).toBe(0);
    }
  });
});
