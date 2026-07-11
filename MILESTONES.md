# PokeForce Companion - Milestones

## Milestone 0 - Preparation

Status: Complete

### Completed

- [x] Source-of-truth briefs saved locally
- [x] Workspace folder created
- [x] VS Code installed and configured
- [x] Node.js and npm installed
- [x] Git installed and configured
- [x] GitHub account ready
- [x] GitHub CLI authenticated
- [x] Supabase account ready
- [x] Vercel account ready
- [x] Claude account ready
- [x] pnpm installed
- [x] Local Git repository initialized
- [x] GitHub repository connected
- [x] AI rules created
- [x] Claude project context created
- [x] Decision log created

### Remaining

- [x] Final Milestone 0 verification
- [x] Confirm readiness for Milestone 1

---

## Milestone 1 - App Foundation

Status: Complete

Goal:

Create the base Next.js application with TypeScript, Tailwind CSS, app structure, and first local run.

### Completed

- [x] Base Next.js application created
- [x] TypeScript configured
- [x] Tailwind CSS configured
- [x] App Router structure created
- [x] `src/` directory structure created
- [x] Dependencies installed with pnpm
- [x] `pnpm lint` passed
- [x] `pnpm build` passed
- [x] First local run verified at `http://localhost:3000`
- [x] Browser displayed `hello world!`

---

## Milestone 2 - Design Foundation

Status: Complete

Goal:

Set up the visual system, layout, navigation, reusable UI components, and basic page structure.

### Completed

- [x] Design tokens created
- [x] App shell created
- [x] Main navigation created
- [x] Reusable page header created
- [x] Reusable card component created
- [x] Reusable content grid created
- [x] Reusable empty state created
- [x] Homepage overview created
- [x] Basic section pages created
- [x] Homepage cards made clickable
- [x] App metadata updated
- [x] Global app styles added
- [x] Responsive header layout improved
- [x] App footer added
- [x] `pnpm lint` passed
- [x] `pnpm build` passed
- [x] Local visual verification passed

---

## Milestone 3 - Data Model

Status: Complete

Goal:

Create the initial database schema for items, recipes, professions, categories, and recipe ingredients.

### Completed

- [x] Prisma configured
- [x] PostgreSQL/Supabase connection working
- [x] Initial schema created for Category, Item, Profession, Recipe, RecipeIngredient
- [x] Initial migration applied
- [x] Seed data created and verified
- [x] Application retrieves and displays relational recipe data on `/recipes`
- [x] Local browser verification passed
- [x] `pnpm prisma validate` passed
- [x] `pnpm lint` passed
- [x] `pnpm build` passed
- [x] Repository clean and pushed through commit `b1bbf80`

---

## Milestone 4 - Content Pages

Status: Complete

Goal:

Build item, recipe, profession, and category pages.

### Completed

- [x] Database-backed `/items` browsing page
- [x] Database-backed `/recipes` browsing page
- [x] Database-backed `/professions` browsing page
- [x] Database-backed `/categories` browsing page
- [x] Dynamic `/items/[slug]` detail pages
- [x] Dynamic `/recipes/[slug]` detail pages
- [x] Dynamic `/professions/[slug]` detail pages
- [x] Dynamic `/categories/[slug]` detail pages
- [x] Relational content displayed from Prisma
- [x] Navigation links between browsing pages, detail pages, and related content
- [x] Deterministic ordering for browsing and relational data
- [x] Empty states where appropriate
- [x] `notFound()` handling for invalid slugs
- [x] `pnpm prisma validate` passed
- [x] `pnpm lint` passed
- [x] `pnpm build` passed
- [x] `git diff --check` passed
- [x] Full local browser verification passed

---

## Milestone 5 - Admin Editing

Status: Complete

Goal:

Create a protected admin interface for editing game data.

### Completed

- [x] Supabase email/password authentication, no public sign-up page
- [x] Admin account created manually in Supabase
- [x] Server-only `ADMIN_EMAIL` authorization check (`requireAdminUser()`)
- [x] `/admin` redirects unauthenticated visitors to `/login`
- [x] Authenticated non-admin emails are denied access
- [x] Next.js proxy (`src/proxy.ts`) refreshes the Supabase session cookie only; not the authorization boundary
- [x] Sign-in and sign-out browser-verified
- [x] Every mutation independently repeats `requireAdminUser()`
- [x] Category admin: list, create, edit, delete
- [x] Profession admin: list, create, edit, delete
- [x] Item admin: list, create, edit, delete, optional Category relation
- [x] Recipe admin: list, create, edit, delete, resulting Item, optional Profession, multiple ingredients
- [x] Case-insensitive duplicate-name protection on Category, Profession, Item, Recipe
- [x] Unique-slug conflict handling (`P2002`) on all four resources
- [x] Stable-ID updates and deletes throughout (never by editable slug)
- [x] Server-side verification of every submitted relation ID (Category, Profession, Item results/ingredients)
- [x] Dedicated server-rendered delete-confirmation pages (no client-side `confirm()`)
- [x] Deletion blocked while Category is linked to Items
- [x] Deletion blocked while Profession is linked to Recipes
- [x] Deletion blocked while Item is referenced by Recipes (as result or ingredient)
- [x] Recipe deletion cascades its own RecipeIngredient rows (confirmed schema `onDelete: Cascade`); resulting Item, ingredient Items, and Profession are preserved
- [x] Atomic Recipe + RecipeIngredient writes on create (nested create) and edit (`$transaction`)
- [x] Relation-aware route revalidation (admin + public + affected relation routes) on every mutation
- [x] `notFound()` handling for missing admin edit/delete routes
- [x] No raw Prisma/database errors rendered anywhere
- [x] Local validation helpers only; no validation package added
- [x] `pnpm prisma validate` passed
- [x] `pnpm lint` passed
- [x] `pnpm build` passed
- [x] `git diff --check` passed
- [x] Full local browser verification passed for every resource and destructive action

### Deferred to later milestones

- Image upload/storage for items, recipes, professions — Milestone 6
- Search and live duplicate-name feedback — Milestone 7
- Final visual redesign / mock-up-based styling — later polish work
- Deployment — Milestone 8

---

## Milestone 6 - Images and Storage

Status: Not started

Goal:

Add image upload and storage for items, recipes, and professions.

---

## Milestone 7 - Search and Polish

Status: Not started

Goal:

Add basic search, improve navigation, and polish the user experience.

---

## Milestone 8 - Deployment

Status: Not started

Goal:

Deploy the first usable version to Vercel.
