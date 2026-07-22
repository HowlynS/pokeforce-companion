-- Recipe output quantity range: replaces the single `resultingQuantity`
-- column with `resultQuantityMin`/`resultQuantityMax`, so a Recipe can
-- express either a fixed output (min == max) or a variable range
-- (e.g. 1-4). This migration was written by hand (not applied from the
-- auto-generated diff) because the generated SQL would have dropped
-- `resultingQuantity` before every existing Recipe's value had been
-- carried into both new columns. The order below preserves every
-- existing Recipe's own quantity:
--   1. add the two new columns, nullable at first;
--   2. copy the legacy value into BOTH new columns for every Recipe
--      (old 1 -> min 1, max 1; old 3 -> min 3, max 3 — every existing
--      Recipe becomes a fixed-output recipe, exactly matching its prior
--      single-quantity meaning);
--   3. VERIFY (fail the whole migration if any row was not backfilled)
--      — no existing Recipe's quantity is ever silently dropped;
--   4. only then enforce NOT NULL + DEFAULT 1 on both new columns;
--   5. only then drop the legacy column.

-- 1. Add the new columns; the legacy resultingQuantity column stays in
--    place until the data has been carried over and verified.
ALTER TABLE "Recipe" ADD COLUMN "resultQuantityMin" INTEGER;
ALTER TABLE "Recipe" ADD COLUMN "resultQuantityMax" INTEGER;

-- 2. Every existing Recipe's single quantity becomes both its own
--    minimum and maximum — a fixed-output recipe, matching its prior
--    meaning exactly.
UPDATE "Recipe"
SET "resultQuantityMin" = "resultingQuantity",
    "resultQuantityMax" = "resultingQuantity";

-- 3. Fail closed: if any row was somehow not backfilled, abort the whole
--    migration (it runs in a transaction) instead of dropping data.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM "Recipe"
        WHERE "resultQuantityMin" IS NULL OR "resultQuantityMax" IS NULL
    )
    THEN
        RAISE EXCEPTION 'Refusing to drop resultingQuantity: a Recipe was not backfilled into resultQuantityMin/resultQuantityMax.';
    END IF;
END
$$;

-- 4. Only now are the new columns required, matching the schema's
--    @default(1) on both fields.
ALTER TABLE "Recipe" ALTER COLUMN "resultQuantityMin" SET NOT NULL;
ALTER TABLE "Recipe" ALTER COLUMN "resultQuantityMin" SET DEFAULT 1;
ALTER TABLE "Recipe" ALTER COLUMN "resultQuantityMax" SET NOT NULL;
ALTER TABLE "Recipe" ALTER COLUMN "resultQuantityMax" SET DEFAULT 1;

-- 5. Only now is the legacy column safe to drop.
ALTER TABLE "Recipe" DROP COLUMN "resultingQuantity";
