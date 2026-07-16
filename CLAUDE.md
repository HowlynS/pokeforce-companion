# CLAUDE.md - PokeForce Companion

You are assisting with PokeForce Companion.

## Mandatory Source of Truth

Before making or suggesting changes, respect these documents:

1. PokeForce Companion Project Brief
2. PokeForce Companion Technical Brief
3. AI_RULES.md
4. Current milestone instructions from ChatGPT

## Current Phase

Milestone 7 - Search and Polish is complete (see MILESTONES.md): global search, instant duplicate-name feedback, the Automated Testing Foundation, and the public and admin visual polish passes are all done and verified.

The Automated Testing Foundation totals remain 189 unit / 26 integration / 9 service / 70 E2E — 294 automated tests, backed by an isolated Supabase test project and a fail-closed `.env.test.local` guard.

The Supabase security warning is resolved: the Data API is disabled on both projects, and Prisma over direct PostgreSQL remains the only game-data access layer (see DECISIONS.md 2026-07-15).

Milestone 8 - Deployment has not started — do not begin it until explicitly instructed in the milestone conversation.

## Test Commands

- `pnpm test:unit`
- `pnpm test:env:check`
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
