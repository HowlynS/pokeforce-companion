import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

type CategorySeed = {
  slug: string;
  name: string;
  description?: string;
};

type ProfessionSeed = {
  slug: string;
  name: string;
  description?: string;
};

type ItemSeed = {
  slug: string;
  name: string;
  categorySlug: string;
};

type RecipeSeed = {
  slug: string;
  name: string;
  resultSlug: string;
  resultingQuantity?: number;
  professionSlug?: string;
  ingredients: { itemSlug: string; quantity: number }[];
};

const categories: CategorySeed[] = [
  { slug: "materials", name: "Materials", description: "Raw gathered resources." },
  { slug: "components", name: "Components", description: "Refined crafting components." },
  { slug: "consumables", name: "Consumables", description: "Single-use potions and brews." },
  { slug: "tools", name: "Tools", description: "Crafting and gathering tools." },
  { slug: "gear", name: "Gear", description: "Equippable weapons and armor." },
];

// Slice 8B: the deterministic project data spans all confirmed
// professions. The persisted "Blacksmithing" row was renamed to
// "Smithing" IN PLACE by migration 20260716152420 (same id, same slug
// "smithing" this upsert now matches), so its existing recipes stay
// associated with it — this list never recreates that row. The other new
// professions are sparse by design: no description/image is invented,
// and none require recipes or locations to be valid.
const professions: ProfessionSeed[] = [
  { slug: "alchemy", name: "Alchemy", description: "Brewing tonics and potions." },
  { slug: "foraging", name: "Foraging" },
  { slug: "fishing", name: "Fishing" },
  { slug: "farming", name: "Farming" },
  { slug: "crafting", name: "Crafting" },
  { slug: "mining", name: "Mining" },
  { slug: "archaeology", name: "Archaeology" },
  { slug: "cooking", name: "Cooking" },
  { slug: "construction", name: "Construction" },
  { slug: "smithing", name: "Smithing", description: "Smelting and forging metal goods." },
];

const items: ItemSeed[] = [
  { slug: "iron-ore", name: "Iron Ore", categorySlug: "materials" },
  { slug: "copper-ore", name: "Copper Ore", categorySlug: "materials" },
  { slug: "wood", name: "Wood", categorySlug: "materials" },
  { slug: "charcoal", name: "Charcoal", categorySlug: "materials" },
  { slug: "herb-leaf", name: "Herb Leaf", categorySlug: "materials" },
  { slug: "spring-water", name: "Spring Water", categorySlug: "materials" },
  { slug: "iron-ingot", name: "Iron Ingot", categorySlug: "components" },
  { slug: "copper-ingot", name: "Copper Ingot", categorySlug: "components" },
  { slug: "leather-strap", name: "Leather Strap", categorySlug: "components" },
  { slug: "minor-healing-tonic", name: "Minor Healing Tonic", categorySlug: "consumables" },
  { slug: "stamina-brew", name: "Stamina Brew", categorySlug: "consumables" },
  { slug: "smiths-hammer", name: "Smith's Hammer", categorySlug: "tools" },
  { slug: "whetstone", name: "Whetstone", categorySlug: "tools" },
  { slug: "iron-sword", name: "Iron Sword", categorySlug: "gear" },
  { slug: "copper-dagger", name: "Copper Dagger", categorySlug: "gear" },
  { slug: "reinforced-shield", name: "Reinforced Shield", categorySlug: "gear" },
];

