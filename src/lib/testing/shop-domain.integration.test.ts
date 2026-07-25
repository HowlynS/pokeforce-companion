import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { countVerificationReferences } from "@/lib/game-versions";
import {
  deleteShopTestRecords,
  disconnectTestPrisma,
  getVerifiedTestPrisma,
  SHOP_TEST_SLUG_PREFIX,
  SHOP_TEST_VERSION_NAME_PREFIX,
} from "@/lib/testing/integration-database";

const P = SHOP_TEST_SLUG_PREFIX;

async function createFixture() {
  const prisma = await getVerifiedTestPrisma();
  const version = await prisma.gameVersion.create({
    data: { name: `${SHOP_TEST_VERSION_NAME_PREFIX}${crypto.randomUUID()}` },
  });
  const location = await prisma.location.create({
    data: {
      name: "Shop Test Location",
      slug: `${P}location`,
      type: "TOWN",
    },
  });
  const item = await prisma.item.create({
    data: { name: "Shop Test Item", slug: `${P}item` },
  });
  const primaryCurrency = await prisma.currency.create({
    data: {
      name: "Shop Test Pokéyen",
      slug: `${P}pokeyen`,
      symbol: "₽",
      description: "Primary test currency.",
      verifiedAt: new Date("2026-07-25T00:00:00.000Z"),
      verifiedGameVersionId: version.id,
    },
  });
  const alternateCurrency = await prisma.currency.create({
    data: { name: "Shop Test Runes", slug: `${P}runes` },
  });
  const shop = await prisma.shop.create({
    data: {
      name: "Shop Test Supply",
      slug: `${P}supply`,
      locationId: location.id,
      verifiedAt: new Date("2026-07-25T00:00:00.000Z"),
      verifiedGameVersionId: version.id,
    },
  });

  return {
    prisma,
    version,
    location,
    item,
    primaryCurrency,
    alternateCurrency,
    shop,
  };
}

describe("Shop, Currency, and ShopListing domain (integration)", () => {
  beforeEach(async () => {
    await deleteShopTestRecords();
  });

  afterAll(async () => {
    await deleteShopTestRecords();
    await disconnectTestPrisma();
  });

  it("creates required and optional Currency / Shop fields", async () => {
    const { prisma, primaryCurrency, alternateCurrency, shop, location } =
      await createFixture();

    expect(primaryCurrency).toMatchObject({
      symbol: "₽",
      description: "Primary test currency.",
    });
    expect(alternateCurrency).toMatchObject({
      symbol: null,
      description: null,
      image: null,
    });
    expect(shop.locationId).toBe(location.id);

    const loadedShop = await prisma.shop.findUnique({
      where: { id: shop.id },
      include: { location: true },
    });
    expect(loadedShop?.location.slug).toBe(`${P}location`);
  });

  it("enforces Currency and Shop slug uniqueness", async () => {
    const { prisma, location } = await createFixture();

    await expect(
      prisma.currency.create({
        data: { name: "Duplicate Currency", slug: `${P}pokeyen` },
      })
    ).rejects.toMatchObject({ code: "P2002" });

    await expect(
      prisma.shop.create({
        data: {
          name: "Duplicate Shop",
          slug: `${P}supply`,
          locationId: location.id,
        },
      })
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("prevents an exact duplicate listing but allows another Currency", async () => {
    const {
      prisma,
      item,
      primaryCurrency,
      alternateCurrency,
      shop,
    } = await createFixture();

    await prisma.shopListing.create({
      data: {
        shopId: shop.id,
        itemId: item.id,
        currencyId: primaryCurrency.id,
        priceAmount: 1_250,
      },
    });

    await expect(
      prisma.shopListing.create({
        data: {
          shopId: shop.id,
          itemId: item.id,
          currencyId: primaryCurrency.id,
          priceAmount: 1_300,
        },
      })
    ).rejects.toMatchObject({ code: "P2002" });

    await expect(
      prisma.shopListing.create({
        data: {
          shopId: shop.id,
          itemId: item.id,
          currencyId: alternateCurrency.id,
          priceAmount: 20,
        },
      })
    ).resolves.toMatchObject({ priceAmount: 20 });
  });

  it("keeps verification independent and preserves it on normal edits", async () => {
    const {
      prisma,
      version,
      item,
      primaryCurrency,
      shop,
    } = await createFixture();

    const listing = await prisma.shopListing.create({
      data: {
        shopId: shop.id,
        itemId: item.id,
        currencyId: primaryCurrency.id,
        priceAmount: 1_250,
        verifiedAt: new Date("2026-07-25T01:00:00.000Z"),
        verifiedGameVersionId: version.id,
      },
    });

    await prisma.shop.update({
      where: { id: shop.id },
      data: { description: "Normal edit." },
    });
    await prisma.currency.update({
      where: { id: primaryCurrency.id },
      data: { description: "Normal edit." },
    });
    await prisma.shopListing.update({
      where: { id: listing.id },
      data: { notes: "Normal edit." },
    });

    const [reloadedShop, currency, reloadedListing] = await Promise.all([
      prisma.shop.findUnique({ where: { id: shop.id } }),
      prisma.currency.findUnique({ where: { id: primaryCurrency.id } }),
      prisma.shopListing.findUnique({ where: { id: listing.id } }),
    ]);

    expect(reloadedShop?.verifiedGameVersionId).toBe(version.id);
    expect(currency?.verifiedGameVersionId).toBe(version.id);
    expect(reloadedListing?.verifiedGameVersionId).toBe(version.id);
    expect(await countVerificationReferences(prisma, version.id)).toBe(3);
  });

  it("restricts every gameplay dependency until the listing is explicitly deleted", async () => {
    const {
      prisma,
      version,
      location,
      item,
      primaryCurrency,
      shop,
    } = await createFixture();

    const listing = await prisma.shopListing.create({
      data: {
        shopId: shop.id,
        itemId: item.id,
        currencyId: primaryCurrency.id,
        priceAmount: 1_250,
        verifiedGameVersionId: version.id,
        verifiedAt: new Date(),
      },
    });

    for (const operation of [
      () => prisma.item.delete({ where: { id: item.id } }),
      () => prisma.currency.delete({ where: { id: primaryCurrency.id } }),
      () => prisma.shop.delete({ where: { id: shop.id } }),
      () => prisma.location.delete({ where: { id: location.id } }),
      () => prisma.gameVersion.delete({ where: { id: version.id } }),
    ]) {
      let caught: unknown = null;
      try {
        await operation();
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
      expect((caught as Prisma.PrismaClientKnownRequestError).code).toBe(
        "P2003"
      );
    }

    await prisma.shopListing.delete({ where: { id: listing.id } });
    expect(
      await prisma.shopListing.findUnique({ where: { id: listing.id } })
    ).toBeNull();

    await prisma.shop.delete({ where: { id: shop.id } });
    await prisma.item.delete({ where: { id: item.id } });
    await prisma.currency.delete({ where: { id: primaryCurrency.id } });
    await prisma.location.delete({ where: { id: location.id } });
    await prisma.gameVersion.delete({ where: { id: version.id } });
  });
});
