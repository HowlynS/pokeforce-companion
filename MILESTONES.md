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

Status: Complete

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
- [x] Verified totals at foundation completion: 189 unit / 26 integration / 9 service / 70 E2E — 294 automated tests (grown by the later Milestone 7 slices to 236 unit / 64 integration / 9 service / 103 E2E — 412 automated tests at milestone close)
- [x] Supabase Security Advisor "RLS Disabled in Public" warnings resolved by disabling the Data API in both the main and test projects (see DECISIONS.md 2026-07-15); the Advisor reports no security errors, and full post-change verification passed

The foundation protects current behavior; future features still need their own tests as they are built.

### Completed - Search

- [x] Global search page at `/search`: plain GET form with the query kept in the URL; no client JavaScript required; blank queries never touch the database
- [x] Compact search box in the shared header on every page, kept distinguishable (via aria-label) from the page-level search landmark
- [x] Items, Recipes, Professions, and Categories matched by name or description
- [x] Recipes also matched relationally through their resulting item, profession, or ingredients, with a context line explaining the match (e.g. "Recipe · Ingredient: Iron Ingot")
- [x] Deterministic group order, per-type result caps with a displayed-results summary, and readable start/no-results states
- [x] Covered by dedicated unit tests and guarded integration tests (global search)

### Completed - Instant duplicate-name feedback

- [x] Live Name-availability feedback on the create and edit forms of all four resources through the shared `RecordNameField` (the Item field wraps it unchanged)
- [x] Debounced (300 ms) with a stale-response sequence guard; feedback is announced through a polite `aria-describedby` live region kept outside the label
- [x] Edit forms treat the saved name as "current" and exclude the record's own id server-side
- [x] Failed checks degrade to a non-blocking notice and never disable submission; each resource's server action remains the authoritative duplicate check
- [x] Covered by dedicated unit tests and guarded integration tests (record/item name availability)

### Completed - Public visual polish

- [x] Shared visual foundation: design tokens mirrored as CSS variables, one button system (primary/secondary/danger), header nav pills, interactive-card hover/focus affordances, and a single visible keyboard-focus treatment
- [x] Public list cards show only meaningful metadata — unset optional fields are omitted instead of rendering placeholders such as "Rarity: Unknown", "Category: Uncategorized", "Profession: None", or "Requires: No ingredients"
- [x] Missing images render as a compact muted pill instead of a full-size empty canvas; the visible "No image available" text is preserved
- [x] Item, Recipe, and Profession detail pages use a responsive detail hero (image beside the facts cards on desktop, stacked on narrow screens); the Category detail page follows the same structure without an image (categories store none)
- [x] Relation cards no longer repeat the page's own record name
- [x] `PageHeader` omits a missing description entirely instead of rendering "No description available."
- [x] Verified at ~1280 px and 375 px with no horizontal overflow; the public-details E2E suite passed after each slice

### Completed - Admin visual polish

- [x] Shared admin presentation vocabulary in `globals.css` (toolbar, status banners, record tables, form fields, ingredient rows, delete-confirmation cards) replacing the duplicated inline styling across all thirteen admin pages
- [x] Admin pages carry an "Admin" eyebrow label above the page title (outside the h1, so accessible headings are unchanged); the admin landing uses the shared card grid with a signed-in/sign-out toolbar
- [x] List pages gained a "+ New …" jump link to their create form; admin tables scroll horizontally inside their own container on narrow screens instead of overflowing the page
- [x] Success (role="status") and error (role="alert") messages, all copy, labels, routes, validation, image preview/replacement/removal, and destructive-action behavior unchanged
- [x] Verified at ~1280 px and 375 px; all 66 admin E2E tests passed; lint, build, and `git diff --check` clean

### Closing audit

- [x] Final visual consistency audit across representative public and admin routes at desktop and 375 px: no blockers, no horizontal overflow on any of the 16 route/viewport checks, heading hierarchy and accessibility behavior intact, no stale copy
- Two optional cosmetic follow-ups were noted and deliberately not applied: unifying the `/search` input onto the shared form classes, and a scroll-affordance hint for admin tables on mobile

### Deferred product requirements (recorded, not implemented in Milestone 7)

