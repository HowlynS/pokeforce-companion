-- Backfill the singleton for deployments created before access settings were
-- read at runtime. ON CONFLICT preserves an Owner's already-selected mode.
INSERT INTO "SiteAccessSettings" ("id", "visibility", "createdAt", "updatedAt")
VALUES ('site', 'PRIVATE_BETA', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
