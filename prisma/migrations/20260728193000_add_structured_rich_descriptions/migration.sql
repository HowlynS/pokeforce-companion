-- Add a versioned structured-description source while preserving the existing
-- plain description as a lossless compatibility/search projection. Rollback
-- can drop only these new columns; no legacy value is changed or removed.
ALTER TABLE "GameVersion" ADD COLUMN "descriptionRich" JSONB;
ALTER TABLE "Category" ADD COLUMN "descriptionRich" JSONB;
ALTER TABLE "Item" ADD COLUMN "descriptionRich" JSONB;
ALTER TABLE "Profession" ADD COLUMN "descriptionRich" JSONB;
ALTER TABLE "PlayerClass" ADD COLUMN "descriptionRich" JSONB;
ALTER TABLE "Location" ADD COLUMN "descriptionRich" JSONB;
ALTER TABLE "Currency" ADD COLUMN "descriptionRich" JSONB;
ALTER TABLE "Shop" ADD COLUMN "descriptionRich" JSONB;

-- Convert each non-empty legacy description into deterministic paragraph
-- nodes. Splitting with ordinality preserves line order and blank lines.
DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'GameVersion',
    'Category',
    'Item',
    'Profession',
    'PlayerClass',
    'Location',
    'Currency',
    'Shop'
  ]
  LOOP
    EXECUTE format(
      $migration$
        UPDATE %I
        SET "descriptionRich" = jsonb_build_object(
          'version', 1,
          'doc', jsonb_build_object(
            'type', 'doc',
            'content', (
              SELECT jsonb_agg(
                CASE
                  WHEN line = '' THEN jsonb_build_object('type', 'paragraph')
                  ELSE jsonb_build_object(
                    'type', 'paragraph',
                    'content', jsonb_build_array(
                      jsonb_build_object('type', 'text', 'text', line)
                    )
                  )
                END
                ORDER BY ordinal
              )
              FROM regexp_split_to_table(
                replace("description", E'\r\n', E'\n'),
                E'\n'
              ) WITH ORDINALITY AS lines(line, ordinal)
            )
          )
        )
        WHERE "description" IS NOT NULL
          AND btrim("description") <> ''
          AND "descriptionRich" IS NULL
      $migration$,
      table_name
    );
  END LOOP;
END
$$;