- Exact Item field `Held item` with Yes/No
- Item locations
- Game-build verification metadata
- Update metadata
- Changelog/contributor tracking

---

## Milestone 8 - Gameplay Data Expansion

Status: Complete

Numbering note: this file previously listed "Milestone 8 - Deployment".
The milestone conversation ran Gameplay Data Expansion as Milestone 8, so
that numbering is now authoritative. Deployment is renumbered to a later
milestone (below); it is **not** complete and has not started.

Goal:

Expand the game-data model with the confirmed gameplay fields: item
acquisition, locations, full profession coverage, and opt-in game-build
verification metadata.

### Completed

- [x] `Item.rarity` removed; exact `Held item` Yes/No field added (required boolean, default No)
- [x] Opt-in gameplay-verification metadata (`verifiedAt` / `verifiedBuildId`) on Item, Location, and AcquisitionSource: stamped only by the explicit "Mark gameplay data as verified for the current build." checkbox using the server-only `CURRENT_GAME_BUILD_ID` (fails loudly when unset); normal edits never touch these fields; shown publicly only when both fields are populated
- [x] Full deterministic profession coverage (ten professions); "Blacksmithing" renamed to "Smithing" in place by a data migration (an `UPDATE`, preserving the row id and every recipe relation)
- [x] Location model with a typed hierarchy (REGION, ROUTE, TOWN, BUILDING, DUNGEON, SUB_AREA, SPECIAL_AREA): parent/child self-relation with `onDelete: Restrict` so a location with children cannot be deleted (children are never silently detached), admin CRUD with image support, and public `/locations/[slug]` detail pages (no public locations index page exists yet — reaching locations by browsing is part of the deferred route-hub work)
- [x] AcquisitionSource model (16 acquisition types): owned by its Item (`onDelete: Cascade` — deleted with it), optional Location/Profession references that survive their target's deletion via `SET NULL`, and a deliberately free-text quantity field
- [x] Admin acquisition-source management nested under the owning item (`/admin/items/[slug]/sources`) with route-ownership enforcement: a source id that does not belong to the item in the URL is treated as missing (404)
- [x] Public "How to obtain" section on item detail pages, grouped by acquisition type, rendered only when the item has at least one source
- [x] Closing audit: public detail pages never render empty optional sections — for a record with zero related entries the entire section (heading and empty state alike) is omitted. Applied to How to obtain, Produced by, Used as an ingredient in, a category's Items, a profession's Recipes, a recipe's Ingredients, and a location's Sub-locations. Top-level collection pages (`/items`, `/recipes`, `/professions`, `/categories`) keep their useful empty states
- [x] Migrations: `20260716074543_refine_item_gameplay_fields`, `20260716152420_rename_blacksmithing_to_smithing`, `20260716160417_add_location_model`, `20260716170040_add_acquisition_sources`
- [x] Verified totals at milestone close: 273 unit / 89 integration / 9 service / 137 E2E — 508 automated tests, plus the passing `pnpm test:env:check` environment guard
- [x] `pnpm lint`, `pnpm build`, and `git diff --check` passed

### Deferred

- Milestone 9 route-hub work remains deferred; do not begin Milestone 9 implementation until explicitly instructed in the milestone conversation

---

## Milestone 9 - Admin Workspace & Game Version Management

Status: In progress — Slice 9A complete (including the minimal Game
Version picker on every verification form); Slices 9B–9E not started

Numbering note: this file previously listed "Milestone 9 - Route Hubs".
The milestone conversation runs Admin Workspace & Game Version Management
as Milestone 9; Route Hubs are renumbered to a later milestone (below) and
remain unstarted.

Goal:

Give admins a database-backed Game Version model as the single source of
truth for gameplay verification, and (in later slices) a shared admin
workspace.

### Slice 9A — Game Version foundation (complete, 2026-07-17)

- [x] `GameVersion` model: cuid id, unique display name, optional release
      date, `isCurrent`, timestamps
