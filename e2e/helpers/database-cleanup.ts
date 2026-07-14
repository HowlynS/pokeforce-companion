// Guard-first, prefix-scoped database helpers for the authenticated
// Category and Profession browser tests.
//
// Why not the Prisma helper from src/lib/testing/integration-database.ts:
// Playwright's test transpiler compiles imports to CommonJS, and the
// generated Prisma client is an ES module using import.meta, which cannot
// load in that pipeline. So these helpers use the already-installed `pg`
// driver directly. Environment validation is NOT duplicated: every call
// runs the same fail-closed loadTestEnvironment() guard before a
// connection is opened, so a misconfigured environment throws first and
// the development database can never be reached. Never logs; deletes only
// Category rows carrying the browser-test slug prefix.

import { Client } from "pg";
import { loadTestEnvironment } from "../../src/lib/testing/load-test-environment";

// Covers every slug the browser tests use (test-e2e-category,
// test-e2e-category-updated, test-e2e-category-duplicate) and can never
// match a seeded slug (materials, components, consumables, tools, gear).
export const E2E_CATEGORY_SLUG_PREFIX = "test-e2e-category";

// Covers every Profession slug the browser tests use (test-e2e-profession,
// test-e2e-profession-updated, test-e2e-profession-duplicate,
// test-e2e-profession-blocked) and can never match a seeded slug
// (blacksmithing, alchemy).
export const E2E_PROFESSION_SLUG_PREFIX = "test-e2e-profession";

// Temporary Item/Recipe rows created ONLY so a Recipe can reference a
// test Profession for the relation-blocked deletion test. Deliberately a
// separate, unmistakable prefix so relation cleanup can never touch a
// seeded Item or Recipe (whose slugs are plain names like iron-sword).
export const E2E_PROFESSION_RELATION_SLUG_PREFIX =
  "test-e2e-profession-relation-";