const recipes: RecipeSeed[] = [
  {
    slug: "charcoal",
    name: "Charcoal",
    resultSlug: "charcoal",
    ingredients: [{ itemSlug: "wood", quantity: 2 }],
  },
  {
    slug: "iron-ingot",
    name: "Iron Ingot",
    resultSlug: "iron-ingot",
    professionSlug: "smithing",
    ingredients: [
      { itemSlug: "iron-ore", quantity: 2 },
      { itemSlug: "charcoal", quantity: 1 },
    ],
  },
  {
    slug: "copper-ingot",
    name: "Copper Ingot",
    resultSlug: "copper-ingot",
    professionSlug: "smithing",
    ingredients: [
      { itemSlug: "copper-ore", quantity: 2 },
      { itemSlug: "charcoal", quantity: 1 },
    ],
  },
  {
    slug: "iron-sword",
    name: "Iron Sword",
    resultSlug: "iron-sword",
    professionSlug: "smithing",
    ingredients: [
      { itemSlug: "iron-ingot", quantity: 2 },
      { itemSlug: "leather-strap", quantity: 1 },
    ],
  },
  {
    slug: "copper-dagger",
    name: "Copper Dagger",
    resultSlug: "copper-dagger",
    professionSlug: "smithing",
    ingredients: [
      { itemSlug: "copper-ingot", quantity: 1 },
      { itemSlug: "leather-strap", quantity: 1 },
    ],
  },
  {
    slug: "reinforced-shield",
    name: "Reinforced Shield",
    resultSlug: "reinforced-shield",
    professionSlug: "smithing",
    ingredients: [
      { itemSlug: "iron-ingot", quantity: 3 },
      { itemSlug: "leather-strap", quantity: 1 },
    ],
  },
  {
    slug: "minor-healing-tonic",
    name: "Minor Healing Tonic",
    resultSlug: "minor-healing-tonic",
    professionSlug: "alchemy",
    ingredients: [
      { itemSlug: "herb-leaf", quantity: 2 },
      { itemSlug: "spring-water", quantity: 1 },
    ],
  },
  {
    slug: "stamina-brew",
    name: "Stamina Brew",
    resultSlug: "stamina-brew",
    professionSlug: "alchemy",
    ingredients: [
      { itemSlug: "herb-leaf", quantity: 1 },
      { itemSlug: "spring-water", quantity: 2 },
    ],
  },
];

async function seedCategories(): Promise<Map<string, string>> {
  const idBySlug = new Map<string, string>();
  for (const category of categories) {
    const record = await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name, description: category.description ?? null },
      create: category,
    });
    idBySlug.set(category.slug, record.id);
  }
  return idBySlug;
}

async function seedProfessions(): Promise<Map<string, string>> {
  const idBySlug = new Map<string, string>();
  for (const profession of professions) {
    const record = await prisma.profession.upsert({
      where: { slug: profession.slug },
      update: { name: profession.name, description: profession.description ?? null },
      create: profession,
    });
    idBySlug.set(profession.slug, record.id);
  }
  return idBySlug;
}

async function seedItems(categoryIdBySlug: Map<string, string>): Promise<Map<string, string>> {
  const idBySlug = new Map<string, string>();
  for (const item of items) {
    const categoryId = categoryIdBySlug.get(item.categorySlug);
    if (!categoryId) {
      throw new Error(`Unknown category slug "${item.categorySlug}" for item "${item.slug}"`);
    }
    const record = await prisma.item.upsert({
      where: { slug: item.slug },
      update: { name: item.name, categoryId },
      create: { slug: item.slug, name: item.name, categoryId },
    });
    idBySlug.set(item.slug, record.id);
  }
  return idBySlug;
}

async function seedRecipes(
  itemIdBySlug: Map<string, string>,
  professionIdBySlug: Map<string, string>
): Promise<void> {
  for (const recipe of recipes) {
    const resultingItemId = itemIdBySlug.get(recipe.resultSlug);
    if (!resultingItemId) {
      throw new Error(`Unknown item slug "${recipe.resultSlug}" for recipe "${recipe.slug}"`);
    }
    const resolvedProfessionId = recipe.professionSlug
      ? professionIdBySlug.get(recipe.professionSlug)
      : undefined;
    if (recipe.professionSlug && !resolvedProfessionId) {
      throw new Error(`Unknown profession slug "${recipe.professionSlug}" for recipe "${recipe.slug}"`);
    }
    const professionId = resolvedProfessionId ?? null;

    const resultingQuantity = recipe.resultingQuantity ?? 1;

    const record = await prisma.recipe.upsert({
      where: { slug: recipe.slug },
      update: {
        name: recipe.name,
        resultingItemId,
        resultingQuantity,
        professionId,
      },
      create: {
        slug: recipe.slug,
        name: recipe.name,
        resultingItemId,
        resultingQuantity,
        professionId,
      },
    });

    const ingredientData = recipe.ingredients.map(({ itemSlug, quantity }) => {
      const itemId = itemIdBySlug.get(itemSlug);
      if (!itemId) {
        throw new Error(`Unknown item slug "${itemSlug}" in recipe "${recipe.slug}"`);
      }
      return { recipeId: record.id, itemId, quantity };
    });

    await prisma.$transaction([
      prisma.recipeIngredient.deleteMany({ where: { recipeId: record.id } }),
      prisma.recipeIngredient.createMany({ data: ingredientData }),
    ]);
  }
}

async function main() {
  const categoryIdBySlug = await seedCategories();
  const professionIdBySlug = await seedProfessions();
  const itemIdBySlug = await seedItems(categoryIdBySlug);
  await seedRecipes(itemIdBySlug, professionIdBySlug);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
