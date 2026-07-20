// Guard-first, prefix-scoped database helpers for the authenticated
// Category, Profession, Item, and Recipe browser tests.
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
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadTestEnvironment } from "../../src/lib/testing/load-test-environment";
import {
  SERVICE_TEST_BUCKET,
  createAnonymousServiceClient,
  createSignedInAdminClient,
  signOutServiceClient,
} from "../../src/lib/testing/supabase-service";

// Covers every slug the browser tests use (test-e2e-category,
// test-e2e-category-updated, test-e2e-category-duplicate) and can never
// match a seeded slug (materials, components, consumables, tools, gear).
export const E2E_CATEGORY_SLUG_PREFIX = "test-e2e-category";

// Covers every Profession slug the browser tests use (test-e2e-profession,
// test-e2e-profession-updated, test-e2e-profession-duplicate,
// test-e2e-profession-blocked) and can never match a seeded slug (e.g.
// smithing, alchemy, foraging, ...).
export const E2E_PROFESSION_SLUG_PREFIX = "test-e2e-profession";

// Temporary Item/Recipe rows created ONLY so a Recipe can reference a
// test Profession for the relation-blocked deletion test. Deliberately a
// separate, unmistakable prefix so relation cleanup can never touch a
// seeded Item or Recipe (whose slugs are plain names like iron-sword).
export const E2E_PROFESSION_RELATION_SLUG_PREFIX =
  "test-e2e-profession-relation-";

// Covers every Item slug the browser tests use (test-e2e-item,
// test-e2e-item-updated, test-e2e-item-duplicate, the blocked-deletion
// items, and the relation helper item below) and can never match a seeded
// slug (iron-ore, iron-sword, ...).
export const E2E_ITEM_SLUG_PREFIX = "test-e2e-item";

// Temporary Recipe/helper-Item rows created ONLY so a Recipe can reference
// a test Item (as its result or through an ingredient) for the
// blocked-deletion tests. Deliberately a separate, unmistakable prefix so
// relation cleanup can never touch a seeded Recipe.
export const E2E_ITEM_RELATION_SLUG_PREFIX = "test-e2e-item-relation-";

// Covers every Recipe slug the browser tests use (test-e2e-recipe,
// test-e2e-recipe-updated, and the validation/capacity/deletion recipes)
// and can never match a seeded slug (iron-sword, charcoal, ...).
export const E2E_RECIPE_SLUG_PREFIX = "test-e2e-recipe";

// Reserved for temporary Items the Recipe suite might need. The current
// tests use only seeded Items (referenced, never modified), but cleanup
// still sweeps this prefix defensively.
export const E2E_RECIPE_ITEM_SLUG_PREFIX = "test-e2e-recipe-item-";

// Covers every Location slug the browser tests use (test-e2e-location,
// test-e2e-location-updated, test-e2e-location-duplicate,
// test-e2e-location-parent, test-e2e-location-child, ...) and can never
// match a seeded slug. Unlike Profession/Item, Location's own admin form
// can already assign one test Location as another's parent, so no separate
// "relation" prefix or raw-SQL relation helper is needed for the
// blocked-deletion test.
export const E2E_LOCATION_SLUG_PREFIX = "test-e2e-location";

// Covers every Location slug the image browser tests use — the same
// sub-prefix arrangement (and the same run-order caveat) as the Item image
// prefix below, relative to test-e2e-location.
export const E2E_LOCATION_IMAGE_SLUG_PREFIX = "test-e2e-location-image";

// Covers every Item slug the image browser tests use. It is deliberately a
// sub-prefix of test-e2e-item, so the generic Item cleanup would still
// catch a stranded row — but the image-aware cleanup below must always run
// first (this suite's own hooks), because only it also removes the exact
// Storage object recorded on the row.
export const E2E_ITEM_IMAGE_SLUG_PREFIX = "test-e2e-item-image";

// Covers every Profession slug the image browser tests use — the same
// sub-prefix arrangement (and the same run-order caveat) as the Item image
// prefix above, relative to test-e2e-profession.
export const E2E_PROFESSION_IMAGE_SLUG_PREFIX = "test-e2e-profession-image";

// Covers every Recipe slug the image browser tests use — the same
// sub-prefix arrangement (and the same run-order caveat) as the Item image
// prefix above, relative to test-e2e-recipe.
export const E2E_RECIPE_IMAGE_SLUG_PREFIX = "test-e2e-recipe-image";

// Covers the temporary Item/Location/Profession rows the acquisition-source
// browser tests create. AcquisitionSource has no slug of its own, so its
// rows are matched through these relations rather than a dedicated prefix.
export const E2E_ACQUISITION_ITEM_SLUG_PREFIX = "test-e2e-acqsrc-item";
export const E2E_ACQUISITION_LOCATION_SLUG_PREFIX = "test-e2e-acqsrc-location";
export const E2E_ACQUISITION_PROFESSION_SLUG_PREFIX =
  "test-e2e-acqsrc-profession";

// The persistent test-only CURRENT Game Version fixture. Verification
// browser tests need a row marked isCurrent in the isolated test database
// (the retired CURRENT_GAME_BUILD_ID environment value played this role
// before Slice 9A). ensureCurrentGameVersionFixture() (re)creates it and
// makes it the ONLY current version at the start of every browser run, so
// tests that switch the current version can never leave a stale state
// behind for the next run.
export const E2E_CURRENT_GAME_VERSION_NAME = "test-gv-current";

// Covers every Game Version NAME the game-version browser tests create
// (GameVersion has no slug). Deliberately distinct from the fixture name
// above so cleanup never removes the persistent fixture.
export const E2E_GAME_VERSION_NAME_PREFIX = "test-e2e-gv-";

