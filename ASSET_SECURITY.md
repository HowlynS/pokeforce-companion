# Asset security

## Exposure model

The application has two intentionally public asset surfaces. Neither is an
access-control boundary, even while Site visibility is `PRIVATE_BETA`:

- files under `public/` are served directly by the web host;
- objects in the Supabase `game-images` bucket have stable public URLs.

Authentication, the private-site gate, obscure filenames, and an unlinked URL
do not make either surface private. Never place NDA material, private-beta
documents, personal data, credentials, exports, moderation evidence, or other
confidential content in either location.

## Audited inventory

The repository currently contains only these static public assets:

- `public/images/admin/admin-shell-background.webp` — public admin wallpaper;
- `public/images/backgrounds/merchants-codex-coastal-overlook.png` — public site wallpaper;
- `public/images/branding/merchants-codex-logo.png` — public branding.

The `game-images` bucket is used only for display-ready gameplay images and
published appearance assets. Database rows store bucket-relative object paths,
not service credentials or signed URLs.

## Upload guardrails

Server upload helpers enforce MIME type, byte size, generated immutable names,
and an explicit runtime folder allowlist. The public gameplay folders are:
`items`, `recipes`, `professions`, `locations`, `categories`, `currencies`,
`shops`, and `player-classes`. The public appearance kinds are logo, favicon,
and the four published wallpaper variants.

Unknown folders and kinds are rejected at runtime even if a caller bypasses
TypeScript. Delete operations accept only the same generated path shapes.
Upload actions must authorize the current application user before calling a
storage helper. Do not accept a bucket name, object folder, public URL, or
delete target from browser input.

## Confidential assets

No current feature needs confidential object storage, so this milestone does
not create an unused private bucket or signing endpoint. If a future feature
does need private assets, implement it as a separate security change before
uploading any files:

1. create a non-public bucket with deny-by-default policies;
2. use a dedicated server-only module and folder allowlist;
3. authorize the active, non-disabled application user before every read;
4. return short-lived signed URLs only after authorization;
5. never persist signed URLs in Prisma, audit metadata, logs, screenshots, or
   capture manifests;
6. test expiry, cross-user denial, disabled-user denial, and direct anonymous
   fetch denial.

Changing Site visibility to `PUBLIC` does not require a storage migration:
current assets are already classified as public. Changing it back to
`PRIVATE_BETA` does not retract previously published asset URLs.
