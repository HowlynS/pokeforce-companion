# CLAUDE.md - PokeForce Companion

You are assisting with PokeForce Companion.

## Mandatory Source of Truth

Before making or suggesting changes, respect these documents:

1. PokeForce Companion Project Brief
2. PokeForce Companion Technical Brief
3. AI_RULES.md
4. Current milestone instructions from ChatGPT

## Current Phase

Milestone 9 - Admin Workspace & Game Version Management is in progress; Slice 9A (Game Version foundation) is complete (see MILESTONES.md and DECISIONS.md 2026-07-17):

- Database-backed `GameVersion` model (unique name, optional release date, `isCurrent`); at most one version is current, enforced by the service transactions in `src/lib/game-versions.ts`, serialized by a shared `pg_advisory_xact_lock`; the first version ever created becomes current automatically.
- Gameplay verification is relational: `verifiedAt` + `verifiedGameVersionId` (ON DELETE RESTRICT) on Item, Location, AcquisitionSource, Recipe, and Profession. Categories deliberately have no verification. A referenced Game Version cannot be deleted.
- Verification is against a selected Game Version: every verification form carries the shared picker (`GameVersionVerificationControls`, submitting `verifiedGameVersionId`), defaulting to the current version; historical versions are valid selections; the id is validated server-side (tampered ids fail); a blank selection falls back to the current version; `verifiedAt` always comes from the server clock.
- `CURRENT_GAME_BUILD_ID` is retired; the row marked `isCurrent` is the only source of truth. The migration converted the existing `verifiedBuildId` strings into GameVersion rows (name = exact legacy string, not current), preserving every `verifiedAt`.
- Game Version management and ALL verification information are admin-only: a secondary settings destination at `/admin/settings/game-versions` (linked from a restrained Settings section on the admin dashboard — never primary navigation), and public pages never render version or verification text.
- Terminology: the contributor-facing term is "Game Version" everywhere; never display "Build".

Slice 9B.1 (shared admin shell) is complete: the `/admin` layout renders `AdminShell` — a persistent left sidebar (`AdminNav`, exactly six primary destinations: Dashboard, Items, Recipes, Professions, Categories, Locations; active state via `aria-current`, pure mapping in `src/lib/admin/admin-nav.ts`) plus a content area — after the unchanged `requireAdminUser()` gate. Admin pages render only their own content (never the public `AppShell`); `AdminWorkspace` provides the structural header/record-list/main/aside slots later slices fill (only the dashboard composes it so far). Acquisition Sources stay contextual under their owning item; Game Versions stay out of primary navigation.

Slice 9B.2 and later Milestone 9 work (resource workspace conversions, record lists, editor tabs, contextual panels, dashboard summaries) have not started. Route Hubs remain deferred and unstarted. Deployment — previously listed as Milestone 8 — is a later milestone, is not complete, and has not started. Do not begin any of these until explicitly instructed in the milestone conversation.

Milestone 8 - Gameplay Data Expansion is complete (see DECISIONS.md 2026-07-16): rarity removed and the exact `Held item` Yes/No field added; full ten-profession coverage with the in-place Blacksmithing → Smithing rename; the Location hierarchy with restricted deletion; the AcquisitionSource model with the public "How to obtain" section; item/source route-ownership enforcement; and the rule that public detail pages never render empty optional sections.

The automated test stack is backed by an isolated Supabase test project and a fail-closed `.env.test.local` guard. Migrations reach the test project only through the guarded `pnpm test:db:migrate`. The isolated test database carries one documented test-only Game Version fixture, `test-gv-current`, (re)made current by the E2E auth setup.

The Supabase security warning is resolved: the Data API is disabled on both projects, and Prisma over direct PostgreSQL remains the only game-data access layer (see DECISIONS.md 2026-07-15).

## Test Commands

- `pnpm test:unit`
- `pnpm test:env:check`
- `pnpm test:db:migrate` (guarded `prisma migrate deploy` against the isolated test project)
- `pnpm test:integration`
- `pnpm test:service`
- `pnpm test:e2e`

Follow the test execution cadence recorded in DECISIONS.md (2026-07-15): targeted runs during implementation, the relevant suites plus lint/build/diff-check before a checkpoint commit, and the full stack plus the preservation audit before a milestone completion or major push.

## Working Style

- Assume the project owner is a beginner.
- Explain commands before suggesting them.
- Make small, reviewable changes.
- Do not skip setup verification.
- Do not invent scope.
- Do not add packages without explicit approval.
- Do not create database/auth/deployment/admin features before the relevant milestone.
- After each meaningful change, recommend checking:
  - git status
  - relevant version/test command

## PowerShell command style

Run routine Git and verification commands as separate PowerShell tool calls.

Avoid combining unrelated commands with semicolons or pipelines solely to reduce tool calls.

Do not use expandable strings containing variables such as
`"exit:$LASTEXITCODE"` when the command's native exit status is sufficient.

Prefer:

- `git diff --check`
- `git status --short -uall`
- `git log -8 --oneline`
- `git rev-parse HEAD`
- `git rev-parse origin/main`
- `git check-ignore .env.test.local`
- `git ls-files --error-unmatch next-env.d.ts`

as individual commands.

## Expected Stack

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase
- Prisma
- Vercel
- GitHub
- pnpm
