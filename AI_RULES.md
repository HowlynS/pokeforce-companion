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

Slice 9B.2 (shared admin editor primitives) is complete: resource-agnostic editor header, tabs, context/image/verification/timestamps panels, and sticky actions exist in `src/components/admin/` — no resource page adopts them yet. Items will be the first reference workspace. Game Version behavior is unchanged.

Slice 9B.3 (shared searchable record-list foundation) is complete: the resource-agnostic `RecordList` and `RecordListPagination` components exist with URL-driven search and caller-owned filtering — no production route adopts them yet. Items remains the first reference workspace.

Slice 9B.4 (Item workspace adoption) is complete: `/admin/items` is the searchable record-list landing, `/admin/items/new` the dedicated creation route, and Item edit/delete render inside the workspace with URL-driven (`?q=`) server-rendered search and quick switching. Item forms, CRUD actions, images, and verification behavior are unchanged; the full Item editor redesign (tabs/panels/sticky actions) is still pending.

Slice 9B.5 (Item General editor) is complete: `/admin/items/new` and `/admin/items/[slug]/edit` now compose the shared editor primitives — `EditorHeader` (one h1: "Create item" or the item's own name), `EditorTabs` (General active; on edit, Acquisition Sources/Used in Recipes/Metadata render as inert disabled placeholders, never links to empty pages; on create, only General is shown), `ImagePanel`, `VerificationPanel`, `TimestampsPanel` (edit only), and sticky `EditorActions` ("Create item"/"Save item", Cancel, and on edit a "Delete item" link to the existing confirmation route). Every Item field, redirect, server action, image behavior, verification rule, and name-availability check is unchanged — only the presentation moved. Acquisition Sources tab content, Used in Recipes tab content, and Metadata tab content beyond `TimestampsPanel` remain unimplemented. No other resource workspace was converted.

Slice 9B.6 (Acquisition Sources tab integration) is complete: Acquisition Sources is now a real, working tab in the Item workspace (`itemEditorTabs` in `src/lib/admin/item-workspace.ts` builds the shared tab strip for every Item route). The former "Manage acquisition sources" header action is gone. The existing routes (`/admin/items/[slug]/sources` and its `[sourceId]/edit`/`delete` children) are unchanged and now render inside `ItemWorkspace` with the tab strip, the record list, and (on the source edit page) a `VerificationPanel` aside. Quick switching between items while on the Acquisition Sources tab opens the next item's Acquisition Sources tab, not General, via a new `recordHref` prop on `ItemWorkspace`. Every source CRUD action, ownership/tampering protection, and verification rule is unchanged. Used in Recipes and Metadata tab content remain unimplemented.

Slice 9B.7 (Used in Recipes tab) is complete: `/admin/items/[slug]/recipes` is a real, read-only Item tab showing every Recipe relationship for the selected Item — "Used as an ingredient in" and "Produced by," never conflated, each row linking to the existing Recipe admin edit route with no inline editing. `itemEditorTabs` now marks Used in Recipes active on this route; only Metadata remains a disabled placeholder. Quick switching between items while on this tab opens the next item's Used in Recipes tab via the same `recordHref` mechanism from Slice 9B.6.

The rest of Slice 9B.5/9B.6/9B.7 (Metadata tab content beyond `TimestampsPanel`), every other resource workspace conversion, dashboard summaries, and Route Hubs remain unstarted. Deployment — previously listed as Milestone 8 — is a later milestone, is not complete, and has not started.

Do not begin Metadata tab content, any other resource workspace, Route Hubs, or Deployment until explicitly instructed in the milestone conversation.

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