async function withVerifiedDatabase<T>(
  run: (client: Client) => Promise<T>
): Promise<T> {
  // Fail-closed guard first: loads .env.test.local (override) and throws a
  // secret-free error unless every value belongs to the isolated test
  // project. Only then is a connection opened.
  loadTestEnvironment();

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

/**
 * Deletes ONLY Category rows whose slug starts with the browser-test
 * prefix. Returns how many rows were removed. Throws (failing the calling
 * test or hook loudly) if the database rejects the delete.
 */
export async function deleteE2eTestCategories(): Promise<number> {
  // Defense in depth: a broad delete must be impossible even if the prefix
  // constant is ever edited carelessly.
  if (E2E_CATEGORY_SLUG_PREFIX.length < 5) {
    throw new Error(
      "Refusing prefix-scoped cleanup: the browser-test slug prefix is suspiciously short."
    );
  }

  return withVerifiedDatabase(async (client) => {
    const result = await client.query(
      `delete from "Category" where slug like $1`,
      [`${E2E_CATEGORY_SLUG_PREFIX}%`]
    );
    return result.rowCount ?? 0;
  });
}

/** Read-only count of leftover browser-test Category rows. */
export async function countE2eTestCategories(): Promise<number> {
  return withVerifiedDatabase(async (client) => {
    const result = await client.query(
      `select count(*)::int as n from "Category" where slug like $1`,
      [`${E2E_CATEGORY_SLUG_PREFIX}%`]
    );
    return result.rows[0].n as number;
  });
}

// Defense in depth for every Profession helper below: a broad delete or a
// link against a seeded row must be impossible even if a prefix constant
// is ever edited carelessly.
function assertProfessionPrefixesAreSafe(): void {
  if (
    E2E_PROFESSION_SLUG_PREFIX.length < 5 ||
    !E2E_PROFESSION_RELATION_SLUG_PREFIX.startsWith(E2E_PROFESSION_SLUG_PREFIX)
  ) {
    throw new Error(
      "Refusing prefix-scoped cleanup: the browser-test Profession slug prefixes are unsafe."
    );
  }
}

/**
 * Deletes ONLY the browser-test Profession rows and the temporary relation
 * rows created for the blocked-deletion test, in foreign-key-safe order:
 * Recipe first (it references both the Item and the Profession), then Item,
 * then Profession. Returns how many rows were removed in total. Throws
 * (failing the calling test or hook loudly) if the database rejects a
 * delete.
 */
export async function deleteE2eTestProfessionRecords(): Promise<number> {
  assertProfessionPrefixesAreSafe();

  return withVerifiedDatabase(async (client) => {
    const recipes = await client.query(
      `delete from "Recipe" where slug like $1`,
      [`${E2E_PROFESSION_RELATION_SLUG_PREFIX}%`]
    );
    const items = await client.query(
      `delete from "Item" where slug like $1`,
      [`${E2E_PROFESSION_RELATION_SLUG_PREFIX}%`]
    );
    const professions = await client.query(
      `delete from "Profession" where slug like $1`,
      [`${E2E_PROFESSION_SLUG_PREFIX}%`]
    );
    return (
      (recipes.rowCount ?? 0) +
      (items.rowCount ?? 0) +
      (professions.rowCount ?? 0)
    );
  });
}

/**
 * Read-only count of leftover browser-test Profession rows plus any
 * temporary relation Item/Recipe rows.
 */
export async function countE2eTestProfessionRecords(): Promise<number> {
  return withVerifiedDatabase(async (client) => {
    const result = await client.query(
      `select
         (select count(*) from "Profession" where slug like $1)::int
           + (select count(*) from "Recipe" where slug like $2)::int
           + (select count(*) from "Item" where slug like $2)::int as n`,
      [
        `${E2E_PROFESSION_SLUG_PREFIX}%`,
        `${E2E_PROFESSION_RELATION_SLUG_PREFIX}%`,
      ]
    );
    return result.rows[0].n as number;
  });
}

/**
 * Creates the minimum temporary rows for a Recipe to reference a
 * browser-test Profession: one Item (the required resulting item) and one
 * Recipe linked to the Profession. Both rows use the unmistakable relation
 * prefix, and the target Profession slug MUST itself carry the browser-test
 * prefix, so a seeded Profession can never be linked. Item/Recipe admin
 * forms are deliberately not used — those browser workflows are out of
 * scope for this suite.
 */
export async function createTemporaryRecipeForProfession(
  professionSlug: string
): Promise<void> {
  assertProfessionPrefixesAreSafe();

  if (!professionSlug.startsWith(E2E_PROFESSION_SLUG_PREFIX)) {
    throw new Error(
      "Refusing to link a Recipe: the target Profession slug does not carry the browser-test prefix."
    );
  }

  await withVerifiedDatabase(async (client) => {
    const profession = await client.query(
      `select id from "Profession" where slug = $1`,
      [professionSlug]
    );

    if (profession.rowCount !== 1) {
      throw new Error(
        "Cannot create the temporary Recipe relation: the browser-test Profession was not found."
      );
    }

    // id has no database default (Prisma cuids are client-generated) and
    // updatedAt has no database default (@updatedAt is client-maintained),
    // so both are supplied explicitly.
    const item = await client.query(
      `insert into "Item" (id, slug, name, "updatedAt")
       values (gen_random_uuid()::text, $1, $2, now())
       returning id`,
      [
        `${E2E_PROFESSION_RELATION_SLUG_PREFIX}item`,
        "Test E2E Profession Relation Item",
      ]
    );

    await client.query(
      `insert into "Recipe"
         (id, slug, name, "resultingItemId", "resultingQuantity", "professionId", "updatedAt")
       values (gen_random_uuid()::text, $1, $2, $3, 1, $4, now())`,
      [
        `${E2E_PROFESSION_RELATION_SLUG_PREFIX}recipe`,
        "Test E2E Profession Relation Recipe",
        item.rows[0].id as string,
        profession.rows[0].id as string,
      ]
    );
  });
}

/**
 * Removes ONLY the temporary relation Recipe/Item rows (foreign-key-safe
 * order), leaving the browser-test Profession in place so the deletion flow
 * can be retried through the real UI. Returns how many rows were removed.
 */
export async function removeTemporaryRecipeForProfession(): Promise<number> {
  assertProfessionPrefixesAreSafe();

  return withVerifiedDatabase(async (client) => {
    const recipes = await client.query(
      `delete from "Recipe" where slug like $1`,
      [`${E2E_PROFESSION_RELATION_SLUG_PREFIX}%`]
    );
    const items = await client.query(
      `delete from "Item" where slug like $1`,
      [`${E2E_PROFESSION_RELATION_SLUG_PREFIX}%`]
    );
    return (recipes.rowCount ?? 0) + (items.rowCount ?? 0);
  });
}

/** Read-only snapshot of the seeded fixture counts for preservation checks. */
export async function readFixtureCounts(): Promise<{
  categories: number;
  professions: number;
  items: number;
  recipes: number;
  recipeIngredients: number;
}> {
  return withVerifiedDatabase(async (client) => {
    const result = await client.query(
      `select
         (select count(*) from "Category")::int         as categories,
         (select count(*) from "Profession")::int       as professions,
         (select count(*) from "Item")::int             as items,
         (select count(*) from "Recipe")::int           as recipes,
         (select count(*) from "RecipeIngredient")::int as recipe_ingredients`
    );
    const row = result.rows[0];
    return {
      categories: row.categories as number,
      professions: row.professions as number,
      items: row.items as number,
      recipes: row.recipes as number,
      recipeIngredients: row.recipe_ingredients as number,
    };
  });
}
