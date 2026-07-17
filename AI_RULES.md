# PokeForce Companion - AI Rules

## Source of Truth

The source of truth for this project is:

1. PokeForce Companion Project Brief
2. PokeForce Companion Technical Brief
3. Current milestone instructions from ChatGPT

AI tools must not invent features, architecture, database tables, or design systems outside the confirmed scope.

## Current Scope

The current phase is:

Milestone 9 - Admin Workspace & Game Version Management is in progress. Slice 9A (Game Version foundation) is complete (see MILESTONES.md and DECISIONS.md 2026-07-17): the database-backed GameVersion model with at most one current version (advisory-lock-serialized service transactions); relational verification (`verifiedGameVersionId`, ON DELETE RESTRICT) on Item, Location, AcquisitionSource, Recipe, and Profession (Categories deliberately have none); verification against a selected Game Version — the shared picker on every verification form submits a server-validated id, historical versions are valid selections, and a blank selection falls back to the current version; the retirement of the CURRENT_GAME_BUILD_ID environment variable; and admin-only Game Version management as a secondary settings destination (`/admin/settings/game-versions`) — never in primary navigation, never public.

Terminology: the contributor-facing term is "Game Version" everywhere. Never display "Build" in the UI.

Slice 9B.1 (shared admin shell and persistent navigation) is complete: every admin route renders inside the shared `AdminShell` with exactly six primary sidebar destinations (Dashboard, Items, Recipes, Professions, Categories, Locations). Game Versions remain a secondary settings destination; Acquisition Sources remain contextual under their owning item. Resource workspace conversion is still pending.

Slice 9B.2 and later Milestone 9 work have not started. Route Hubs remain deferred and unstarted. Deployment — previously listed as Milestone 8 — is a later milestone, is not complete, and has not started.

Do not begin Slice 9B.2+, Route Hubs, or Deployment until explicitly instructed in the milestone conversation.

## AI Workflow Rules

- Do not move ahead without user verification.
- Do not create files unless the current step asks for them.
- Do not install packages unless the current step asks for them.
- Do not refactor unrelated files.
- Do not introduce authentication, database, deployment, or admin features before their milestone.
- Prefer small, reviewable changes.
- Explain commands before running them.
- After changes, always check:
  - `git status`
  - relevant version or test command
- Commit only when the step asks for a commit.

## Technical Defaults

Use the technical brief as source of truth.

Expected stack:

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase
- Prisma
- Vercel
- GitHub
- pnpm

## Human Confirmation

Every setup step must be verified before moving to the next one.
