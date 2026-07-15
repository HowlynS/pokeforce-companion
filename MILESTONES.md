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

Status: Complete

Goal:

Add image upload and storage for items, recipes, and professions.

### Completed

- [x] Supabase Storage bucket `game-images`: publicly readable, 5 MB limit, PNG/JPEG/WebP MIME restrictions
- [x] Admin-only storage policies (SELECT, INSERT, UPDATE, DELETE) scoped to `bucket_id = 'game-images'`, the exact admin Auth UUID, and the `authenticated` role
- [x] No service-role key introduced; storage writes run as the authenticated admin session
- [x] `Recipe.image String?` added via additive migration `20260713171320_add_recipe_image` (Item and Profession already had `image`)
- [x] Database image fields store Storage object paths, never full public URLs
- [x] Shared server-only storage utilities (`src/lib/storage/images.ts`): validation, upload, public-URL derivation, guarded deletion
- [x] Server-side validation: PNG, JPEG, and WebP only; 5 MB maximum; SVG rejected; empty file inputs treated as no upload
- [x] Server-generated UUID object names under `items/`, `professions/`, `recipes/`; client filenames never trusted; `upsert: false`; a new unique path for every upload
- [x] Server Action body limit raised to 6 MB to allow multipart overhead around the 5 MB file limit
- [x] Item, Profession, and Recipe admin image handling: optional upload on create, current-image preview on edit, replacement, removal via an accessible red × control, unchanged-image behavior, and replacement + removal conflict rejection
- [x] Every image-mutating action repeats `requireAdminUser()`; no client-supplied path ever targets a storage operation
- [x] New uploads cleaned up best-effort when database writes fail; old files deleted only after database success; readable cleanup warnings on failure
- [x] Record-deletion cleanup for all three resources: database-first deletion, then best-effort image removal; relation blockers and the RecipeIngredient cascade preserved
- [x] Recipe create/edit atomicity (nested create and `$transaction`) preserved with the image field included
- [x] Public browsing cards (96 × 96) and detail pages (160 × 160) display images through the shared `ContentImage` component with `object-fit: contain`, no cropping or distortion
- [x] Smooth browser rendering by default (universal pixelated rendering removed); consistent "No image available" fallbacks sized identically to the image canvases
- [x] `next.config.ts` restricts remote images to the Supabase host's public `game-images` path only
- [x] No raw Storage or Prisma errors exposed; readable error and success messages throughout
- [x] Categories excluded from image support by design
- [x] `pnpm prisma validate` passed
- [x] `pnpm lint` passed
- [x] `pnpm build` passed
- [x] `git diff --check` passed
- [x] Full local browser verification passed for all three resources, including replacement, removal, blocked deletions, and deletion cleanup

### Deferred to later milestones

- Per-image Smooth / Pixel art rendering option — deferred until the approved real asset set is known
- Real game assets and descriptions — pending explicit permission from the game owner; test assets and placeholders are in use

---

## Milestone 7 - Search and Polish

Status: In progress

Goal:

Add basic search, improve navigation, and polish the user experience.

### Completed - Automated Testing Foundation

- [x] Vitest unit tests for the validation parsers, image validation and object-path logic, and shared Prisma error guards (service-free; no environment, database, or browser)
- [x] Guarded Prisma database integration tests (foundation, relations, cascades, error codes, transactions)
- [x] Supabase Auth/Storage service tests (anon key only, in-memory sessions, boolean-only assertions)
- [x] Playwright Chromium E2E tests: public browsing, navigation journeys, error/protection behavior, and authenticated admin flows
- [x] Isolated Supabase test project with applied migrations, deterministic seed, one manually created test admin, and admin-scoped Storage policies
- [x] Fail-closed `.env.test.local` environment guard runs before any test client or destructive command can touch a database or bucket
- [x] Deterministic prefix-scoped cleanup and seeded-fixture preservation checks in every destructive suite; Storage deletions target only exact database-recorded object paths
- [x] Authenticated admin CRUD coverage: Categories, Professions, Items, Recipes
- [x] Image workflow coverage (create/render/replace/remove/reject/delete): Items, Professions, Recipes
- [x] Verified totals: 189 unit / 26 integration / 9 service / 70 E2E — 294 automated tests
- [x] Supabase Security Advisor "RLS Disabled in Public" warnings resolved by disabling the Data API in both the main and test projects (see DECISIONS.md 2026-07-15); the Advisor reports no security errors, and full post-change verification passed

The foundation protects current behavior; future features still need their own tests as they are built.

### Remaining

- [ ] Search
- [ ] Instant duplicate-name feedback while typing (postponed from Milestone 5; only if still desired)
- [ ] Functional/UX polish
- [ ] Visual review and polish

Search and Polish work has not started yet.

### Deferred product requirements (recorded, not part of the testing foundation)

- Exact Item field `Held item` with Yes/No
- Item locations
- Game-build verification metadata
- Update metadata
- Changelog/contributor tracking

---

## Milestone 8 - Deployment

Status: Not started

Goal:

Deploy the first usable version to Vercel.
