// Guarded integration tests for the shared Item duplicate-name helper
// against the REAL isolated Supabase test database. Entirely READ-ONLY:
// every check runs against the deterministic seed from prisma/seed.ts —
// nothing is created, updated, or deleted, so no cleanup hooks are needed.
// The Prisma client is obtained through getVerifiedTestPrisma(), so the
// fail-closed environment guard runs before any connection exists; the
// helper module itself never creates a client (its Prisma reference is
// type-level only).
//
// Only vitest.integration.config.ts collects this file; the unit config
// excludes **/*.integration.test.ts, so `pnpm test:unit` never loads it.

import { afterAll, describe, expect, it } from "vitest";
import { isItemNameTaken } from "@/lib/items/item-name";
import {
  disconnectTestPrisma,
  getVerifiedTestPrisma,
} from "./integration-database";

// Stable seeded handles; cuid IDs are looked up per run, never hard-coded.
const SEEDED_ITEM_SLUG = "iron-ore";
const SEEDED_ITEM_NAME = "Iron Ore";
const OTHER_SEEDED_ITEM_NAME = "Copper Ore";

async function seededItemId(slug: string): Promise<string> {
  const prisma = await getVerifiedTestPrisma();
  const item = await prisma.item.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!item) {
    throw new Error("Expected seeded Item is missing.");
  }
  return item.id;
}

describe("item name availability (integration, read-only)", () => {
  afterAll(async () => {
    await disconnectTestPrisma();
  });

  it("reports an exact seeded name as taken", async () => {
    const prisma = await getVerifiedTestPrisma();
    expect(await isItemNameTaken(prisma, SEEDED_ITEM_NAME)).toBe(true);
  });

  it("reports a casing variant as taken", async () => {
    const prisma = await getVerifiedTestPrisma();
    expect(await isItemNameTaken(prisma, "IRON ORE")).toBe(true);
    expect(await isItemNameTaken(prisma, "iron ore")).toBe(true);
  });

  it("reports a surrounding-whitespace variant as taken", async () => {
    const prisma = await getVerifiedTestPrisma();
    expect(await isItemNameTaken(prisma, "  iron ore  ")).toBe(true);
  });

  it("reports an unused name as available", async () => {
    const prisma = await getVerifiedTestPrisma();
    expect(
      await isItemNameTaken(prisma, "Test Integration Unused Item Name")
    ).toBe(false);
  });

  it("never reports a blank name as taken", async () => {
    const prisma = await getVerifiedTestPrisma();
    expect(await isItemNameTaken(prisma, "")).toBe(false);
    expect(await isItemNameTaken(prisma, "   ")).toBe(false);
  });

  it("excludes the current Item during editing so it cannot conflict with itself", async () => {
    const prisma = await getVerifiedTestPrisma();
    const id = await seededItemId(SEEDED_ITEM_SLUG);

    expect(await isItemNameTaken(prisma, SEEDED_ITEM_NAME, id)).toBe(false);
    // Casing/whitespace variants of the own name are excluded the same way.
    expect(await isItemNameTaken(prisma, "  IRON ORE ", id)).toBe(false);
  });

  it("still reports a DIFFERENT item's name as taken during editing", async () => {
    const prisma = await getVerifiedTestPrisma();
    const id = await seededItemId(SEEDED_ITEM_SLUG);

    expect(await isItemNameTaken(prisma, OTHER_SEEDED_ITEM_NAME, id)).toBe(
      true
    );
  });
});
