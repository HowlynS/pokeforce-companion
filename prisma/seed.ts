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

type PlayerClassSeed = {
  slug: string;
  name: string;
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
  resultQuantityMin?: number;
  resultQuantityMax?: number;
  professionSlug?: string;
  playerClassSlug: string;
  experienceReward: number;
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

// Player Classes + Recipe EXP/Required Class milestone: the same 5
// foundational Classes migration 20260728120000 already inserted directly
// (so a fresh `prisma migrate deploy` never depends on this script having
// run). This upsert exists so `pnpm db:seed` stays the idempotent,
// re-runnable source of truth for foundational reference data alongside
// Categories and Professions — matched by slug, so re-running it against
// the migration's own rows is a harmless no-op. No description or image is
// invented for any of them.
const playerClasses: PlayerClassSeed[] = [
  { slug: "trainer", name: "Trainer" },
  { slug: "artisan", name: "Artisan" },
  { slug: "rancher", name: "Rancher" },
  { slug: "ranger", name: "Ranger" },
  { slug: "farmhand", name: "Farmhand" },
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
    playerClassSlug: "farmhand",
    experienceReward: 5,
    ingredients: [{ itemSlug: "wood", quantity: 2 }],
  },
  {
    slug: "iron-ingot",
    name: "Iron Ingot",
    resultSlug: "iron-ingot",
    professionSlug: "smithing",
    playerClassSlug: "artisan",
    experienceReward: 15,
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
    playerClassSlug: "artisan",
    experienceReward: 15,
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
    playerClassSlug: "artisan",
    experienceReward: 40,
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
    playerClassSlug: "artisan",
    experienceReward: 25,
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
    playerClassSlug: "artisan",
    experienceReward: 45,
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
    playerClassSlug: "ranger",
    experienceReward: 20,
    ingredients: [
      { itemSlug: "herb-leaf", quantity: 2 },
      { itemSlug: "spring-water", quantity: 1 },
    ],
  },
  {
    slug: "stamina-brew",
    name: "Stamina Brew",
    resultSlug: "stamina-brew",
    playerClassSlug: "ranger",
    experienceReward: 20,
    // The one deliberately variable-output seeded recipe: a batch of Stamina
    // Brew yields anywhere from 1 to 4 bottles, proving the range end to
    // end (migration, admin editor, and public "Produces 1-4" display)
    // against real deterministic fixture data rather than a temporary
    // e2e-only row.
    resultQuantityMin: 1,
    resultQuantityMax: 4,
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

async function seedPlayerClasses(): Promise<Map<string, string>> {
  const idBySlug = new Map<string, string>();
  for (const playerClass of playerClasses) {
    const record = await prisma.playerClass.upsert({
      where: { slug: playerClass.slug },
      update: { name: playerClass.name },
      create: playerClass,
    });
    idBySlug.set(playerClass.slug, record.id);
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
  professionIdBySlug: Map<string, string>,
  playerClassIdBySlug: Map<string, string>
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

    const playerClassId = playerClassIdBySlug.get(recipe.playerClassSlug);
    if (!playerClassId) {
      throw new Error(`Unknown player class slug "${recipe.playerClassSlug}" for recipe "${recipe.slug}"`);
    }

    const resultQuantityMin = recipe.resultQuantityMin ?? 1;
    const resultQuantityMax = recipe.resultQuantityMax ?? 1;

    const record = await prisma.recipe.upsert({
      where: { slug: recipe.slug },
      update: {
        name: recipe.name,
        resultingItemId,
        resultQuantityMin,
        resultQuantityMax,
        professionId,
        playerClassId,
        experienceReward: recipe.experienceReward,
      },
      create: {
        slug: recipe.slug,
        name: recipe.name,
        resultingItemId,
        resultQuantityMin,
        resultQuantityMax,
        professionId,
        playerClassId,
        experienceReward: recipe.experienceReward,
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
  const playerClassIdBySlug = await seedPlayerClasses();
  const itemIdBySlug = await seedItems(categoryIdBySlug);
  await seedRecipes(itemIdBySlug, professionIdBySlug, playerClassIdBySlug);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