// Temporary Item rows created ONLY so a verification stamp can reference a
// test Game Version for the blocked-deletion test. Not a sub-prefix of
// test-e2e-item, so the Item suite's cleanup and this one can never race
// over the same rows.
export const E2E_GAME_VERSION_ITEM_SLUG_PREFIX = "test-e2e-gv-item";

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
 * Creates one temporary Recipe (and its required resulting Item) linked to
 * a browser-test Profession, with a caller-chosen suffix so MULTIPLE
 * recipes can coexist under the same Profession — unlike the single
 * fixed-name `createTemporaryRecipeForProfession` above, which the
 * Profession Recipes tab tests (Slice 9D.3) need to prove alphabetical
 * ordering and the hide-empty requiredLevel behavior. The target
 * Profession slug MUST carry the browser-test prefix, so a seeded
 * Profession can never be linked; both created rows carry the same
 * relation prefix, so the existing deleteE2eTestProfessionRecords sweep
 * catches them with no new cleanup surface.
 */
export async function createTemporaryRecipeForProfessionsTab(
  professionSlug: string,
  options: {
    suffix: string;
    recipeName: string;
    resultingQuantity?: number;
    requiredLevel?: number;
  }
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

    const item = await client.query(
      `insert into "Item" (id, slug, name, "updatedAt")
       values (gen_random_uuid()::text, $1, $2, now())
       returning id`,
      [
        `${E2E_PROFESSION_RELATION_SLUG_PREFIX}item-${options.suffix}`,
        `Test E2E Profession Recipes Tab Result ${options.suffix}`,
      ]
    );

    await client.query(
      `insert into "Recipe"
         (id, slug, name, "resultingItemId", "resultingQuantity",
          "professionId", "requiredLevel", "updatedAt")
       values (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, now())`,
      [
        `${E2E_PROFESSION_RELATION_SLUG_PREFIX}recipe-${options.suffix}`,
        options.recipeName,
        item.rows[0].id as string,
        options.resultingQuantity ?? 1,
        profession.rows[0].id as string,
        options.requiredLevel ?? null,
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

// Defense in depth for every Location helper below.
function assertLocationPrefixIsSafe(): void {
  if (E2E_LOCATION_SLUG_PREFIX.length < 5) {
    throw new Error(
      "Refusing prefix-scoped cleanup: the browser-test Location slug prefix is suspiciously short."
    );
  }
}

/**
 * Deletes ONLY the browser-test Location rows, regardless of how deep a
 * parent/child chain the tests built. A single bulk DELETE against a
 * self-referencing table is not safe here — with ON DELETE RESTRICT,
 * whether removing a whole chain in one statement succeeds can depend on
 * the (unspecified) order Postgres processes matching rows. Instead this
 * repeatedly deletes only rows that are currently leaves among the
 * prefixed set (no other prefixed row still points at them as parentId),
 * which is safe regardless of chain depth or scan order. Returns how many
 * rows were removed in total; throws loudly if the loop cannot make
 * progress (which would indicate a real, unexpected cycle).
 */
export async function deleteE2eTestLocationRecords(): Promise<number> {
  assertLocationPrefixIsSafe();

  return withVerifiedDatabase(async (client) => {
    let totalDeleted = 0;

    for (let iteration = 0; iteration < 50; iteration += 1) {
      const result = await client.query(
        `delete from "Location"
         where slug like $1
           and id not in (
             select "parentId" from "Location"
             where "parentId" is not null and slug like $1
           )`,
        [`${E2E_LOCATION_SLUG_PREFIX}%`]
      );
      const deleted = result.rowCount ?? 0;
      totalDeleted += deleted;

      if (deleted === 0) {
        break;
      }
    }

    return totalDeleted;
  });
}

/** Read-only count of leftover browser-test Location rows. */
export async function countE2eTestLocationRecords(): Promise<number> {
  return withVerifiedDatabase(async (client) => {
    const result = await client.query(
      `select count(*)::int as n from "Location" where slug like $1`,
      [`${E2E_LOCATION_SLUG_PREFIX}%`]
    );
    return result.rows[0].n as number;
  });
}

/**
 * Deletes ONLY the browser-test acquisition-source fixtures: RecipeIngredient
 * and Recipe rows that reference a prefixed Item first (a Recipe's
 * resultingItemId is ON DELETE RESTRICT, so it must be cleared before the
 * Item can be deleted — the Slice 8E "crafting source coexists with a real
 * recipe" test creates exactly such a Recipe), then AcquisitionSource rows
 * matched through their Item/Location/Profession relation (the model has no
 * slug of its own), then the prefixed Item/Location/Profession rows
 * themselves. Returns how many rows were removed in total; throws loudly on
 * a rejected delete.
 */
export async function deleteE2eTestAcquisitionRecords(): Promise<number> {
  if (
    E2E_ACQUISITION_ITEM_SLUG_PREFIX.length < 5 ||
    E2E_ACQUISITION_LOCATION_SLUG_PREFIX.length < 5 ||
    E2E_ACQUISITION_PROFESSION_SLUG_PREFIX.length < 5
  ) {
    throw new Error(
      "Refusing prefix-scoped cleanup: an acquisition-source browser-test slug prefix is suspiciously short."
    );
  }

  return withVerifiedDatabase(async (client) => {
    const itemPrefix = `${E2E_ACQUISITION_ITEM_SLUG_PREFIX}%`;
    const locationPrefix = `${E2E_ACQUISITION_LOCATION_SLUG_PREFIX}%`;
    const professionPrefix = `${E2E_ACQUISITION_PROFESSION_SLUG_PREFIX}%`;

    const ingredients = await client.query(
      `delete from "RecipeIngredient"
       where "recipeId" in (
         select id from "Recipe" where "resultingItemId" in (select id from "Item" where slug like $1)
       )
          or "itemId" in (select id from "Item" where slug like $1)`,
      [itemPrefix]
    );
    const recipes = await client.query(
      `delete from "Recipe" where "resultingItemId" in (select id from "Item" where slug like $1)`,
      [itemPrefix]
    );
    const sources = await client.query(
      `delete from "AcquisitionSource"
       where "itemId" in (select id from "Item" where slug like $1)
          or "locationId" in (select id from "Location" where slug like $2)
          or "professionId" in (select id from "Profession" where slug like $3)`,
      [itemPrefix, locationPrefix, professionPrefix]
    );
    const items = await client.query(
      `delete from "Item" where slug like $1`,
      [itemPrefix]
    );
    const locations = await client.query(
      `delete from "Location" where slug like $1`,
      [locationPrefix]
    );
    const professions = await client.query(
      `delete from "Profession" where slug like $1`,
      [professionPrefix]
    );

    return (
      (ingredients.rowCount ?? 0) +
      (recipes.rowCount ?? 0) +
      (sources.rowCount ?? 0) +
      (items.rowCount ?? 0) +
      (locations.rowCount ?? 0) +
      (professions.rowCount ?? 0)
    );
  });
}

/** Read-only count of leftover browser-test acquisition-source fixtures. */
export async function countE2eTestAcquisitionRecords(): Promise<number> {
  return withVerifiedDatabase(async (client) => {
    const itemPrefix = `${E2E_ACQUISITION_ITEM_SLUG_PREFIX}%`;
    const locationPrefix = `${E2E_ACQUISITION_LOCATION_SLUG_PREFIX}%`;
    const professionPrefix = `${E2E_ACQUISITION_PROFESSION_SLUG_PREFIX}%`;

    const result = await client.query(
      `select
         (select count(*) from "Recipe"
            where "resultingItemId" in (select id from "Item" where slug like $1))::int
           + (select count(*) from "AcquisitionSource"
            where "itemId" in (select id from "Item" where slug like $1)
               or "locationId" in (select id from "Location" where slug like $2)
               or "professionId" in (select id from "Profession" where slug like $3))::int
           + (select count(*) from "Item" where slug like $1)::int
           + (select count(*) from "Location" where slug like $2)::int
           + (select count(*) from "Profession" where slug like $3)::int as n`,
      [itemPrefix, locationPrefix, professionPrefix]
    );
    return result.rows[0].n as number;
  });
}

// Defense in depth for every Item helper below, mirroring the Profession
// prefix assertion.
function assertItemPrefixesAreSafe(): void {
  if (
    E2E_ITEM_SLUG_PREFIX.length < 5 ||
    !E2E_ITEM_RELATION_SLUG_PREFIX.startsWith(E2E_ITEM_SLUG_PREFIX)
  ) {
    throw new Error(
      "Refusing prefix-scoped cleanup: the browser-test Item slug prefixes are unsafe."
    );
  }
}

/**
 * Deletes ONLY the browser-test Item rows and the temporary relation rows
 * created for the blocked-deletion tests, in foreign-key-safe order:
 * RecipeIngredient first (rows referencing a relation Recipe or a test
 * Item), then the relation Recipes, then every test Item (the relation
 * prefix is a sub-prefix of the Item prefix, so one delete covers both).
 * A RecipeIngredient row can only match if it points at a test-prefixed
 * Recipe or Item, so seeded ingredient rows can never qualify. Returns how
 * many rows were removed in total; throws loudly on a rejected delete.
 */
export async function deleteE2eTestItemRecords(): Promise<number> {
  assertItemPrefixesAreSafe();

  return withVerifiedDatabase(async (client) => {
    const ingredients = await client.query(
      `delete from "RecipeIngredient"
       where "recipeId" in (select id from "Recipe" where slug like $1)
          or "itemId" in (select id from "Item" where slug like $2)`,
      [`${E2E_ITEM_RELATION_SLUG_PREFIX}%`, `${E2E_ITEM_SLUG_PREFIX}%`]
    );
    const recipes = await client.query(
      `delete from "Recipe" where slug like $1`,
      [`${E2E_ITEM_RELATION_SLUG_PREFIX}%`]
    );
    const items = await client.query(
      `delete from "Item" where slug like $1`,
      [`${E2E_ITEM_SLUG_PREFIX}%`]
    );
    return (
      (ingredients.rowCount ?? 0) +
      (recipes.rowCount ?? 0) +
      (items.rowCount ?? 0)
    );
  });
}

/**
 * Read-only count of leftover browser-test Item rows plus any temporary
 * relation Recipe/RecipeIngredient rows.
 */
export async function countE2eTestItemRecords(): Promise<number> {
  return withVerifiedDatabase(async (client) => {
    const result = await client.query(
      `select
         (select count(*) from "Item" where slug like $1)::int
           + (select count(*) from "Recipe" where slug like $2)::int
           + (select count(*) from "RecipeIngredient"
              where "recipeId" in (select id from "Recipe" where slug like $2)
                 or "itemId" in (select id from "Item" where slug like $1))::int as n`,
      [`${E2E_ITEM_SLUG_PREFIX}%`, `${E2E_ITEM_RELATION_SLUG_PREFIX}%`]
    );
    return result.rows[0].n as number;
  });
}

/**
 * Creates one temporary Recipe whose RESULT is the given browser-test
 * Item, so the produced-result deletion blocker can be exercised. The
 * target Item slug MUST carry the browser-test prefix, so a seeded Item
 * can never be referenced. Recipe admin browser workflows are deliberately
 * not used — they are out of scope for this suite.
 */
export async function createTemporaryRecipeProducingItem(
  itemSlug: string
): Promise<void> {
  assertItemPrefixesAreSafe();

  if (!itemSlug.startsWith(E2E_ITEM_SLUG_PREFIX)) {
    throw new Error(
      "Refusing to link a Recipe: the target Item slug does not carry the browser-test prefix."
    );
  }

  await withVerifiedDatabase(async (client) => {
    const item = await client.query(
      `select id from "Item" where slug = $1`,
      [itemSlug]
    );

    if (item.rowCount !== 1) {
      throw new Error(
        "Cannot create the temporary producing Recipe: the browser-test Item was not found."
      );
    }

    // id has no database default (Prisma cuids are client-generated) and
    // updatedAt has no database default (@updatedAt is client-maintained),
    // so both are supplied explicitly.
    await client.query(
      `insert into "Recipe"
         (id, slug, name, "resultingItemId", "resultingQuantity", "updatedAt")
       values (gen_random_uuid()::text, $1, $2, $3, 1, now())`,
      [
        `${E2E_ITEM_RELATION_SLUG_PREFIX}produces`,
        "Test E2E Item Relation Producing Recipe",
        item.rows[0].id as string,
      ]
    );
  });
}

/**
 * Creates one temporary Recipe whose RESULT is the given browser-test Item,
 * same as `createTemporaryRecipeProducingItem`, but with a Profession and
 * Required level set — proving the Used in Recipes tab renders those
 * optional fields when present (Slice 9B.7 correction). Links an EXISTING
 * seeded Profession by slug rather than creating one, so seeded Profession
 * fixture counts stay untouched.
 */
export async function createTemporaryRecipeProducingItemWithMetadata(
  itemSlug: string,
  professionSlug: string,
  requiredLevel: number
): Promise<void> {
  assertItemPrefixesAreSafe();

  if (!itemSlug.startsWith(E2E_ITEM_SLUG_PREFIX)) {
    throw new Error(
      "Refusing to link a Recipe: the target Item slug does not carry the browser-test prefix."
    );
  }

  await withVerifiedDatabase(async (client) => {
    const item = await client.query(
      `select id from "Item" where slug = $1`,
      [itemSlug]
    );

    if (item.rowCount !== 1) {
      throw new Error(
        "Cannot create the temporary producing Recipe: the browser-test Item was not found."
      );
    }

    const profession = await client.query(
      `select id from "Profession" where slug = $1`,
      [professionSlug]
    );

    if (profession.rowCount !== 1) {
      throw new Error(
        "Cannot create the temporary producing Recipe: the seeded Profession was not found."
      );
    }

    await client.query(
      `insert into "Recipe"
         (id, slug, name, "resultingItemId", "resultingQuantity",
          "professionId", "requiredLevel", "updatedAt")
       values (gen_random_uuid()::text, $1, $2, $3, 1, $4, $5, now())`,
      [
        `${E2E_ITEM_RELATION_SLUG_PREFIX}produces-meta`,
        "Test E2E Item Relation Producing Recipe With Metadata",
        item.rows[0].id as string,
        profession.rows[0].id as string,
        requiredLevel,
      ]
    );
  });
}

/**
 * Creates the minimum temporary rows for the given browser-test Item to be
 * a Recipe INGREDIENT: one helper Item (the recipe's required result), one
 * Recipe, and one RecipeIngredient pointing at the test Item. All created
 * slugs use the relation prefix; the target Item slug MUST carry the
 * browser-test prefix, so a seeded Item can never be referenced.
 */
export async function createTemporaryIngredientReferenceToItem(
  itemSlug: string
): Promise<void> {
  assertItemPrefixesAreSafe();

  if (!itemSlug.startsWith(E2E_ITEM_SLUG_PREFIX)) {
    throw new Error(
      "Refusing to link a RecipeIngredient: the target Item slug does not carry the browser-test prefix."
    );
  }

  await withVerifiedDatabase(async (client) => {
    const item = await client.query(
      `select id from "Item" where slug = $1`,
      [itemSlug]
    );

    if (item.rowCount !== 1) {
      throw new Error(
        "Cannot create the temporary ingredient reference: the browser-test Item was not found."
      );
    }

    const resultItem = await client.query(
      `insert into "Item" (id, slug, name, "updatedAt")
       values (gen_random_uuid()::text, $1, $2, now())
       returning id`,
      [
        `${E2E_ITEM_RELATION_SLUG_PREFIX}result`,
        "Test E2E Item Relation Result Item",
      ]
    );

    const recipe = await client.query(
      `insert into "Recipe"
         (id, slug, name, "resultingItemId", "resultingQuantity", "updatedAt")
       values (gen_random_uuid()::text, $1, $2, $3, 1, now())
       returning id`,
      [
        `${E2E_ITEM_RELATION_SLUG_PREFIX}consumes`,
        "Test E2E Item Relation Consuming Recipe",
        resultItem.rows[0].id as string,
      ]
    );

    await client.query(
      `insert into "RecipeIngredient" (id, "recipeId", "itemId", quantity)
       values (gen_random_uuid()::text, $1, $2, 1)`,
      [recipe.rows[0].id as string, item.rows[0].id as string]
    );
  });
}

/**
 * Removes ONLY the temporary relation rows (RecipeIngredient, then Recipe,
 * then helper Item — foreign-key-safe order), leaving the browser-test
 * Item in place so the deletion flow can be retried through the real UI.
 * Returns how many rows were removed.
 */
export async function removeTemporaryItemRelationRecords(): Promise<number> {
  assertItemPrefixesAreSafe();

  return withVerifiedDatabase(async (client) => {
    const ingredients = await client.query(
      `delete from "RecipeIngredient"
       where "recipeId" in (select id from "Recipe" where slug like $1)`,
      [`${E2E_ITEM_RELATION_SLUG_PREFIX}%`]
    );
    const recipes = await client.query(
      `delete from "Recipe" where slug like $1`,
      [`${E2E_ITEM_RELATION_SLUG_PREFIX}%`]
    );
    const items = await client.query(
      `delete from "Item" where slug like $1`,
      [`${E2E_ITEM_RELATION_SLUG_PREFIX}%`]
    );
    return (
      (ingredients.rowCount ?? 0) +
      (recipes.rowCount ?? 0) +
      (items.rowCount ?? 0)
    );
  });
}

// Defense in depth for every Recipe helper below, mirroring the other
// prefix assertions.
function assertRecipePrefixesAreSafe(): void {
  if (
    E2E_RECIPE_SLUG_PREFIX.length < 5 ||
    !E2E_RECIPE_ITEM_SLUG_PREFIX.startsWith(E2E_RECIPE_SLUG_PREFIX)
  ) {
    throw new Error(
      "Refusing prefix-scoped cleanup: the browser-test Recipe slug prefixes are unsafe."
    );
  }
}

/**
 * Deletes ONLY the browser-test Recipe rows (and any temporary Items under
 * the reserved Recipe-item prefix), in foreign-key-safe order:
 * RecipeIngredient rows belonging to a test Recipe first, then the test
 * Recipes, then any reserved-prefix Items. A RecipeIngredient row can only
 * match through a test-prefixed Recipe, so seeded ingredient rows can
 * never qualify. Returns how many rows were removed in total; throws
 * loudly on a rejected delete.
 */
export async function deleteE2eTestRecipeRecords(): Promise<number> {
  assertRecipePrefixesAreSafe();

  return withVerifiedDatabase(async (client) => {
    const ingredients = await client.query(
      `delete from "RecipeIngredient"
       where "recipeId" in (select id from "Recipe" where slug like $1)`,
      [`${E2E_RECIPE_SLUG_PREFIX}%`]
    );
    const recipes = await client.query(
      `delete from "Recipe" where slug like $1`,
      [`${E2E_RECIPE_SLUG_PREFIX}%`]
    );
    const items = await client.query(
      `delete from "Item" where slug like $1`,
      [`${E2E_RECIPE_ITEM_SLUG_PREFIX}%`]
    );
    return (
      (ingredients.rowCount ?? 0) +
      (recipes.rowCount ?? 0) +
      (items.rowCount ?? 0)
    );
  });
}

/**
 * Read-only count of leftover browser-test Recipe rows, their ingredient
 * rows, and any reserved-prefix Items.
 */
export async function countE2eTestRecipeRecords(): Promise<number> {
  return withVerifiedDatabase(async (client) => {
    const result = await client.query(
      `select
         (select count(*) from "Recipe" where slug like $1)::int
           + (select count(*) from "RecipeIngredient"
              where "recipeId" in (select id from "Recipe" where slug like $1))::int
           + (select count(*) from "Item" where slug like $2)::int as n`,
      [`${E2E_RECIPE_SLUG_PREFIX}%`, `${E2E_RECIPE_ITEM_SLUG_PREFIX}%`]
    );
    return result.rows[0].n as number;
  });
}

/**
 * Creates one temporary Recipe carrying SIX ingredient rows — one more
 * than the edit form's fixed capacity — so the existing capacity guard on
 * the edit page can be exercised. The recipe and its ingredient rows are
 * fully test-prefixed; the six ingredient Items and the resulting Item are
 * seeded fixtures that are only REFERENCED (never modified), and deleting
 * the recipe later cascades only its own ingredient rows. Throws if any
 * expected seeded Item is missing.
 */
export async function createTemporaryRecipeWithSixIngredients(): Promise<void> {
  assertRecipePrefixesAreSafe();

  // Stable seeded fixtures; six distinct ingredients plus one result.
  const ingredientSlugs = [
    "iron-ore",
    "copper-ore",
    "wood",
    "charcoal",
    "herb-leaf",
    "spring-water",
  ];
  const resultSlug = "iron-sword";

  await withVerifiedDatabase(async (client) => {
    const items = await client.query(
      `select id, slug from "Item" where slug = any($1::text[])`,
      [[...ingredientSlugs, resultSlug]]
    );

    if (items.rowCount !== ingredientSlugs.length + 1) {
      throw new Error(
        "Cannot create the six-ingredient Recipe: an expected seeded Item is missing."
      );
    }

    const idBySlug = new Map<string, string>(
      items.rows.map((row) => [row.slug as string, row.id as string])
    );

    // id has no database default (Prisma cuids are client-generated) and
    // updatedAt has no database default (@updatedAt is client-maintained),
    // so both are supplied explicitly.
    const recipe = await client.query(
      `insert into "Recipe"
         (id, slug, name, "resultingItemId", "resultingQuantity", "updatedAt")
       values (gen_random_uuid()::text, $1, $2, $3, 1, now())
       returning id`,
      [
        `${E2E_RECIPE_SLUG_PREFIX}-six-ingredients`,
        "Test E2E Recipe Six Ingredients",
        idBySlug.get(resultSlug) as string,
      ]
    );

    for (const slug of ingredientSlugs) {
      await client.query(
        `insert into "RecipeIngredient" (id, "recipeId", "itemId", quantity)
         values (gen_random_uuid()::text, $1, $2, 1)`,
        [recipe.rows[0].id as string, idBySlug.get(slug) as string]
      );
    }
  });
}

// The Item, Profession, Recipe, and Location image suites share one
// folder-parameterized implementation; the per-entity exports below pin the
// table, folder, and slug prefix together so a call can never mix entities.
// The folder/table values are compile-time literals from this file — never
// runtime input — so interpolating them into SQL identifiers and path
// patterns is safe.
type ImageSuite = {
  folder: "items" | "professions" | "recipes" | "locations";
  table: "Item" | "Profession" | "Recipe" | "Location";
  slugPrefix: string;
  parentPrefix: string;
};

const ITEM_IMAGE_SUITE: ImageSuite = {
  folder: "items",
  table: "Item",
  slugPrefix: E2E_ITEM_IMAGE_SLUG_PREFIX,
  parentPrefix: E2E_ITEM_SLUG_PREFIX,
};

const PROFESSION_IMAGE_SUITE: ImageSuite = {
  folder: "professions",
  table: "Profession",
  slugPrefix: E2E_PROFESSION_IMAGE_SLUG_PREFIX,
  parentPrefix: E2E_PROFESSION_SLUG_PREFIX,
};

const RECIPE_IMAGE_SUITE: ImageSuite = {
  folder: "recipes",
  table: "Recipe",
  slugPrefix: E2E_RECIPE_IMAGE_SLUG_PREFIX,
  parentPrefix: E2E_RECIPE_SLUG_PREFIX,
};

const LOCATION_IMAGE_SUITE: ImageSuite = {
  folder: "locations",
  table: "Location",
  slugPrefix: E2E_LOCATION_IMAGE_SLUG_PREFIX,
  parentPrefix: E2E_LOCATION_SLUG_PREFIX,
};

// Defense in depth for every image helper below.
function assertImageSuitePrefixIsSafe(suite: ImageSuite): void {
  if (
    suite.slugPrefix.length < 5 ||
    !suite.slugPrefix.startsWith(suite.parentPrefix)
  ) {
    throw new Error(
      "Refusing prefix-scoped cleanup: the browser-test image slug prefix is unsafe."
    );
  }
}

// Mirrors the production SAFE_OBJECT_PATH_PATTERN in
// src/lib/storage/images.ts, narrowed to the suite's own folder: exactly
// one generated file name with one controlled extension. Every Storage
// verification or removal below refuses anything else, so a broad or
// unrelated path can never be targeted.
function assertSafeImagePath(suite: ImageSuite, objectPath: string): void {
  const pattern = new RegExp(
    `^${suite.folder}/[a-z0-9-]+\\.(png|jpg|webp)$`
  );
  if (!pattern.test(objectPath)) {
    throw new Error(
      `Refusing a Storage operation: the object path is not a generated ${suite.folder}/ image path.`
    );
  }
}

// Signed-in admin Supabase client for Storage verification/cleanup, always
// signed out afterwards. The helper module runs the fail-closed environment
// guard before any client exists.
async function withStorageAdmin<T>(
  run: (admin: SupabaseClient) => Promise<T>
): Promise<T> {
  const admin = await createSignedInAdminClient();
  try {
    return await run(admin);
  } finally {
    await signOutServiceClient(admin);
  }
}

async function storageObjectExists(
  suite: ImageSuite,
  admin: SupabaseClient,
  objectPath: string
): Promise<boolean> {
  assertSafeImagePath(suite, objectPath);
  const name = objectPath.slice(`${suite.folder}/`.length);
  const { data, error } = await admin.storage
    .from(SERVICE_TEST_BUCKET)
    .list(suite.folder, { limit: 1000, search: name });
  if (error) {
    throw new Error(
      `Could not list the ${suite.folder} folder (status ${
        (error as { statusCode?: string }).statusCode ?? "unknown"
      }).`
    );
  }
  return (data ?? []).some((object) => object.name === name);
}

/**
 * Reads the stored image object path of ONE browser-test row, straight
 * from the database (never from the client). Returns null when the row
 * stores no image; throws when the row does not exist or the slug does not
 * carry the suite's image prefix.
 */
async function readImagePathFor(
  suite: ImageSuite,
  slug: string
): Promise<string | null> {
  assertImageSuitePrefixIsSafe(suite);

  if (!slug.startsWith(suite.slugPrefix)) {
    throw new Error(
      "Refusing to read an image path: the slug does not carry the image-suite prefix."
    );
  }

  return withVerifiedDatabase(async (client) => {
    const result = await client.query(
      `select image from "${suite.table}" where slug = $1`,
      [slug]
    );

    if (result.rowCount !== 1) {
      throw new Error(
        "Cannot read the image path: the browser-test row was not found."
      );
    }

    return (result.rows[0].image as string | null) ?? null;
  });
}

/**
 * Fetches the exact object through its public URL with no authentication
 * and a cache-busting query value. Returns the served content-type when the
 * object is publicly readable, or null when it is not. Never logs the URL.
 */
async function fetchImageContentTypeFor(
  suite: ImageSuite,
  objectPath: string
): Promise<string | null> {
  assertSafeImagePath(suite, objectPath);

  const anonymous = await createAnonymousServiceClient();
  const { data } = anonymous.storage
    .from(SERVICE_TEST_BUCKET)
    .getPublicUrl(objectPath);
  const response = await fetch(`${data.publicUrl}?cb=${crypto.randomUUID()}`);

  if (!response.ok) {
    return null;
  }

  return response.headers.get("content-type");
}

/**
 * Read-only count of ALL objects currently in the suite's folder, for
 * before/after orphan checks. Counting is the only whole-folder operation
 * this module performs — deletion is always by exact recorded path.
 */
async function countFolderObjectsFor(suite: ImageSuite): Promise<number> {
  return withStorageAdmin(async (admin) => {
    const { data, error } = await admin.storage
      .from(SERVICE_TEST_BUCKET)
      .list(suite.folder, { limit: 1000 });
    if (error) {
      throw new Error(
        `Could not list the ${suite.folder} folder (status ${
          (error as { statusCode?: string }).statusCode ?? "unknown"
        }).`
      );
    }
    return (data ?? []).length;
  });
}

/** Read-only count of leftover image-suite rows. */
async function countImageSuiteRecordsFor(suite: ImageSuite): Promise<number> {
  return withVerifiedDatabase(async (client) => {
    const result = await client.query(
      `select count(*)::int as n from "${suite.table}" where slug like $1`,
      [`${suite.slugPrefix}%`]
    );
    return result.rows[0].n as number;
  });
}

/**
 * Deletes ONLY the suite's image rows and their exact recorded Storage
 * objects: first the object paths are read from the matching database rows,
 * each path is validated against the generated-path shape, only those exact
 * objects are removed (never a folder or bucket listing), removal is
 * verified, and finally the rows themselves are deleted. For the Recipe
 * suite, deleting the rows also removes their own RecipeIngredient rows
 * through the database-level ON DELETE CASCADE on
 * RecipeIngredient.recipeId — seeded ingredient rows belong to seeded
 * Recipes and can never match. Returns rows plus objects removed; throws
 * loudly on any failure or leftover.
 */
async function deleteImageSuiteRecordsFor(suite: ImageSuite): Promise<number> {
  assertImageSuitePrefixIsSafe(suite);

  const paths = await withVerifiedDatabase(async (client) => {
    const result = await client.query(
      `select image from "${suite.table}" where slug like $1 and image is not null`,
      [`${suite.slugPrefix}%`]
    );
    return result.rows.map((row) => row.image as string);
  });

  let objectsRemoved = 0;

  if (paths.length > 0) {
    for (const objectPath of paths) {
      assertSafeImagePath(suite, objectPath);
    }

    await withStorageAdmin(async (admin) => {
      const { error } = await admin.storage
        .from(SERVICE_TEST_BUCKET)
        .remove(paths);
      if (error) {
        throw new Error(
          `Storage cleanup could not remove image-suite objects (status ${
            (error as { statusCode?: string }).statusCode ?? "unknown"
          }).`
        );
      }

      for (const objectPath of paths) {
        if (await storageObjectExists(suite, admin, objectPath)) {
          throw new Error(
            "Storage cleanup left an image-suite object behind."
          );
        }
      }
    });

    objectsRemoved = paths.length;
  }

  const rowsRemoved = await withVerifiedDatabase(async (client) => {
    const result = await client.query(
      `delete from "${suite.table}" where slug like $1`,
      [`${suite.slugPrefix}%`]
    );
    return result.rowCount ?? 0;
  });

  return rowsRemoved + objectsRemoved;
}

// --- Item image suite exports (signatures unchanged from Slice 5F) -------

export async function readItemImagePath(slug: string): Promise<string | null> {
  return readImagePathFor(ITEM_IMAGE_SUITE, slug);
}

/** True when the exact generated items/ object currently exists. */
export async function itemImageObjectExists(
  objectPath: string
): Promise<boolean> {
  return withStorageAdmin((admin) =>
    storageObjectExists(ITEM_IMAGE_SUITE, admin, objectPath)
  );
}

export async function fetchItemImageContentType(
  objectPath: string
): Promise<string | null> {
  return fetchImageContentTypeFor(ITEM_IMAGE_SUITE, objectPath);
}

export async function countItemFolderObjects(): Promise<number> {
  return countFolderObjectsFor(ITEM_IMAGE_SUITE);
}

export async function countE2eTestItemImageRecords(): Promise<number> {
  return countImageSuiteRecordsFor(ITEM_IMAGE_SUITE);
}

export async function deleteE2eTestItemImageRecords(): Promise<number> {
  return deleteImageSuiteRecordsFor(ITEM_IMAGE_SUITE);
}

// --- Profession image suite exports --------------------------------------

export async function readProfessionImagePath(
  slug: string
): Promise<string | null> {
  return readImagePathFor(PROFESSION_IMAGE_SUITE, slug);
}

/** True when the exact generated professions/ object currently exists. */
export async function professionImageObjectExists(
  objectPath: string
): Promise<boolean> {
  return withStorageAdmin((admin) =>
    storageObjectExists(PROFESSION_IMAGE_SUITE, admin, objectPath)
  );
}

export async function fetchProfessionImageContentType(
  objectPath: string
): Promise<string | null> {
  return fetchImageContentTypeFor(PROFESSION_IMAGE_SUITE, objectPath);
}

export async function countProfessionFolderObjects(): Promise<number> {
  return countFolderObjectsFor(PROFESSION_IMAGE_SUITE);
}

export async function countE2eTestProfessionImageRecords(): Promise<number> {
  return countImageSuiteRecordsFor(PROFESSION_IMAGE_SUITE);
}

export async function deleteE2eTestProfessionImageRecords(): Promise<number> {
  return deleteImageSuiteRecordsFor(PROFESSION_IMAGE_SUITE);
}

// --- Recipe image suite exports -------------------------------------------

export async function readRecipeImagePath(
  slug: string
): Promise<string | null> {
  return readImagePathFor(RECIPE_IMAGE_SUITE, slug);
}

/** True when the exact generated recipes/ object currently exists. */
export async function recipeImageObjectExists(
  objectPath: string
): Promise<boolean> {
  return withStorageAdmin((admin) =>
    storageObjectExists(RECIPE_IMAGE_SUITE, admin, objectPath)
  );
}

export async function fetchRecipeImageContentType(
  objectPath: string
): Promise<string | null> {
  return fetchImageContentTypeFor(RECIPE_IMAGE_SUITE, objectPath);
}

export async function countRecipeFolderObjects(): Promise<number> {
  return countFolderObjectsFor(RECIPE_IMAGE_SUITE);
}

export async function countE2eTestRecipeImageRecords(): Promise<number> {
  return countImageSuiteRecordsFor(RECIPE_IMAGE_SUITE);
}

/**
 * Read-only count of RecipeIngredient rows belonging to image-suite
 * Recipes. An ingredient row cannot outlive its Recipe (database-level
 * ON DELETE CASCADE), so together with a zero Recipe count this proves no
 * temporary ingredient row remains.
 */
export async function countE2eTestRecipeImageIngredientRows(): Promise<number> {
  assertImageSuitePrefixIsSafe(RECIPE_IMAGE_SUITE);

  return withVerifiedDatabase(async (client) => {
    const result = await client.query(
      `select count(*)::int as n from "RecipeIngredient"
       where "recipeId" in (select id from "Recipe" where slug like $1)`,
      [`${RECIPE_IMAGE_SUITE.slugPrefix}%`]
    );
    return result.rows[0].n as number;
  });
}

export async function deleteE2eTestRecipeImageRecords(): Promise<number> {
  return deleteImageSuiteRecordsFor(RECIPE_IMAGE_SUITE);
}

// --- Location image suite exports ----------------------------------------

export async function readLocationImagePath(
  slug: string
): Promise<string | null> {
  return readImagePathFor(LOCATION_IMAGE_SUITE, slug);
}

/** True when the exact generated locations/ object currently exists. */
export async function locationImageObjectExists(
  objectPath: string
): Promise<boolean> {
  return withStorageAdmin((admin) =>
    storageObjectExists(LOCATION_IMAGE_SUITE, admin, objectPath)
  );
}

export async function fetchLocationImageContentType(
  objectPath: string
): Promise<string | null> {
  return fetchImageContentTypeFor(LOCATION_IMAGE_SUITE, objectPath);
}

export async function countLocationFolderObjects(): Promise<number> {
  return countFolderObjectsFor(LOCATION_IMAGE_SUITE);
}

export async function countE2eTestLocationImageRecords(): Promise<number> {
  return countImageSuiteRecordsFor(LOCATION_IMAGE_SUITE);
}

export async function deleteE2eTestLocationImageRecords(): Promise<number> {
  return deleteImageSuiteRecordsFor(LOCATION_IMAGE_SUITE);
}

// Defense in depth for every Game Version helper below.
function assertGameVersionPrefixesAreSafe(): void {
  if (
    E2E_GAME_VERSION_NAME_PREFIX.length < 5 ||
    E2E_GAME_VERSION_ITEM_SLUG_PREFIX.length < 5 ||
    E2E_CURRENT_GAME_VERSION_NAME.startsWith(E2E_GAME_VERSION_NAME_PREFIX)
  ) {
    throw new Error(
      "Refusing prefix-scoped cleanup: the browser-test Game Version prefixes are unsafe."
    );
  }
}

/**
 * (Re)creates the persistent test-only Game Version fixture and makes it
 * the ONLY current version. Idempotent; called from the authentication
 * setup so every browser run starts from the same deterministic state
 * regardless of what an interrupted earlier run left current.
 */
export async function ensureCurrentGameVersionFixture(): Promise<void> {
  assertGameVersionPrefixesAreSafe();

  await withVerifiedDatabase(async (client) => {
    // id has no database default (Prisma cuids are client-generated) and
    // updatedAt has no database default (@updatedAt is client-maintained),
    // so both are supplied explicitly.
    await client.query(
      `insert into "GameVersion" (id, name, "isCurrent", "createdAt", "updatedAt")
       values (gen_random_uuid()::text, $1, false, now(), now())
       on conflict (name) do nothing`,
      [E2E_CURRENT_GAME_VERSION_NAME]
    );
    await client.query(
      `update "GameVersion" set "isCurrent" = false, "updatedAt" = now()
       where name <> $1 and "isCurrent"`,
      [E2E_CURRENT_GAME_VERSION_NAME]
    );
    await client.query(
      `update "GameVersion" set "isCurrent" = true, "updatedAt" = now()
       where name = $1 and not "isCurrent"`,
      [E2E_CURRENT_GAME_VERSION_NAME]
    );
  });
}

/**
 * Deletes ONLY the browser-test Game Version rows (test-e2e-gv- name
 * prefix) and the temporary stamped Item rows created for the
 * blocked-deletion test, in foreign-key-safe order: the Items first (their
 * verification stamps reference the versions with ON DELETE RESTRICT),
 * then the versions. The persistent fixture ("test-gv-current") does not
 * carry this prefix and is never touched here. Returns how many rows were
 * removed in total; throws loudly on a rejected delete.
 */
export async function deleteE2eTestGameVersionRecords(): Promise<number> {
  assertGameVersionPrefixesAreSafe();

  return withVerifiedDatabase(async (client) => {
    const items = await client.query(
      `delete from "Item" where slug like $1`,
      [`${E2E_GAME_VERSION_ITEM_SLUG_PREFIX}%`]
    );
    const versions = await client.query(
      `delete from "GameVersion" where name like $1`,
      [`${E2E_GAME_VERSION_NAME_PREFIX}%`]
    );
    return (items.rowCount ?? 0) + (versions.rowCount ?? 0);
  });
}

/** Read-only count of leftover browser-test Game Version fixtures. */
export async function countE2eTestGameVersionRecords(): Promise<number> {
  return withVerifiedDatabase(async (client) => {
    const result = await client.query(
      `select
         (select count(*) from "GameVersion" where name like $1)::int
           + (select count(*) from "Item" where slug like $2)::int as n`,
      [
        `${E2E_GAME_VERSION_NAME_PREFIX}%`,
        `${E2E_GAME_VERSION_ITEM_SLUG_PREFIX}%`,
      ]
    );
    return result.rows[0].n as number;
  });
}

/**
 * Creates one bare, NON-current browser-test Game Version so the
 * verification picker's historical-selection flow can be exercised through
 * the real UI. The name MUST carry the browser-test prefix, so cleanup
 * always catches it and the persistent fixture can never be shadowed.
 */
export async function createE2eTestGameVersion(
  versionName: string
): Promise<void> {
  assertGameVersionPrefixesAreSafe();

  if (!versionName.startsWith(E2E_GAME_VERSION_NAME_PREFIX)) {
    throw new Error(
      "Refusing to create a Game Version: the name does not carry the browser-test prefix."
    );
  }

  await withVerifiedDatabase(async (client) => {
    await client.query(
      `insert into "GameVersion" (id, name, "isCurrent", "createdAt", "updatedAt")
       values (gen_random_uuid()::text, $1, false, now(), now())
       on conflict (name) do nothing`,
      [versionName]
    );
  });
}

/**
 * Creates one temporary Item whose verification stamp references the given
 * browser-test Game Version, so the blocked-deletion flow can be exercised
 * through the real UI. The target version name MUST carry the browser-test
 * prefix, so the persistent fixture (or any other version) can never be
 * linked. Item admin browser workflows are deliberately not used — they
 * are out of scope for this suite.
 */
export async function createVerifiedItemReferencingVersion(
  versionName: string
): Promise<void> {
  assertGameVersionPrefixesAreSafe();

  if (!versionName.startsWith(E2E_GAME_VERSION_NAME_PREFIX)) {
    throw new Error(
      "Refusing to link a verified Item: the target Game Version name does not carry the browser-test prefix."
    );
  }

  await withVerifiedDatabase(async (client) => {
    const version = await client.query(
      `select id from "GameVersion" where name = $1`,
      [versionName]
    );

    if (version.rowCount !== 1) {
      throw new Error(
        "Cannot create the verified Item: the browser-test Game Version was not found."
      );
    }

    await client.query(
      `insert into "Item" (id, slug, name, "verifiedAt", "verifiedGameVersionId", "updatedAt")
       values (gen_random_uuid()::text, $1, $2, now(), $3, now())`,
      [
        `${E2E_GAME_VERSION_ITEM_SLUG_PREFIX}-referencing`,
        "Test E2E GV Referencing Item",
        version.rows[0].id as string,
      ]
    );
  });
}

/**
 * Removes ONLY the temporary stamped Item rows, leaving the browser-test
 * Game Version in place so the deletion flow can be retried through the
 * real UI. Returns how many rows were removed.
 */
export async function removeVerifiedItemsReferencingVersions(): Promise<number> {
  assertGameVersionPrefixesAreSafe();

  return withVerifiedDatabase(async (client) => {
    const items = await client.query(
      `delete from "Item" where slug like $1`,
      [`${E2E_GAME_VERSION_ITEM_SLUG_PREFIX}%`]
    );
    return items.rowCount ?? 0;
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