- [x] Current-version rules: at most one current, enforced by the service
      transactions in `src/lib/game-versions.ts`, each serialized by a
      shared transaction-scoped PostgreSQL advisory lock
      (`pg_advisory_xact_lock`) so overlapping mark-current or bootstrap
      calls cannot commit two current rows — application-enforced, not
      schema-enforced (Prisma cannot express the partial unique index);
      the first version ever created becomes current automatically;
      marking current safely demotes the previous one; historical versions
      remain selectable; deletion blocked while any verification stamp
      references the version (friendly pre-check backed by database
      `ON DELETE RESTRICT`)
- [x] Verification against a selected Game Version: the server accepts a
      submitted `verifiedGameVersionId`, validates that it names a real
      version, and accepts any existing version — current or historical;
      a nonexistent or tampered id fails the submission
      (`invalid_game_version`) and is never silently replaced. An absent
      or blank selection temporarily falls back to the current version
      for compatibility with the existing forms (which have no picker
      yet), failing clearly (`no_current_version`) when nothing is
      current; `verifiedAt` always comes from the server clock
- [x] Minimal Game Version picker on every verification form (all ten
      create/edit forms across Items, Locations, Acquisition Sources,
      Recipes, and Professions) via the shared
      `GameVersionVerificationControls` component: lists every version
      (current first), defaults to the current version, keeps historical
      versions selectable, shows an explicit unselected placeholder when
      nothing is current (never silently picking a historical version),
      submits the selection as `verifiedGameVersionId`, and shows a clear
      message linking to the Game Versions settings page when no versions
      exist. The checkbox label is "Mark gameplay data as verified for
      the selected game version.", never pre-checked; moving the picker
      without checking the box writes nothing. Compatibility UI inside
      the existing forms — deliberately NOT the Slice 9B workspace
      redesign. The server-side blank-selection fallback to the current
      version remains as documented
- [x] Relational verification: Item, Location, and AcquisitionSource
      migrated from the string `verifiedBuildId` to `verifiedGameVersionId`;
      Recipe and Profession gained `verifiedAt`/`verifiedGameVersionId`;
      Category deliberately remains non-verifiable
- [x] Migration `20260717011230_add_game_version_relational_verification`
      preserves every stamp: one GameVersion per distinct legacy build
      string (name = the exact string, not current), rows linked by name, a
      fail-closed VERIFY before the legacy column drop; the development
      database's one verified row (Item "charcoal", "dev-build-1") kept its
      exact `verifiedAt`
- [x] `CURRENT_GAME_BUILD_ID` retired: `src/lib/game-build.ts` and its unit
      tests deleted after all usages migrated; env examples document the
      retirement
- [x] Admin-only settings destination `/admin/settings/game-versions`
      (list, create, edit, mark current, delete with blocked-deletion
      feedback), linked from a restrained Settings section on the admin
      dashboard — not primary navigation; the contributor-facing term is
      "Game Version" ("Build" never appears in the UI)
- [x] Verification information is admin-only: the public item/location
      verification line was removed; verification status now shows only in
      the admin edit forms
- [x] Guarded test-database migration launcher: `pnpm test:db:migrate`
      (`scripts/migrate-test-database.ts`, fail-closed guard first)
- [x] Test-only placeholder version documented: `test-gv-current` in the
      isolated test database, (re)created and made the only current version
      by the E2E auth setup; integration suites use the `test-gv-` name
      prefix, browser suites the `test-e2e-gv-` prefix
- [x] Tests: game-version validation unit suite; a dedicated game-version
      integration suite (uniqueness, single-current, switching, first-
      current bootstrap, blocked/allowed deletion, relational stamps on all
      five models, Category exclusion, tampered-id rejection, fail-closed
      stamping); migrated verification tests for Item/Location/
      AcquisitionSource; new `admin-game-versions` browser suite; admin
      protection coverage for the settings route

### Remaining (not started)

- [ ] Slices 9B–9E, including the shared admin workspace redesign — do not
      begin until explicitly instructed in the milestone conversation

---

## Route Hubs (renumbered; previously Milestone 9)

Status: Not started (deferred)

Do not begin route-hub work until explicitly instructed in the milestone
conversation.

---

## Deployment (renumbered; previously Milestone 8)

Status: Not started

Goal:

Deploy the first usable version to Vercel.
