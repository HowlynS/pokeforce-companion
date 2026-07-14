# CLAUDE.md - PokeForce Companion

You are assisting with PokeForce Companion.

## Mandatory Source of Truth

Before making or suggesting changes, respect these documents:

1. PokeForce Companion Project Brief
2. PokeForce Companion Technical Brief
3. AI_RULES.md
4. Current milestone instructions from ChatGPT

## Current Phase

Milestone 6 - Images and Storage is complete.

The repository is prepared for Milestone 7 - Search and Polish.

Do not start Milestone 7 work until explicitly instructed in the next milestone conversation.

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
