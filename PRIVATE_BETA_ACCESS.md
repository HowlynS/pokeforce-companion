# Private beta access operations

This document is the operational source of truth for whole-site private-beta
access, manual account administration, roles, Site visibility, and audit
history. `PUBLIC_REDESIGN_INTEGRATION.md` remains the separate authoritative
public-redesign dossier.

## Ownership boundaries

- Supabase Auth owns identities, password hashes, password changes, sessions,
  account bans, and authentication tokens.
- Prisma `AppUser` owns application role, active/disabled status, display
  name, creator relationship, and last-known sign-in time.
- Prisma `SiteAccessSettings` owns the singleton database visibility mode.
- Prisma `AuditEvent` owns append-only administrative history and actor
  snapshots.
- There is no signup, invitation, approval, access-request, NDA, pending, or
  account-deletion workflow.

Passwords, tokens, cookies, service credentials, raw Auth payloads, uploaded
bytes, rich-text bodies, and signed URLs must never enter Prisma or audit
metadata.

## Roles and capabilities

| Capability | Member | Contributor | Administrator | Owner |
| --- | :---: | :---: | :---: | :---: |
| Browse while Private beta | Yes | Yes | Yes | Yes |
| Open Admin | No | Yes | Yes | Yes |
| Create/edit gameplay content and images | No | Yes | Yes | Yes |
| Delete or verify gameplay content | No | No | Yes | Yes |
| Manage Game Versions and Appearance | No | No | Yes | Yes |
| Open Design Review and Audit log | No | No | Yes | Yes |
| Manage Members and Contributors | No | No | Yes | Yes |
| Manage Administrators | No | No | No | Yes |
| Manage Owners or change Site visibility | No | No | No | Yes |

Every route and mutation rechecks the current active application user on the
server. Navigation filtering is convenience only, never authorization.
Contributor verification requests are rejected server-side. Administrators
cannot create, promote, demote, disable, or reset an Owner. The final active
Owner cannot be demoted or disabled; advisory-lock transactions make the
invariant safe under concurrent requests.

## Owner bootstrap

`ADMIN_EMAIL` names the initial Owner. When that exact authenticated email has
no application row, the server creates or reconciles one Owner under a
database advisory lock. The operation is idempotent, race-safe, and audited.
It never provisions a different authenticated email. After bootstrap, normal
role and status policy remains authoritative for every other account.

## Manual account workflow

Owners and Administrators use `/admin/users` to create approved accounts.
The server:

1. rechecks the actor and requested role;
2. creates the Supabase Auth user with a temporary password;
3. creates the matching `AppUser` row;
4. removes the Auth user if Prisma creation fails;
5. reports a recovery-required state if compensation also fails;
6. writes audit history only after a valid final state exists.

Share temporary passwords outside this application. They are never displayed
again or stored. Users change their own password at `/account/password`.
Authorized account managers may set a replacement temporary password in
`/admin/users`; only the fact of that reset is audited.

Disable is preferred to delete. Disabling records actor/time, blocks every
subsequent application request even if an old Auth session remains, asks
Supabase to revoke sessions where supported, preserves historical attribution,
and writes an audit event. Re-enable retains the assigned role. Permanent
account deletion is intentionally unsupported.

## Site visibility

The database stores exactly `PRIVATE_BETA` or `PUBLIC`.

- `PRIVATE_BETA`: anonymous ordinary routes redirect to safe login return
  paths; authenticated active Members and higher may browse; sitemap, robots,
  metadata, route handlers, fixtures, and previews do not leak content.
- `PUBLIC`: ordinary reference routes are anonymous; Admin, accounts, Design
  Review, and Audit log remain authenticated and permission-protected.

`FORCE_PRIVATE_BETA=true` has highest precedence and can only force the
effective mode to Private beta. No environment value can force Public. The
database switch therefore needs no deployment, while the environment override
is an emergency brake.

Only an Owner sees and may submit the switch in `/admin/users`. Both directions
require an explicit confirmation checkbox. The service rechecks Owner status
inside an advisory-lock transaction, changes the singleton, and writes the
audit event in the same transaction. It immediately invalidates the root
layout, robots, sitemap, and Users & access caches.

Release-day procedure:

1. confirm `FORCE_PRIVATE_BETA` is absent or false in the deployed environment;
2. sign in as an active Owner and open `/admin/users`;
3. review the effective/stored visibility labels;
4. confirm and switch to Public;
5. verify an anonymous catalogue route, `/robots.txt`, and `/sitemap.xml`;
6. verify Admin still redirects anonymous users and that the audit event exists.

Emergency rollback: set `FORCE_PRIVATE_BETA=true` and redeploy, then diagnose
without changing the stored Public intent. Remove the override only after the
incident is resolved. The UI clearly reports when stored and effective modes
differ.

## Audit history

`/admin/audit-log` is Administrator/Owner-only, newest first, bounded to 25
rows per page, and filterable by search, actor, action, target type, and date.
It shows readable changed fields and safe target links. There are no edit or
delete operations.

Events cover Owner bootstrap; account creation; role changes; disable/
re-enable; administrative password reset; visibility changes; gameplay
create/edit/delete/verification intent; recipe ingredients; shop inventory;
location hierarchy; acquisition sources; Game Versions; and Appearance
publication/reset/asset intent. Prisma-only access and visibility operations
write history in the same transaction where practical. Supabase operations
write only after the final cross-system state is valid.

Metadata is recursively sanitized, depth/array/string bounded, and denies
secret-like, password, token, cookie, signed-URL, file-byte, storage-path,
description, and rich-text keys. Gameplay changes store field names and intent
flags, not submitted values.

## Environment and deployment

Required or access-related variables, without values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `DATABASE_URL`
- `ADMIN_EMAIL`
- `SUPABASE_SERVICE_ROLE_KEY` — server-only; required for manual account
  creation, administrative password reset, and Auth account disable/re-enable
- `FORCE_PRIVATE_BETA` — optional emergency forced-private override
- `SITE_URL`

Never prefix the service-role key with `NEXT_PUBLIC_`, pass it into browser
props, log it, or include it in screenshots/manifests. Deployment must apply
Prisma migrations before enabling the release. Relevant migrations are:

- `20260801190329_add_application_access_roles`
- `20260801193143_add_administrative_audit_history`
- `20260801193230_seed_private_site_access`

The seed migration creates the fail-closed singleton with `ON CONFLICT DO
NOTHING`, preserving an existing operator-selected value. Runtime resolution
also fails closed when the row/database is unavailable.

For local/test Auth administration, populate the service-role key only in the
ignored `.env.test.local` for the isolated test project. The committed template
contains the variable name. If it is absent, missing-service-role behavior can
still be tested safely, but live creation of separate Member/Contributor/
Administrator Auth sessions is unavailable. Never reuse development or
personal credentials for test accounts.

## Storage and redesign tooling

See `ASSET_SECURITY.md` for the public/static inventory and upload policy.
Private mode does not make `public/` or the public `game-images` bucket private.

The deterministic redesign fixture rows remain exact-prefix, test-database
only, idempotent, and cleanup-safe. In Private beta, `pnpm
test:public-design` and `pnpm public:design:capture` authenticate with the
isolated admin storage state before visiting real public fixture routes.
Credentials and session state are Git-ignored and excluded from capture
manifests. Design Review remains Administrator/Owner-only, iframe targets are
registered ordinary routes, and no arbitrary URL proxy exists.
