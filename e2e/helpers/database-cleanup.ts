// Guard-first, prefix-scoped database helpers for the authenticated
// Category browser tests.
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
