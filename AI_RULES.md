# PokeForce Companion - AI Rules

## Source of Truth

The source of truth for this project is:

1. PokeForce Companion Project Brief
2. PokeForce Companion Technical Brief
3. Current milestone instructions from ChatGPT

AI tools must not invent features, architecture, database tables, or design systems outside the confirmed scope.

## Current Scope

The current phase is:

Milestone 8 - Gameplay Data Expansion is complete (see MILESTONES.md and DECISIONS.md 2026-07-16).

Milestone numbering was resolved: Gameplay Data Expansion is Milestone 8. Deployment — previously listed as Milestone 8 — is a later milestone, is not complete, and has not started. Milestone 9 route-hub work remains deferred.

Do not begin Deployment or Milestone 9 work until explicitly instructed in the milestone conversation.

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
