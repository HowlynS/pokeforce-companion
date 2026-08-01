import type { Prisma } from "@/generated/prisma/client";
import type { RichTextValue } from "@/lib/rich-text";
import {
  PUBLIC_DESIGN_GAME_VERSION_NAME,
  PUBLIC_DESIGN_IMAGE_PATH,
  PUBLIC_DESIGN_SLUG_PREFIX,
} from "@/lib/public-design/fixtures";

type FixturePrisma = (typeof import("@/lib/db"))["prisma"];
type FixtureTransaction = Parameters<Parameters<FixturePrisma["$transaction"]>[0]>[0];

const richDescription = {
  version: 1,
  doc: {
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Design review section" }] },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Bold", marks: [{ type: "bold" }] },
          { type: "text", text: ", italic", marks: [{ type: "italic" }] },
          { type: "text", text: ", and underlined", marks: [{ type: "underline" }] },
          { type: "text", text: " copy exercises the supported marks and intentionally continues into a long explanatory sentence so narrow layouts must wrap authored content without widening the document." },
        ],
      },
      { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Links and list" }] },
      {
        type: "bulletList",
        content: [
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Canonical Item link", marks: [{ type: "link", attrs: { href: "/items/design-review-item-dense" } }] }] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Safe external link", marks: [{ type: "link", attrs: { href: "https://example.com/design-review" } }] }] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Deleted target fallback", marks: [{ type: "link", attrs: { href: "/items/design-review-deleted-target" } }] }] }] },
        ],
      },
    ],
  },
} as const satisfies RichTextValue;

const richJson = richDescription as unknown as Prisma.InputJsonValue;
const richPlain =
  "Design review section\nBold, italic, and underlined copy exercises the supported marks and intentionally continues into a long explanatory sentence so narrow layouts must wrap authored content without widening the document.\nLinks and list\nCanonical Item link\nSafe external link\nDeleted target fallback";

function assertSafePrefix(): void {
  if (PUBLIC_DESIGN_SLUG_PREFIX.length < 12) {
    throw new Error("Refusing public-design cleanup: fixture prefix is unsafe.");
  }
}

async function cleanupWithinTransaction(tx: FixtureTransaction): Promise<number> {
  assertSafePrefix();
  const startsWith = { startsWith: PUBLIC_DESIGN_SLUG_PREFIX };
  let removed = 0;

  for (const result of await Promise.all([
    tx.recipeIngredient.deleteMany({ where: { OR: [{ recipe: { slug: startsWith } }, { item: { slug: startsWith } }] } }),
    tx.shopListing.deleteMany({ where: { OR: [{ shop: { slug: startsWith } }, { item: { slug: startsWith } }, { currency: { slug: startsWith } }] } }),
    tx.acquisitionSource.deleteMany({ where: { OR: [{ item: { slug: startsWith } }, { location: { slug: startsWith } }, { profession: { slug: startsWith } }] } }),
  ])) removed += result.count;

  for (const result of await Promise.all([
    tx.recipe.deleteMany({ where: { slug: startsWith } }),
    tx.shop.deleteMany({ where: { slug: startsWith } }),
  ])) removed += result.count;

  for (const result of await Promise.all([
    tx.item.deleteMany({ where: { slug: startsWith } }),
    tx.playerClass.deleteMany({ where: { slug: startsWith } }),
    tx.profession.deleteMany({ where: { slug: startsWith } }),
    tx.currency.deleteMany({ where: { slug: startsWith } }),
  ])) removed += result.count;

  for (let iteration = 0; iteration < 20; iteration += 1) {
    const leaves = await tx.location.findMany({
      where: { slug: startsWith, children: { none: { slug: startsWith } } },
      select: { id: true },
    });
    if (leaves.length === 0) break;
    const result = await tx.location.deleteMany({ where: { id: { in: leaves.map(({ id }) => id) } } });
    removed += result.count;
  }

  const [categories, versions] = await Promise.all([
    tx.category.deleteMany({ where: { slug: startsWith } }),
    tx.gameVersion.deleteMany({ where: { name: PUBLIC_DESIGN_GAME_VERSION_NAME } }),
  ]);
  return removed + categories.count + versions.count;
}

export async function cleanupPublicDesignFixtures(prisma: FixturePrisma): Promise<number> {
  return prisma.$transaction((tx) => cleanupWithinTransaction(tx), {
    maxWait: 10_000,
    timeout: 30_000,
  });
}

