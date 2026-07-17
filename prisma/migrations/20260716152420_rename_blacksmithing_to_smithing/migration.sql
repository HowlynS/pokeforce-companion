-- Data migration (no schema change): renames the existing seeded
-- "Blacksmithing" Profession row to "Smithing" IN PLACE. Deliberately an
-- UPDATE, not a delete+recreate, so the row's id is preserved and every
-- Recipe.professionId relation pointing at it keeps working unchanged.
-- Safe to run even if the row was already renamed (or never existed):
-- the WHERE clause then matches zero rows.
UPDATE "Profession" SET "name" = 'Smithing', "slug" = 'smithing' WHERE "slug" = 'blacksmithing';