export async function setupPublicDesignFixtures(prisma: FixturePrisma): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      await cleanupWithinTransaction(tx);

      const version = await tx.gameVersion.create({
        data: { name: PUBLIC_DESIGN_GAME_VERSION_NAME, isCurrent: false },
      });
      const [richCategory, sparseCategory] = await Promise.all([
        tx.category.create({ data: { slug: "design-review-category-rich", name: "Design Review - Exceptionally Long Artisan Components and Trade Materials", description: richPlain, descriptionRich: richJson, image: PUBLIC_DESIGN_IMAGE_PATH } }),
        tx.category.create({ data: { slug: "design-review-category-sparse", name: "Design Review - Sparse Category" } }),
      ]);
      const [denseProfession, zeroProfession, oneProfession] = await Promise.all([
        tx.profession.create({ data: { slug: "design-review-profession-dense", name: "Design Review - Celestial Mercantile Artificing", description: richPlain, descriptionRich: richJson, image: PUBLIC_DESIGN_IMAGE_PATH, verifiedAt: new Date("2026-07-01T12:00:00.000Z"), verifiedGameVersionId: version.id } }),
        tx.profession.create({ data: { slug: "design-review-profession-zero", name: "Design Review - Empty Profession" } }),
        tx.profession.create({ data: { slug: "design-review-profession-one", name: "Design Review - One Recipe Profession", description: "A deliberately sparse craft path." } }),
      ]);
      void zeroProfession;

      await Promise.all([
        tx.playerClass.create({ data: { slug: "design-review-class-rich", name: "Design Review - Long-Distance Guild Quartermaster", description: richPlain, descriptionRich: richJson, verifiedAt: new Date("2026-06-15T08:00:00.000Z"), verifiedGameVersionId: version.id } }),
        tx.playerClass.create({ data: { slug: "design-review-class-sparse", name: "Design Review - Sparse Class" } }),
      ]);

      let parentId: string | null = null;
      const locationDefinitions = [
        ["design-review-location-region", "Design Review - Northwind Mercantile Region", "REGION"],
        ["design-review-location-route", "Design Review - Long Caravan Route Through the Amber Highlands", "ROUTE"],
        ["design-review-location-town", "Design Review - Brassmarket Township", "TOWN"],
        ["design-review-location-building", "Design Review - Guild Exchange Interior", "BUILDING"],
        ["design-review-location-dungeon", "Design Review - Subterranean Storehouse", "DUNGEON"],
        ["design-review-location-sub-area", "Design Review - Lower Vault Sub-area", "SUB_AREA"],
        ["design-review-location-dense", "Design Review - Special Auction Annex with an Exceptionally Long Name", "SPECIAL_AREA"],
      ] as const;
      let denseLocationId = "";
      for (const [slug, name, type] of locationDefinitions) {
        const location: { id: string } = await tx.location.create({
          data: {
            slug,
            name,
            type,
            parentId,
            ...(slug === "design-review-location-dense"
              ? { description: richPlain, descriptionRich: richJson, accessNote: "Accessible after following the full merchant hierarchy.", image: PUBLIC_DESIGN_IMAGE_PATH }
              : {}),
          },
        });
        parentId = location.id;
        if (slug === "design-review-location-dense") denseLocationId = location.id;
      }

      const [goldCurrency, tokenCurrency] = await Promise.all([
        tx.currency.create({ data: { slug: "design-review-currency-gold", name: "Design Review - Guild Crowns", symbol: "GC", description: richPlain, descriptionRich: richJson, image: PUBLIC_DESIGN_IMAGE_PATH, verifiedAt: new Date("2026-06-20T10:00:00.000Z"), verifiedGameVersionId: version.id } }),
        tx.currency.create({ data: { slug: "design-review-currency-token", name: "Design Review - Barter Token" } }),
      ]);

      const itemInputs = Array.from({ length: 18 }, (_, index) => ({
        slug:
          index === 0
            ? "design-review-item-dense"
            : index === 1
              ? "design-review-item-no-image-long-name"
              : `design-review-item-${String(index + 1).padStart(2, "0")}`,
        name:
          index === 0
            ? "Design Review - Guildmaster's Resonant Trade Component"
            : index === 1
              ? "Design Review - An Extremely Long Unillustrated Component Name That Must Wrap Without Moving the Card Grid"
              : `Design Review - Component ${String(index + 1).padStart(2, "0")}`,
        image: index === 1 ? null : PUBLIC_DESIGN_IMAGE_PATH,
        heldItem: index === 0,
        tradeable: index % 2 === 0,
        baseValue: index === 0 ? 999999 : index * 125 + 1,
      }));
      const items = [];
      for (const [index, input] of itemInputs.entries()) {
        items.push(
          await tx.item.create({
            data: {
              ...input,
              categoryId: index === 17 ? sparseCategory.id : richCategory.id,
              ...(index === 0
                ? { description: richPlain, descriptionRich: richJson, verifiedAt: new Date("2026-07-02T09:30:00.000Z"), verifiedGameVersionId: version.id }
                : {}),
            },
          })
        );
      }

      for (let index = 0; index < 13; index += 1) {
        const recipe = await tx.recipe.create({
          data: {
            slug: index === 0 ? "design-review-recipe-many-ingredients" : `design-review-recipe-dense-${String(index + 1).padStart(2, "0")}`,
            name: index === 0 ? "Design Review - Grand Guildmaster Exchange Assembly with a Very Long Result Name" : `Design Review - Dense Recipe ${String(index + 1).padStart(2, "0")}`,
            image: index === 0 ? PUBLIC_DESIGN_IMAGE_PATH : null,
            resultingItemId: items[(index % 10) + 8].id,
            resultQuantityMin: index === 0 ? 25 : 1,
            resultQuantityMax: index === 0 ? 250 : 1,
            professionId: denseProfession.id,
            requiredLevel: index === 0 ? 999 : index + 1,
            experienceReward: index === 0 ? 50000 : index * 10,
            verifiedAt: index === 0 ? new Date("2026-07-03T11:00:00.000Z") : null,
            verifiedGameVersionId: index === 0 ? version.id : null,
          },
        });
        const ingredientItems = index === 0 ? items.slice(0, 6) : [items[0]];
        await tx.recipeIngredient.createMany({
          data: ingredientItems.map((item, ingredientIndex) => ({
            recipeId: recipe.id,
            itemId: item.id,
            quantity: index === 0 ? (ingredientIndex + 1) * 999 : 1,
          })),
        });
      }

      const inheritedRecipe = await tx.recipe.create({
        data: {
          slug: "design-review-recipe-inherited-image",
          name: "Design Review - Inherited Result Sprite Recipe",
          resultingItemId: items[8].id,
          professionId: oneProfession.id,
          resultQuantityMin: 1,
          resultQuantityMax: 1,
          experienceReward: 0,
        },
      });
      await tx.recipeIngredient.create({ data: { recipeId: inheritedRecipe.id, itemId: items[1].id, quantity: 1 } });

      const [denseShop, sparseShop] = await Promise.all([
        tx.shop.create({ data: { slug: "design-review-shop-dense", name: "Design Review - The Guild's Exceptionally Long Multi-Currency Exchange Counter", locationId: denseLocationId, description: richPlain, descriptionRich: richJson, image: PUBLIC_DESIGN_IMAGE_PATH, verifiedAt: new Date("2026-07-04T14:00:00.000Z"), verifiedGameVersionId: version.id } }),
        tx.shop.create({ data: { slug: "design-review-shop-sparse", name: "Design Review - Empty Annex", locationId: denseLocationId } }),
      ]);
      void sparseShop;

      await tx.shopListing.createMany({
        data: items.slice(0, 10).flatMap((item, index) => [
          { shopId: denseShop.id, itemId: item.id, currencyId: goldCurrency.id, priceAmount: (index + 1) * 123456, notes: index === 0 ? "A deliberately long listing note that must wrap without widening the price column or the public document." : null, verifiedAt: index === 0 ? new Date("2026-07-04T14:30:00.000Z") : null, verifiedGameVersionId: index === 0 ? version.id : null },
          ...(index < 3 ? [{ shopId: denseShop.id, itemId: item.id, currencyId: tokenCurrency.id, priceAmount: index + 1, notes: null }] : []),
        ]),
      });

      await tx.acquisitionSource.createMany({
        data: [
          { itemId: items[0].id, type: "FORAGING", locationId: denseLocationId, sourceLabel: "Dense glade", quantity: "1-999", notes: "Grouped source with a long note.", verifiedAt: new Date("2026-07-05T09:00:00.000Z"), verifiedGameVersionId: version.id },
          { itemId: items[0].id, type: "MINING", locationId: denseLocationId, sourceLabel: "Lower vault seam", quantity: "250" },
          { itemId: items[0].id, type: "CRAFTING", professionId: denseProfession.id, sourceLabel: "Guild exchange assembly", quantity: "25" },
          { itemId: items[0].id, type: "NPC_OR_SHOP", locationId: denseLocationId, sourceLabel: "Annex clerk", quantity: "1" },
          { itemId: items[2].id, type: "REWARD", locationId: denseLocationId, sourceLabel: "One-source fixture", quantity: "1" },
        ],
      });
    },
    { maxWait: 10_000, timeout: 60_000 }
  );
}

export async function readPublicDesignFixtureCounts(prisma: FixturePrisma) {
  const startsWith = { startsWith: PUBLIC_DESIGN_SLUG_PREFIX };
  const [categories, items, recipes, professions, playerClasses, locations, shops, currencies, acquisitionSources, shopListings] = await Promise.all([
    prisma.category.count({ where: { slug: startsWith } }),
    prisma.item.count({ where: { slug: startsWith } }),
    prisma.recipe.count({ where: { slug: startsWith } }),
    prisma.profession.count({ where: { slug: startsWith } }),
    prisma.playerClass.count({ where: { slug: startsWith } }),
    prisma.location.count({ where: { slug: startsWith } }),
    prisma.shop.count({ where: { slug: startsWith } }),
    prisma.currency.count({ where: { slug: startsWith } }),
    prisma.acquisitionSource.count({ where: { item: { slug: startsWith } } }),
    prisma.shopListing.count({ where: { shop: { slug: startsWith } } }),
  ]);
  return { categories, items, recipes, professions, playerClasses, locations, shops, currencies, acquisitionSources, shopListings };
}
