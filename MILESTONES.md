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
Version picker on every verification form); Slice 9B.1 (shared admin
shell and persistent navigation) complete; Slice 9B.2 (shared admin
editor primitives) complete; Slice 9B.3 (shared searchable record-list
foundation) complete; Slice 9B.4 (Item workspace routes, record list,
and quick switching) complete; Slice 9B.5 (Item General editor) complete
for the General tab; Slice 9B.6 (Acquisition Sources tab integration)
complete; Slice 9B.7 (Used in Recipes tab) complete; Slice 9B.8 (Metadata
tab) complete — the Item reference workspace is functionally complete;
Slice 9C.1 (Recipe workspace navigation foundation) complete; Slice 9C.2
(Recipe General editor conversion) complete; Slice 9C.3 (Recipe
Ingredients tab) complete; Slice 9C.4 (Recipe Metadata tab) complete —
the Recipe reference workspace is functionally complete; Slice 9D.1
(Profession workspace navigation foundation) complete; Slice 9D.2
(Profession General editor conversion) complete; Slice 9D.3 (Profession
Recipes relationship tab) complete; Slice 9D.4 (Profession Metadata tab)
complete — the Profession reference workspace is functionally complete;
Slice 9E.1 (Category workspace navigation foundation) complete; Slice
9E.2 (Category General editor conversion) complete; Slice 9E.3 (Category
Items relationship tab) complete; Slice 9E.4 (Category Metadata tab)
complete — the Category reference workspace is functionally complete;
Slice 9F.1 (Location workspace navigation foundation) complete; Slice
9F.2 (Location General editor conversion) complete; Slice 9F.3 (Location
Hierarchy tab) complete; Slice 9F.4 (Location Acquisition Sources tab)
complete; Slice 9F.5 (Location Metadata tab) complete — the Location
reference workspace is functionally complete; later slices not started

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

### Slice 9B.1 — Shared admin shell and persistent navigation (complete, 2026-07-17)

- [x] Shared desktop-first admin shell (`AdminShell`): persistent left
      sidebar plus scrolling content area, rendered ONCE by the `/admin`
      layout after its unchanged `requireAdminUser()` gate — admin pages
      no longer wrap themselves in the public `AppShell`
- [x] Primary sidebar navigation (`AdminNav` over the pure
      `src/lib/admin/admin-nav.ts` module): exactly six destinations —
      Dashboard, Items, Recipes, Professions, Categories, Locations. Game
      Versions deliberately stay a secondary settings destination reached
      from the dashboard; Acquisition Sources stay contextual under their
      owning item; no users/roles/audit/route-hub entries; no collapsed
      mode
- [x] Active-state rule: Dashboard on exactly `/admin`; each resource on
      its list route and every child route (segment-boundary match);
      nothing active on the settings routes. `aria-current="page"` is
      both the accessible marker and the CSS styling hook
- [x] Structural workspace API (`AdminWorkspace`): header region plus
      optional record-list column, primary region, and optional
      contextual aside — slots only, nothing fills the optional ones yet;
      the dashboard is the reference composition
- [x] Shell/workspace CSS vocabulary added to globals.css using the
      existing token variables; content column uses `min-width: 0` so
      wide admin tables keep scrolling inside their wrappers at narrower
      desktop widths (dedicated mobile design remains out of scope)
- [x] Tests: admin-nav unit suite (six destinations, exclusions,
      active-state mapping incl. child routes, boundary and settings
      cases); `admin-shell` browser suite (sidebar contents and targets,
      persistence with active marker across sections, child-route active
      state, settings-inside-shell, no shell on public pages)

### Slice 9B.2 — Shared admin editor primitives (complete, 2026-07-17)

- [x] Resource-agnostic presentational components in
      `src/components/admin/`, following the approved dark admin mockup:
      `EditorHeader` (title h1, optional back link/subtitle/status/
      actions), `EditorTabs` (link-based tabs — route or query-state
      targets, caller-supplied active flag, `aria-current` as both the
      accessible marker and styling hook), `ContextPanel` (bordered
      titled card with optional description/footer), `ImagePanel`
      (structural wrapper giving every upload surface a pointer cursor —
      upload/replace/remove/validation/storage behavior stays in the
      existing controls), `VerificationPanel` (composes the existing
      `GameVersionVerificationControls`; shows current version, verified
      version/date, and an unverified/current/outdated badge classified
      by the pure `src/lib/admin/verification-status.ts`),
      `TimestampsPanel` (stable YYYY-MM-DD created/updated + optional
      verified — no database ids), sticky `EditorActions` (real submit
      button inside the form, cancel link, optional delete LINK to the
      existing confirmation route; opaque bar so fields never hide
      behind it)
- [x] Purple admin editor accent (`--color-admin-accent` /
      `adminAccent`) added deliberately as one token pair for editor
      chrome; `--color-warning` added to keep globals.css and
      design-tokens.ts in sync; public design system untouched
- [x] Component testing extension: `.test.tsx` files render components
      to static markup with `react-dom/server` — Node-only, no DOM
      library added (27 new unit/component tests)
- [x] Loading/empty/error presentation deliberately reuses the existing
      `EmptyState` component and `banner` classes — no new primitives
      needed
- [x] No production adoption yet: no resource page was redesigned or
      touched; Items becomes the first reference workspace in a later
      slice; Game Version verification behavior unchanged

### Slice 9B.3 — Shared searchable record-list foundation (complete, 2026-07-17)

- [x] Resource-agnostic `RecordList` component for `AdminWorkspace`'s
      recordList slot: visible/accessible column label, create-action
      link, URL-driven GET search form (parameter name, value, and
      accessible label caller-configurable; Enter submits; no per-
      keystroke requests), Clear link rendered only while a query is
      applied, optional caller-formatted count line, rows with primary
      label + optional concise secondary context, selected record marked
      with `aria-current="page"` (also the purple styling hook), caller-
      supplied empty state (search stays available so an empty result
      set can be left), optional pagination node. The CALLER owns the
      database query, filtering, and every href — the component never
      builds routes or fetches data
- [x] Minimal `RecordListPagination` primitive: previous/next links with
      caller-preserved search parameters and a caller-formatted page
      context; an omitted direction renders as an `aria-disabled` marker,
      never a fake clickable link; no cursors, page-size controls, or
      total-page arithmetic
- [x] Compact dark list-column styling: restrained separators, purple
      selected state consistent with the editor chrome, sticky column
      with internal row scrolling (`max-height` + `overflow-y: auto`)
- [x] 15 new component tests (static-markup): search value/param/action,
      clear-link presence rules, rows with/without secondary context,
      exactly-one/zero selected rows, create action, empty state,
      enabled/disabled pagination, verbatim preservation of caller URLs
      and query strings, absence of optional count/pagination
- [x] No production adoption: no resource route renders the list yet —
      quick switching arrives with the Items workspace conversion

### Slice 9B.4 — Item workspace routes, record list, quick switching (complete, 2026-07-17)

- [x] Items are the first production workspace adoption. Route structure:
      `/admin/items` (workspace landing: the searchable record list
      beside a restrained guidance state — the embedded create form is
      gone), `/admin/items/new` (the dedicated creation page; the create
      action's error redirects target it, success still returns to the
      list), `/admin/items/[slug]/edit` and `/admin/items/[slug]/delete`
      (existing behavior inside the workspace). The Item URL identifier
      remains the SLUG — consistent with the public site and the nested
      sources routes; database ids never appear in URLs
- [x] `ItemWorkspace` (`src/components/admin/item-workspace.tsx`): the
      thin Item-specific wrapper composing `AdminWorkspace` +
      `RecordList` and owning the Item list query and URL construction
      (pure helpers + unit tests in `src/lib/admin/item-workspace.ts`) —
      deliberately not a generic resource-query framework
- [x] Search: `?q=` URL parameter, trimmed, case-insensitive,
      server-side over name OR slug; `q` preserved across record links,
      the create link, and back/cancel links (action redirects
      deliberately return to the unfiltered list); Clear link while a
      query is active; distinct empty states for "no items" and "no
      matches"; no per-keystroke requests
- [x] Quick switching: record rows link to the edit route; the open
      record (edit or delete) is marked `aria-current`; the category name
      is the row's secondary context
- [x] Delete confirmation is reached from the edit page's toolbar (the
      old table's per-row Edit/Sources/Delete links went with the table;
      sources stay linked from the edit page); the confirmation flow and
      protections are unchanged
- [x] Pagination deliberately deferred: current record counts are small
      and the shared `RecordListPagination` primitive exists ready for
      adoption when a real page-parameter convention is justified
- [x] Preserved unchanged: create/update/delete actions and validation,
      redirects and error handling (create errors now land on the
      creation page), image upload/replace/remove behavior, Game Version
      verification behavior, deletion protections, route ownership, and
      the database schema
- [x] Tests: 7 unit tests for the pure URL/search helpers; reworked Item
      E2E suites (record-list locators, `/admin/items/new` creation
      flows, delete-via-editor) plus a new workspace E2E test covering
      search by name and slug, no-match state, clear, quick switching
      with `q` preserved, and selected-state movement;
      `/admin/items/new` added to the protection spec

### Slice 9B.5 — Item General editor (complete for General, 2026-07-17)

- [x] `/admin/items/new` and `/admin/items/[slug]/edit` are composed from
      the shared editor primitives instead of `PageHeader` and a plain
      form: `EditorHeader` (one h1 — "Create item" on create, the item's
      own name on edit, with slug as subtitle and "Manage acquisition
      sources" as a header action), `EditorTabs` (General active; every
      existing core field lives there unchanged), `ImagePanel`,
      `VerificationPanel`, `TimestampsPanel` (edit only), and sticky
      `EditorActions`
- [x] Tabs: on create, only General is shown (the other sections
      describe relations that cannot exist before the record does); on
      edit, Acquisition Sources/Used in Recipes/Metadata render as inert
      placeholders via a new optional `disabled` field on the shared
      `EditorTab` type — never links to empty pages
- [x] `ImagePanel`/`VerificationPanel` render in the workspace's aside
      column, outside the resource's own `<form>`; their inputs
      associate with the form via the standard HTML `form` attribute (a
      new optional `formId` prop on `VerificationPanel` and
      `GameVersionVerificationControls`) — ordinary HTML submission, no
      client-side mutation code
- [x] The former inline "Gameplay data verified…" sentence is replaced
      by `VerificationPanel`'s shared status badge and Verified
      against/Verified on rows; the remove-current-image toggle's inline
      `<style>` block moved to `globals.css` as shared classes
- [x] Every redirect, server action, validation rule, image behavior,
      verification rule, and name-availability check is unchanged — only
      the presentation moved
- [x] Tests: component coverage for the disabled-tab rendering and the
      `formId` forwarding; the Item E2E suites (lifecycle, images,
      name-feedback, sources, how-to-obtain) updated for the new
      headings, button labels, and verification-panel markup
- [x] Acquisition Sources tab content is implemented in Slice 9B.6
      (below); Used in Recipes tab content and Metadata tab content
      beyond `TimestampsPanel` remain unimplemented

### Slice 9B.6 — Acquisition Sources tab integration (complete, 2026-07-17)

- [x] Acquisition Sources is a real, working tab in the Item workspace,
      replacing the former "Manage acquisition sources" header action
      (removed). Routes are unchanged: `/admin/items/[slug]/sources`
      (list + inline create), `/admin/items/[slug]/sources/[sourceId]/edit`,
      `/admin/items/[slug]/sources/[sourceId]/delete` — all three now
      render inside `ItemWorkspace` with the shared tab strip
- [x] One new function, `itemEditorTabs(slug, query, active)` in
      `src/lib/admin/item-workspace.ts`, builds the tab strip for every
      Item route (General and Acquisition Sources as real links with
      correct hrefs/active state; Used in Recipes/Metadata still
      disabled placeholders) — General's and Sources' tabs can never
      drift out of sync between pages
- [x] `ItemWorkspace` gained an optional `recordHref` prop (default
      `itemEditHref`): the Sources routes pass `itemSourcesHref` so
      quick-switching records while on the Acquisition Sources tab opens
      the NEXT item's Acquisition Sources tab, not its General tab; an
      item with no sources yet still opens a valid empty tab state
- [x] The sources list/create page wraps its existing table and inline
      create form in `ContextPanel`s and upgrades the create form's bare
      picker+checkbox to a full `VerificationPanel` (matching the Item
      create page); the dedicated source edit page moves
      `VerificationPanel` into an aside column via the same `form="<id>"`
      association pattern from Slice 9B.5, and adopts `EditorActions`
      (button text unchanged: "Save Changes"); the source delete page
      mirrors the Item delete page's precedent — no aside, no
      `EditorActions`, unchanged confirm-card
- [x] Every source CRUD action, route-ownership/tampering protection
      (mismatched itemSlug, unknown ids, cross-item edit/delete attempts),
      and verification rule (opt-in checkbox, historical version
      selection, unchecked-edit preservation) is unchanged; `q` is
      preserved through every tab link, record-row link, and back/cancel
      link
- [x] Tests: new pure-function coverage for `itemEditorTabs` and the new
      href helpers; new Acquisition Source E2E coverage for real-tab
      behavior, exactly-one-active-tab, deferred-tab inertness, the
      removed header action, and item switching preserving the
      Acquisition Sources tab and `q`; existing Acquisition Source E2E
      suite updated (not duplicated) for the new navigation
- [x] Used in Recipes tab content is implemented in Slice 9B.7 (below);
      Metadata tab content beyond `TimestampsPanel` remains unimplemented

### Slice 9B.7 — Used in Recipes tab (complete, 2026-07-17)

- [x] `/admin/items/[slug]/recipes` is a new, real, read-only Item tab
      rendering inside `ItemWorkspace` exactly like General/Acquisition
      Sources: the record list stays visible with the current item
      selected, `EditorHeader` shows the item's own name, `EditorTabs`
      marks Used in Recipes active
- [x] `ItemEditorTabKey` gained a `"recipes"` variant and `itemEditorTabs`
      now links Used in Recipes as a real tab (General is active only on
      the edit route, Acquisition Sources only on source routes, Used in
      Recipes only on this new route); Metadata remains the only disabled
      placeholder; exactly one tab is active on every implemented route
- [x] One restrained query (`prisma.item.findUnique` including both
      `recipesProduced` and `recipeIngredients` together with their
      `profession`/`resultingItem` relations) — no N+1 per row
- [x] Content is strictly read-only and navigational: two `ContextPanel`s
      ("Used as an ingredient in" and "Produced by," each with a
      restrained count and its own admin-table, omitted entirely when
      empty) list recipe name (linking to the EXISTING
      `/admin/recipes/[slug]/edit` route), quantity/yield, and resulting
      item name — no separate Profession/Required Level column; a shared
      `RecipeNameCell` renders those two optional fields as a labeled
      detail line beneath the recipe name only when each is populated, so
      sparse recipes emit no placeholder dash, empty label, or blank cell
      — no inline recipe editing, no ingredient mutation, no create-recipe
      form; an item with no relationship in either direction renders a
      single `EmptyState`
- [x] A new `itemUsedInRecipesHref(slug, query)` helper feeds the tab's
      own href and `ItemWorkspace`'s existing `recordHref` prop (no
      component changes needed), so quick-switching items while on this
      tab opens the next item's Used in Recipes tab — not General — with
      `q` preserved, exactly the Slice 9B.6 pattern reused, not a new
      routing framework
- [x] Recipe CRUD, ingredient actions, the Prisma schema, storage, and
      authorization are unchanged; `notFound()` still applies for unknown
      item slugs
- [x] Tests: pure-function coverage for `itemUsedInRecipesHref` and the
      extended `itemEditorTabs`; four new integration tests (ingredient
      usage with quantity/profession/required-level, absent-optional
      handling, an item with no recipe usage, and the schema-enforced
      impossibility of a duplicate ingredient row) in
      `database-relations.integration.test.ts`; a new focused
      `admin-item-recipes.spec.ts` E2E suite (direct tab access, both
      relationship directions rendering, the Recipe edit link, item
      switching preserving the tab and `q`, the empty state, General/
      Acquisition Sources still working from this tab, an unknown item
      slug 404ing) plus the existing Item tab tests in
      `admin-items.spec.ts`/`admin-item-sources.spec.ts` and the
      protection spec updated for the tab no longer being disabled
      (Metadata's own "stays inert" assertion in this suite was updated
      in Slice 9B.8, below, once Metadata became a real tab)

### Slice 9B.8 — Metadata tab (complete, 2026-07-18)

- [x] `/admin/items/[slug]/metadata` is a new, real, read-only Item tab
      rendering inside `ItemWorkspace` exactly like General/Acquisition
      Sources/Used in Recipes: the record list stays visible with the
      current item selected, `EditorHeader` shows the item's own name,
      `EditorTabs` marks Metadata active
- [x] `ItemEditorTabKey` gained a `"metadata"` variant and `itemEditorTabs`
      now links Metadata as a real tab via the new
      `itemMetadataHref(slug, query)` helper — every one of the four Item
      tabs is now a real link; NO Item tab renders as a disabled
      placeholder any more; exactly one tab is active on every route
- [x] `VerificationPanel` gained a `readOnly?: boolean` prop (default
      `false`, so its four existing callers are unaffected) that omits
      the composed `GameVersionVerificationControls` picker/checkbox
      entirely while keeping the status badge and the Verified-against/
      Verified-on/Current-version rows — each still hidden when its own
      data is absent, exactly as before; no server verification logic was
      duplicated
- [x] Content is strictly read-only and administrative: the Metadata tab
      renders `VerificationPanel` (with `readOnly`) and `TimestampsPanel`
      directly as the workspace's main content — no aside, no `<form>`,
      no picker, no checkbox, no submit button, no delete action, no
      image control; neither panel ever shows the record's database id,
      a foreign key, or a storage path; the Item's own slug is already
      visible via the existing header subtitle
- [x] `ItemWorkspace`'s existing `recordHref` prop takes `itemMetadataHref`
      (no component changes needed), so quick-switching items while on
      this tab opens the next item's Metadata tab — not General — with
      `q` preserved, the same mechanism Slice 9B.6/9B.7 established
- [x] Item CRUD, the Prisma schema, storage, and authorization are
      unchanged; `notFound()` still applies for unknown item slugs
- [x] Tests: pure-function coverage for `itemMetadataHref`, the extended
      `itemEditorTabs` (Metadata active state, exactly-one-active across
      all four tabs, and a "no disabled tabs remain" invariant); two new
      `VerificationPanel` component tests for the `readOnly` option
      (omits the picker/checkbox while keeping status/stamp rows, for
      both a verified and an unverified record); a new focused
      `admin-item-metadata.spec.ts` E2E suite (direct tab access, created/
      updated dates, Unverified status with no fabricated rows, current
      Game Version rendering regardless of verification, a verified
      item's Verified-against/Verified-on rows, no form/picker/checkbox/
      submit-button/id/foreign-key/storage-path anywhere in the main
      content region, item switching preserving the tab and `q`, General/
      Acquisition Sources/Used in Recipes still working from this tab, an
      unknown item slug 404ing) plus the existing Item tab tests in
      `admin-items.spec.ts`/`admin-item-sources.spec.ts`/
      `admin-item-recipes.spec.ts` and the protection spec updated for
      the tab no longer being disabled
- [x] The Item reference workspace (General, Acquisition Sources, Used in
      Recipes, Metadata) is now functionally complete

### Slice 9C.1 — Recipe workspace navigation foundation (complete, 2026-07-18)

- [x] Recipes are the SECOND production adoption of the shared
      `AdminWorkspace`/`RecordList` pieces — a new, independent thin
      wrapper, `RecipeWorkspace` (`src/components/admin/recipe-workspace.tsx`),
      over new pure helpers (`src/lib/admin/recipe-workspace.ts`:
      `recipeEditHref`, `recipeDeleteHref`, `normalizeRecipeSearchQuery`,
      `withRecipeSearchQuery`), following the Item workspace's Slice 9B.4
      precedent exactly but sharing no code with it — deliberately NOT a
      generic multi-resource workspace framework
- [x] `/admin/recipes` is the workspace landing state: the searchable
      record list plus restrained guidance, with NO embedded creation
      form; `/admin/recipes/new` is the dedicated creation route the form
      moved to, fields and ingredient rows unchanged; `/admin/recipes/[slug]/edit`
      and `/admin/recipes/[slug]/delete` render inside `RecipeWorkspace`
      with their existing PageHeader/form/confirm-card presentation
      unchanged — no Recipe tabs, no Ingredients split, no
      EditorHeader/ImagePanel/VerificationPanel/TimestampsPanel/sticky
      EditorActions adopted this pass
- [x] The record list shows the recipe name as primary text and the
      resulting item's name as concise secondary context; search matches
      name OR slug (trimmed, case-insensitive, server-rendered `?q=`,
      no live per-keystroke requests), preserved through record links,
      the create link, and Cancel/Delete links; pagination is
      deliberately deferred (small record count, matching the Item
      precedent)
- [x] The edit page's toolbar gained a "Delete Recipe" link (the old
      table's per-row Delete action is gone) placed OUTSIDE the existing
      too-many-ingredients guard, so deletion stays reachable even when
      that guard hides the edit form entirely — a genuine behavior gap
      the navigation move would otherwise have introduced
- [x] Because the create form moved, `createRecipeAction`'s pre-creation
      validation/duplicate-name/relation/verification/image error
      redirects now target `/admin/recipes/new` instead of `/admin/recipes`
      (mirroring exactly how `createItemAction` was changed for Slice
      9B.4); the success redirect and every other action
      (`updateRecipeAction`, `deleteRecipeAction`), the Prisma schema,
      ingredient handling, image storage, and Game Version verification
      are all byte-for-byte unchanged
- [x] Tests: pure-function coverage for the new Recipe URL helpers (`q`
      normalization/preservation, slug-based edit/delete hrefs); the
      existing `admin-recipes.spec.ts`, `admin-recipe-images.spec.ts`, and
      the Recipe case in `admin-name-feedback.spec.ts` updated (not
      duplicated) for the new record-list rows, the moved creation route
      and its shifted error redirects, and the toolbar Delete link; a new
      record-list search/quick-switching/clear test mirroring the Item
      precedent; the protection spec extended with `/admin/recipes/new`;
      the full-suite run for this finalize pass also caught one more
      spec relying on the old embedded creation form —
      `admin-item-how-to-obtain.spec.ts`'s CRAFTING-source test navigated
      to `/admin/recipes` directly to fill the Recipe form — updated to
      navigate to `/admin/recipes/new` instead
- [x] No other resource workspace, dashboard summary, or Route Hub work
      was started; the Recipe editor redesign (tabs, panels, sticky
      actions) remains pending

### Slice 9C.2 — Recipe General editor conversion (complete, 2026-07-18)

- [x] `/admin/recipes/new` and `/admin/recipes/[slug]/edit` now compose
      the shared editor primitives — `EditorHeader` (one h1: "Create
      Recipe" or the recipe's own name, slug as subtitle on edit),
      `EditorTabs` (create shows only General, matching the Item
      precedent; edit adds Ingredients/Metadata as disabled placeholders
      via the new `recipeEditorTabs(slug, query)` helper), `ImagePanel`,
      `VerificationPanel`, `TimestampsPanel` (edit only), and sticky
      `EditorActions` ("Create Recipe"/"Save Changes", Cancel) — mirroring
      the Item General editor's Slice 9B.5 conversion exactly
- [x] Ingredients remain embedded in General's own fields this slice — no
      dedicated Ingredients tab yet; Metadata content remains unimplemented
- [x] Delete is deliberately NOT passed to `EditorActions`' own
      `deleteHref`; it lives in `EditorHeader`'s `actions` slot instead
      (unconditionally rendered, outside the too-many-ingredients guard),
      preserving the exact reachability guarantee Slice 9C.1's toolbar
      link established — confirmed by a dedicated E2E assertion
- [x] That same guard now also withholds `ImagePanel`/`VerificationPanel`
      (their controls submit into the main form, which the guard hides —
      matching the pre-conversion behavior where image and verification
      were part of the single form the alert replaced entirely), while
      `TimestampsPanel` — pure read-only display of already-loaded data —
      still renders regardless
- [x] The Recipe-specific inline `<style>` block for the image
      remove-toggle was deleted in favor of the exact same shared
      `.admin-image-remove-*` classes Item already migrated to in Slice
      9B.5 — verified byte-for-byte equivalent selectors/properties before
      reuse, per the task's explicit condition for doing so
- [x] Every redirect, server action, validation rule, ingredient
      parsing/deduplication/capacity-guard, image behavior, and
      verification rule is byte-for-byte unchanged — only presentation
      moved; no Prisma schema, action, storage, or auth change was made
- [x] Tests: pure-function coverage for the new `recipeEditorTabs` helper
      (General active, Ingredients/Metadata disabled placeholders, query
      preservation, exactly-one-active); `admin-recipes.spec.ts` updated
      for the recipe-name/slug h1/subtitle (replacing the old fixed "Edit
      Recipe" heading) plus two new tests — tab/h1/Timestamps structure
      across create and edit, and a full gameplay-verification lifecycle
      (unverified state, current-version stamp, unchecked edits preserve
      it, historical-version selection) mirroring the Item precedent; the
      too-many-ingredients guard test extended to confirm Image/
      Verification panels are withheld while Timestamps and Delete remain
      visible; `admin-item-recipes.spec.ts` updated for the new edit-page
      h1 (the recipe's own name, not "Edit Recipe")
- [x] No Ingredients tab, no Metadata content, and no other resource
      workspace was converted

### Slice 9C.3 — Recipe Ingredients tab (complete, 2026-07-18)

- [x] `/admin/recipes/[slug]/ingredients` is a new, real, independent
      Recipe tab holding the ingredient rows moved out of General —
      rendering inside `RecipeWorkspace` exactly like General (record list
      visible, current recipe selected, `EditorHeader` with the recipe's
      own name, quick switching via a new `recipeIngredientsHref`
      passed as `RecipeWorkspace`'s `recordHref`); `recipeEditorTabs` now
      takes an `active: "general" | "ingredients"` key (mirroring
      `itemEditorTabs`) so General and Ingredients are both real links on
      both routes, with Metadata still the only disabled placeholder
- [x] General's ingredient `<fieldset>` (five fixed rows, unchanged
      markup) moved unmodified to the new route; General's
      `tooManyIngredients` guard is GONE — General is now always fully
      editable regardless of ingredient count, a deliberate improvement
      over the prior all-or-nothing behavior, since ingredients no longer
      live there. The guard moved to Ingredients only (identical wording,
      adjusted from "the edit form" to "this form"); a Delete Recipe link
      in Ingredients' own `EditorHeader` `actions` slot stays reachable
      there too, exactly like General's
- [x] Ingredients renders no `ImagePanel`/`VerificationPanel`/
      `TimestampsPanel` — none apply to ingredient rows
- [x] `updateRecipeAction` was replaced by two narrow actions in
      `src/app/admin/recipes/actions.ts`: `updateRecipeGeneralAction` (a
      single `prisma.recipe.update()` covering every field except
      ingredients, never touching `RecipeIngredient`) and
      `updateRecipeIngredientsAction` (the same delete-then-recreate
      `prisma.$transaction([deleteMany, createMany])` shape the old
      action used, scoped to `RecipeIngredient` only, plus a
      defense-in-depth capacity re-check so a tampered request can never
      truncate an already-over-capacity recipe down to 5 rows)
- [x] Both actions reuse — never reimplement — validation:
      `src/lib/validation/recipe.ts` extracts a private
      `parseRecipeGeneralFields` helper that the unchanged
      `parseRecipeInput` (still the create page's parser, untouched), the
      new exported `parseRecipeGeneralInput`, and the new exported
      `parseRecipeIngredientsInput` (wrapping the existing private
      `parseIngredientRows`) all share — one implementation of every
      field/row rule, error code, capacity limit, and duplicate-item check
- [x] A normal General save leaves ingredients byte-for-byte untouched; a
      normal Ingredients save leaves name/slug/resulting item/profession/
      required level/image/verification byte-for-byte untouched — proven
      by dedicated integration tests (`database-relations.integration.test.ts`)
      and E2E tests
- [x] The create page and its embedded ingredients are completely
      untouched — ingredients remain embedded there until the record
      exists, matching the Item workspace's established create-page
      precedent
- [x] Tests: pure-function coverage for `recipeIngredientsHref` and the
      extended `recipeEditorTabs` (Ingredients active state,
      exactly-one-active across both keys, Metadata always disabled);
      new `parseRecipeGeneralInput`/`parseRecipeIngredientsInput` unit
      tests proving delegation without re-testing every already-covered
      per-field rule; new integration tests for both actions' exact write
      shapes (General preserves ingredients/image/verification;
      Ingredients preserves name/image/required level/verification;
      rollback safety) replacing the stale combined-transaction tests;
      `admin-recipes.spec.ts` split the old combined edit test into
      separate General-only and Ingredients-only save tests, updated the
      tabs test for both routes, moved the five/six-ingredient prefill and
      capacity-guard checks to Ingredients, added a General-remains-
      editable-for-an-over-capacity-recipe assertion, and added new tests
      for Ingredients-page validation errors and cross-recipe switching
      while on Ingredients; the protection spec extended with
      `/admin/recipes/[slug]/ingredients`
- [x] No Metadata content and no other resource workspace was converted

### Slice 9C.4 — Recipe Metadata tab (complete, 2026-07-18)

- [x] `/admin/recipes/[slug]/metadata` is a new, real, independent Recipe
      tab completing the workspace — rendering inside `RecipeWorkspace`
      exactly like General/Ingredients (record list visible, current
      recipe selected, `EditorHeader` with the recipe's own name, quick
      switching via a new `recipeMetadataHref` passed as
      `RecipeWorkspace`'s `recordHref`); `recipeEditorTabs` now takes an
      `active: "general" | "ingredients" | "metadata"` key and no Recipe
      tab renders as a disabled placeholder any more (mirroring the Item
      workspace's Slice 9B.8 completion)
- [x] Content is strictly read-only: a new "Recipe" `ContextPanel` shows
      the resulting item, the optional Profession and required level
      (each omitted entirely when absent — no placeholder dash, no
      "None"), and the ingredient count; the existing `VerificationPanel`
      `readOnly` mode (introduced in Slice 9B.8, unchanged) shows the
      status badge and stamp rows with no picker/checkbox;
      `TimestampsPanel` shows created/updated/verified dates
- [x] No form, image control, ingredient control, or delete action
      anywhere on the tab; no database id, foreign key, or storage path
      ever surfaces
- [x] One restrained query — `resultingItem`, `profession`,
      `verifiedGameVersion`, and an ingredient `_count` only, never the
      full ingredient row set — plus the same `gameVersion.findMany`
      ordering every other verification surface uses; no N+1 behavior
- [x] Recipe actions, schema, storage, and authorization are unchanged;
      General/Ingredients behavior is unchanged beyond real tab links
- [x] Tests: `recipeMetadataHref` and the extended `recipeEditorTabs`
      unit coverage (Metadata active state, exactly-one-active across all
      three keys, no disabled Recipe tab remains); a new
      `admin-recipe-metadata.spec.ts` E2E suite covering direct
      navigation, Recipe context content and hide-empty behavior,
      verified/unverified status display, Recipe switching with `q`
      preservation, tab navigation, unknown-slug 404, and read-only
      constraints; the existing Recipe tabs E2E test extended for the
      Metadata tab; the protection spec extended with
      `/admin/recipes/[slug]/metadata`
- [x] The Recipe reference workspace (General, Ingredients, Metadata) is
      now functionally complete, matching the Item workspace's shape; no
      other resource workspace was converted

### Slice 9D.1 — Profession workspace navigation foundation (complete, 2026-07-18)

- [x] Professions are the THIRD production adoption of
      `AdminWorkspace`/`RecordList`, via a new, independent thin wrapper —
      `ProfessionWorkspace` (`src/components/admin/profession-workspace.tsx`)
      — over new pure helpers in `src/lib/admin/profession-workspace.ts`
      (`professionEditHref`, `professionDeleteHref`,
      `normalizeProfessionSearchQuery`, `withProfessionSearchQuery`),
      mirroring the Item (Slice 9B.4) and Recipe (Slice 9C.1) workspaces
      exactly but sharing no code with either
- [x] `/admin/professions` is the workspace landing state (searchable
      record list + restrained guidance; the embedded creation form and
      the old admin table are both gone); `/admin/professions/new` is the
      dedicated creation route the form moved to unchanged (same fields —
      name, slug, description, image, `GameVersionVerificationControls`);
      `/admin/professions/[slug]/edit` and `/admin/professions/[slug]/delete`
      render inside `ProfessionWorkspace` otherwise unchanged (same
      PageHeader, same form, same confirm-card)
- [x] EditorHeader/EditorTabs/ImagePanel/VerificationPanel/TimestampsPanel/
      sticky EditorActions are deliberately NOT adopted this pass — only
      the navigation/wrapper moved, matching Slice 9C.1's own restraint
- [x] The edit page's toolbar gained an unconditional "Delete Profession"
      link (replacing the old table's per-row Delete action, mirroring
      Slice 9C.1's toolbar change) — Professions carry no capacity guard,
      so it never needs to be withheld
- [x] The record list shows the profession name as primary text and its
      recipe count ("N recipes") as secondary context, loaded via one
      `prisma.profession.findMany({ include: { _count: { select: { recipes: true } } } })`
      query — never the full `recipes` relation, so the list never
      triggers an N+1 query; search matches name OR slug, trimmed,
      case-insensitive, server-rendered via `?q=`, preserved through
      record links, the create link, and Cancel/Delete links
- [x] Pagination is deliberately deferred: ten seeded professions, an even
      smaller record count than the Item/Recipe precedent that already
      deferred it for the same reason
- [x] Because the create form moved, `createProfessionAction`'s
      validation/duplicate/verification/image error redirects now target
      `/admin/professions/new` instead of `/admin/professions` (mirroring
      exactly how `createRecipeAction` was changed for Slice 9C.1) — the
      success redirect and every other action (`updateProfessionAction`,
      `deleteProfessionAction`), the Prisma schema, image storage, Game
      Version verification, and the recipe-linked delete-blocking rule are
      all byte-for-byte unchanged
- [x] Tests: `profession-workspace.test.ts` covers the pure URL helpers
      (query normalization/preservation, edit/delete hrefs); the E2E
      suite (`admin-professions.spec.ts`) was converted from admin-table
      assertions to record-list assertions, gained a dedicated
      creation-route test and a record-list search/switching/no-match
      test mirroring the Recipe precedent, and every existing lifecycle/
      duplicate/relation-blocked test now goes through
      `/admin/professions/new` and the edit-page Delete link;
      `admin-profession-images.spec.ts` and `admin-name-feedback.spec.ts`
      were updated for the same route change; the protection spec
      extended with `/admin/professions/new`
- [x] No Profession tabs, no Recipes relationship tab, no Categories/
      Locations conversion, no dashboard summaries, and no Route Hubs
      were started

### Slice 9D.2 — Profession General editor conversion (complete, 2026-07-18)

- [x] `/admin/professions/new` and `/admin/professions/[slug]/edit` now
      compose the shared editor primitives — `EditorHeader` (one h1:
      "Create Profession" or the profession's own name), `EditorTabs`
      (General active; create shows only General with no placeholders,
      matching the Item/Recipe precedent; edit adds Recipes/Metadata as
      disabled placeholders via the new `professionEditorTabs` helper),
      `ImagePanel`, `VerificationPanel`, `TimestampsPanel` (edit only),
      and sticky `EditorActions` ("Create Profession"/"Save Changes",
      Cancel, and on edit a "Delete Profession" link via `EditorActions`'
      own `deleteHref`)
- [x] Delete is passed directly to `EditorActions`' `deleteHref` (not
      routed through `EditorHeader`'s `actions` slot as Recipe had to) —
      Professions carry no ingredient-style capacity guard that would
      ever need to withhold the form, so the simpler Item-style
      placement applies
- [x] `ImagePanel`'s upload/replace/remove markup reuses the exact shared
      `.admin-image-remove-*` classes Item/Recipe already migrated to —
      no bespoke inline `<style>` block, verified byte-for-byte
      equivalent before reuse
- [x] Every Profession field (name, slug, description), redirect, server
      action, image behavior, verification rule, and name-availability
      check is byte-for-byte unchanged — only presentation moved
- [x] Linked-Recipe delete-blocking rule, `updateProfessionAction`, and
      `deleteProfessionAction` are completely untouched; General does not
      load the full `recipes` relation
- [x] Tests: `professionEditorTabs` unit coverage (General active/real,
      Recipes/Metadata disabled, exactly-one-active, query preservation);
      a new "Profession editor" E2E test proving exactly one h1, create
      shows only General, edit marks General active with Recipes/
      Metadata inert, and Timestamps render on edit only; a new gameplay-
      verification E2E test (unverified state, opt-in stamping, normal-
      edit preservation, historical Game Version selection) mirroring the
      Recipe precedent exactly, since no such coverage existed for
      Professions before this slice; existing lifecycle/image/name-
      feedback tests updated only where the edit heading changed from
      "Edit Profession" to the profession's own name
- [x] No Recipes route, no Metadata content, and no other resource
      workspace was converted

### Slice 9D.3 — Profession Recipes relationship tab (complete, 2026-07-20)

- [x] `/admin/professions/[slug]/recipes` is a new, real, read-only tab
      inside `ProfessionWorkspace`, mirroring the Item workspace's Used in
      Recipes tab (Slice 9B.7) shape but for a single relationship
      direction (Recipes linked to this Profession)
- [x] `professionEditorTabs` now takes an `active: "general" | "recipes"`
      key (its new `ProfessionEditorTabKey`, structurally identical to
      `itemEditorTabs`/`recipeEditorTabs`'s shape) — General and Recipes
      are both real links; Metadata remains the only disabled placeholder
- [x] A new `professionRecipesHref(slug, query)` helper builds the tab's
      route; `ProfessionWorkspace` gained an optional `recordHref` prop
      (default `professionEditHref`, mirroring `ItemWorkspace`'s own) so
      quick-switching professions while on this tab stays on the Recipes
      tab, with `q` preserved
- [x] One restrained query —
      `prisma.profession.findUnique({ include: { recipes: { include: { resultingItem: true }, orderBy: { name: "asc" } } } })`
      — no per-row follow-up query; recipes are ordered alphabetically by
      name
- [x] Content is a `ContextPanel` table (Recipe/Resulting Item/Quantity)
      with a restrained count, replaced by an `EmptyState` when the
      profession has no linked recipe; each Recipe name links to the
      EXISTING `/admin/recipes/[slug]/edit` route (no Profession `q`
      carried onto that link)
- [x] Required level renders as a labeled detail line beneath the recipe
      name only when present — no placeholder dash, no empty label, no
      blank cell — following the hide-empty convention Item's Used in
      Recipes tab established; unlike that tab, no Profession name is
      repeated in the row, since the current Profession is already the
      page's own context
- [x] No form, input, select, checkbox, file control, or mutation/delete/
      image/verification control exists anywhere on this tab
- [x] Recipe/Profession CRUD actions, the Prisma schema, storage, and
      authorization are all unchanged
- [x] Tests: `professionEditorTabs`/`professionRecipesHref` unit coverage
      (Recipes active/real, query preservation, exactly-one-active,
      Metadata the only disabled tab); a new integration test proving the
      relation query's alphabetical ordering, resulting-item/quantity
      data, and sparse `requiredLevel` handling; a new dedicated
      "admin-profession-recipes" E2E spec (direct route access, ordering,
      hide-empty required level, empty state, tab navigation, quick
      switching with `q` preservation, read-only-content assertions,
      unknown-slug 404) mirroring `admin-item-recipes.spec.ts`'s
      structure; the existing Profession editor E2E test updated for
      Recipes becoming a real tab, and the unauthenticated-protection
      route list extended with the new route
- [x] No Metadata content, and no other resource workspace was converted

### Slice 9D.4 — Profession Metadata tab (complete, 2026-07-20)

- [x] `/admin/professions/[slug]/metadata` is a new, real, read-only tab
      inside `ProfessionWorkspace`, completing the Profession workspace —
      mirroring the Item (Slice 9B.8) and Recipe (Slice 9C.4) Metadata
      tabs' shape exactly
- [x] `professionEditorTabs`'s `ProfessionEditorTabKey` now accepts
      `"metadata"`; no Profession tab renders as a disabled placeholder
      any more — every one of the three (General, Recipes, Metadata) is a
      real link, via the new `professionMetadataHref(slug, query)` helper
- [x] `ProfessionWorkspace`'s existing `recordHref` prop (introduced in
      Slice 9D.3) takes `professionMetadataHref` so quick-switching
      professions while on this tab stays on the Metadata tab, with `q`
      preserved
- [x] One restrained query —
      `prisma.profession.findUnique({ include: { verifiedGameVersion: true, _count: { select: { recipes: true } } } })`
      — the same `verifiedGameVersion` relation the General edit page
      already loads, plus a Recipe `_count` (never the full `recipes`
      relation, which the Recipes tab already covers) — no per-row
      follow-up query
- [x] Content is a `ContextPanel` titled "Profession" showing the Recipe
      count (always rendered — zero is itself meaningful administrative
      context); `VerificationPanel` in its existing `readOnly` mode
      (status badge, Verified against/Verified on/Current version rows,
      each hidden when its own data is absent); `TimestampsPanel`
      (created/updated/verified dates, no ids)
- [x] The description field is deliberately NOT repeated here — it is an
      editable General field, and this tab exists to show administrative
      facts General doesn't, not to duplicate it
- [x] No form, picker, checkbox, submit button, file input, hidden
      mutation field, image control, Recipe-relationship control, or
      delete action exists anywhere on this tab; no database id, foreign
      key, or storage path is ever surfaced
- [x] General/Recipes actions, the Prisma schema, storage, and
      authorization are all unchanged
- [x] Tests: `professionEditorTabs`/`professionMetadataHref` unit
      coverage (Metadata active/real, query preservation, exactly-one-
      active across all three tabs, no disabled tabs remain); a new
      dedicated "admin-profession-metadata" E2E spec (direct route
      access, created/updated dates, current Game Version, unverified vs.
      verified status with verified-against/verification date, accurate
      Recipe count including zero, tab navigation, quick switching with
      `q` preservation, read-only-content assertions, unknown-slug 404)
      mirroring `admin-item-metadata.spec.ts`'s structure; the existing
      Profession editor E2E test and the Recipes-tab navigation test
      updated for Metadata becoming a real tab, and the
      unauthenticated-protection route list extended with the new route
- [x] The Profession reference workspace (General, Recipes, Metadata) is
      now functionally complete, matching the Item and Recipe workspaces'
      shape; no other resource workspace was converted

### Slice 9E.1 — Category workspace navigation foundation (complete, 2026-07-20)

- [x] Categories are the FOURTH production adoption of
      `AdminWorkspace`/`RecordList`, via a new, independent thin wrapper —
      `CategoryWorkspace` (`src/components/admin/category-workspace.tsx`)
      — over new pure helpers in `src/lib/admin/category-workspace.ts`
      (`categoryEditHref`, `categoryDeleteHref`,
      `normalizeCategorySearchQuery`, `withCategorySearchQuery`),
      mirroring the Item/Recipe/Profession workspaces' own
      navigation-foundation slices exactly but sharing no code with any
      of them
- [x] `/admin/categories` is the workspace landing state (searchable
      record list + restrained guidance; the embedded creation form and
      admin table are gone); `/admin/categories/new` is the dedicated
      creation route the form moved to unchanged (same fields — name,
      slug, description); `/admin/categories/[slug]/edit` and
      `/admin/categories/[slug]/delete` render inside `CategoryWorkspace`
      unchanged otherwise (same PageHeader, same form, same confirm-card)
- [x] The edit page's toolbar gained a "Delete Category" link (replacing
      the old table's per-row Delete action, mirroring the Profession
      precedent) — reachable unconditionally since Categories carry no
      capacity guard to withhold it
- [x] The record list shows the category name as primary text and its
      linked-item count ("N items") as secondary context, loaded via
      `prisma.category.findMany({ include: { _count: { select: { items: true } } } })`
      — never the full `items` relation, so the list never triggers an
      N+1 query; search matches name OR slug, trimmed, case-insensitive,
      server-rendered via `?q=`, preserved through record links, the
      create link, and Cancel/Delete links
- [x] Because the create form moved, `createCategoryAction`'s
      validation/duplicate error redirects now target
      `/admin/categories/new` instead of `/admin/categories` — the
      success redirect and every other action (`updateCategoryAction`,
      `deleteCategoryAction`), the Prisma schema, and the item-linked
      delete-blocking rule are all byte-for-byte unchanged
- [x] Pagination is deliberately deferred (five seeded categories, the
      smallest record count of any converted resource so far)
- [x] No Category tabs, no Items relationship tab, no shared editor
      primitives (`EditorHeader`/`EditorTabs`/`TimestampsPanel`/sticky
      `EditorActions`) adopted this pass — the existing `PageHeader` and
      plain-form presentation stayed as-is; only the navigation wrapper
      moved
- [x] Tests: `category-workspace.ts` unit coverage (query normalization,
      preservation, slug-based edit/delete hrefs) mirroring the
      Profession workspace's own navigation-foundation unit tests; a
      rewritten `admin-categories.spec.ts` (workspace landing, dedicated
      creation route, create/edit/delete lifecycle, duplicate-name
      rejection, record-list search/quick-switching/`q` preservation, and
      a NEW linked-Item delete-blocking test using a new
      `createTemporaryItemForCategory`/`removeTemporaryItemForCategory`
      DB helper pair mirroring the Profession/Recipe relation-helper
      pattern); `admin-name-feedback.spec.ts`'s Category case updated for
      the new creation route and error redirect; the
      unauthenticated-protection route list extended with
      `/admin/categories/new`
- [x] No Category General/Items/Metadata editor conversion, no Locations
      conversion, no dashboard summaries, and no Route Hubs were started

### Slice 9E.2 — Category General editor conversion (complete, 2026-07-20)

- [x] `/admin/categories/new` and `/admin/categories/[slug]/edit` now
      compose the shared editor primitives — `EditorHeader` (one h1:
      "Create Category" or the category's own name), `EditorTabs`
      (General active; create shows only General with no placeholders,
      matching the Item/Recipe/Profession precedent; edit adds
      Items/Metadata as disabled placeholders via the new
      `categoryEditorTabs` helper), `TimestampsPanel` (edit only), and
      sticky `EditorActions` ("Create Category"/"Save Changes", Cancel,
      and on edit a "Delete Category" link via `EditorActions`' own
      `deleteHref`)
- [x] Categories carry no image or gameplay-verification behavior, so —
      unlike Item/Recipe/Profession — this conversion deliberately adds
      NO `ImagePanel`, NO `VerificationPanel`, and NO
      `GameVersionVerificationControls`; the create page has no aside at
      all (nothing applies pre-save) and the edit aside holds only
      `TimestampsPanel`
- [x] Delete is passed directly to `EditorActions`' `deleteHref` (the
      simpler Item/Profession-style placement) — Categories carry no
      capacity guard that would ever need to withhold the form
- [x] Every Category field (name, slug, description), redirect, server
      action, duplicate-name check, and the item-linked delete-blocking
      rule is byte-for-byte unchanged — only presentation moved
- [x] `updateCategoryAction` and `deleteCategoryAction` are completely
      untouched; General does not load the full `items` relation
- [x] Tests: `categoryEditorTabs` unit coverage (General active/real,
      Items/Metadata disabled, exactly-one-active, query preservation);
      a new "Category editor" E2E test proving exactly one h1, create
      shows only General, edit marks General active with Items/Metadata
      inert, Timestamps render on edit only, and no Image/Verification
      heading or file/checkbox/select control appears anywhere on either
      page; the existing lifecycle test updated for the edit heading
      changing from the static "Edit Category" to the category's own name
- [x] No Items relationship tab, no Metadata content, and no other
      resource workspace was converted

### Slice 9E.3 — Category Items relationship tab (complete, 2026-07-20)

- [x] `/admin/categories/[slug]/items` is a new, real, read-only tab
      inside `CategoryWorkspace`, mirroring the Profession workspace's
      own Recipes tab (Slice 9D.3) shape but for a single relationship
      direction (Items linked to this Category)
- [x] `categoryEditorTabs` now takes an `active: "general" | "items"`
      key (its new `CategoryEditorTabKey`, structurally identical to
      `professionEditorTabs`'s shape) — General and Items are both real
      links; Metadata remains the only disabled placeholder
- [x] A new `categoryItemsHref(slug, query)` helper builds the tab's
      route; `CategoryWorkspace` gained an optional `recordHref` prop
      (default `categoryEditHref`, mirroring `ProfessionWorkspace`'s own)
      so quick-switching categories while on this tab stays on the Items
      tab, with `q` preserved
- [x] One restrained query —
      `prisma.category.findUnique({ include: { items: { orderBy: { name: "asc" } } } })`
      — no per-row follow-up query; items are ordered alphabetically by
      name
- [x] Content is a `ContextPanel` table (Item/Held Item/Tradeable) with a
      restrained count, replaced by an `EmptyState` when the category has
      no linked item; each Item name links to the EXISTING
      `/admin/items/[slug]/edit` route (no Category `q` carried onto that
      link)
- [x] Base value renders as a labeled detail line beneath the item name
      only when present — no placeholder dash, no empty label, no blank
      cell — following the hide-empty convention Profession's Recipes tab
      established; Held item and Tradeable are always-meaningful
      booleans, so they render as explicit Yes/No table columns instead
      of optional detail lines (never a rigid column with blank cells)
- [x] No form, input, select, checkbox, file control, or mutation/delete/
      image/verification control exists anywhere on this tab
- [x] Category/Item CRUD actions, the Prisma schema, storage, and
      authorization are all unchanged
- [x] Tests: `categoryEditorTabs`/`categoryItemsHref` unit coverage
      (Items active/real, query preservation, exactly-one-active,
      Metadata the only disabled tab); a new integration test proving the
      relation query's alphabetical ordering, boolean-field availability,
      and sparse `baseValue` handling; a new dedicated
      "admin-category-items" E2E spec (direct route access, ordering,
      hide-empty base value, empty state, tab navigation, quick switching
      with `q` preservation, read-only-content assertions, unknown-slug
      404) mirroring `admin-profession-recipes.spec.ts`'s structure; the
      existing Category editor E2E test updated for Items becoming a real
      tab, and the unauthenticated-protection route list extended with
      the new route
- [x] No Metadata content, and no other resource workspace was converted

### Slice 9E.4 — Category Metadata tab (complete, 2026-07-20)

- [x] `/admin/categories/[slug]/metadata` is a new, real, read-only tab
      inside `CategoryWorkspace`, completing the Category workspace —
      mirroring the Item (Slice 9B.8), Recipe (Slice 9C.4), and
      Profession (Slice 9D.4) Metadata tabs' shape but deliberately
      leaner, since Categories carry no image or gameplay-verification
      behavior
- [x] `categoryEditorTabs`'s `CategoryEditorTabKey` now accepts
      `"metadata"`; no Category tab renders as a disabled placeholder any
      more — every one of the three (General, Items, Metadata) is a real
      link, via the new `categoryMetadataHref(slug, query)` helper
- [x] `CategoryWorkspace`'s existing `recordHref` prop (introduced in
      Slice 9E.3) takes `categoryMetadataHref` so quick-switching
      categories while on this tab stays on the Metadata tab, with `q`
      preserved
- [x] One restrained query —
      `prisma.category.findUnique({ include: { _count: { select: { items: true } } } })`
      — an Item `_count` only, never the full `items` relation (the
      Items tab already covers that relationship); no `gameVersions`
      query at all, unlike Item/Recipe/Profession's own Metadata tabs
- [x] Content is a `ContextPanel` titled "Category" showing the Item
      count (always rendered — zero is itself meaningful administrative
      context); `TimestampsPanel` (created/updated dates, no ids, no
      Verified row since Categories carry no verification stamp) — no
      `VerificationPanel`, `ImagePanel`, or `GameVersionVerificationControls`
      exist anywhere on this tab
- [x] The description field is deliberately NOT repeated here — it is an
      editable General field, and this tab exists to show administrative
      facts General doesn't, not to duplicate it
- [x] No form, picker, checkbox, submit button, file input, hidden
      mutation field, image control, verification control, or
      Item-relationship control exists anywhere on this tab; no database
      id, foreign key, or storage path is ever surfaced
- [x] General/Items actions, the Prisma schema, storage, and
      authorization are all unchanged
- [x] Tests: `categoryEditorTabs`/`categoryMetadataHref` unit coverage
      (Metadata active/real, query preservation, exactly-one-active
      across all three tabs, no disabled tabs remain); a new dedicated
      "admin-category-metadata" E2E spec (direct route access,
      created/updated dates, accurate Item count including zero, tab
      navigation, quick switching with `q` preservation, no
      image/verification content, read-only-content assertions,
      unknown-slug 404) mirroring `admin-profession-metadata.spec.ts`'s
      structure minus every verification-specific assertion; the
      existing Category editor E2E test and the Items-tab navigation
      test updated for Metadata becoming a real tab, and the
      unauthenticated-protection route list extended with the new route
- [x] The Category reference workspace (General, Items, Metadata) is now
      functionally complete, matching the Item, Recipe, and Profession
      workspaces' shape; Locations remain unconverted

### Slice 9F.1 — Location workspace navigation foundation (complete, 2026-07-20)

- [x] Locations are the FIFTH production adoption of
      `AdminWorkspace`/`RecordList`, via a new, independent thin wrapper —
      `LocationWorkspace` (`src/components/admin/location-workspace.tsx`)
      — over new pure helpers in `src/lib/admin/location-workspace.ts`
      (`locationEditHref`, `locationDeleteHref`,
      `normalizeLocationSearchQuery`, `withLocationSearchQuery`),
      mirroring the Item/Recipe/Profession/Category workspaces' own
      navigation-foundation slices exactly but sharing no code with any
      of them
- [x] `/admin/locations` is the workspace landing state (searchable
      record list + restrained guidance; the embedded creation form and
      admin table are gone); `/admin/locations/new` is the dedicated
      creation route the form moved to unchanged (same fields — name,
      slug, type, parent, description, access note, image,
      `GameVersionVerificationControls`); `/admin/locations/[slug]/edit`
      and `/admin/locations/[slug]/delete` render inside
      `LocationWorkspace` unchanged otherwise (same PageHeader, same
      form, same confirm-card)
- [x] The edit page's toolbar gained a "Delete Location" link (replacing
      the old table's per-row Delete action, mirroring the
      Category/Profession precedent) — reachable unconditionally since
      Locations carry no editor-only capacity guard to withhold it
- [x] The record list shows the location name as primary text and
      concise secondary context — the type label alone for a root
      location, or `"{Type} · {Parent name}"` when a parent exists —
      loaded via `prisma.location.findMany({ include: { parent: true }, orderBy: { name: "asc" } })`,
      never a per-row follow-up query, so parent context introduces no
      N+1 behavior; this slice deliberately does NOT build a tree
      control, expandable hierarchy, or nested navigation — the list
      stays a single flat, alphabetically ordered list exactly like
      every other converted resource
- [x] Search matches name OR slug, trimmed, case-insensitive,
      server-rendered via `?q=`, plus a type-label match against the
      small, fixed `LOCATION_TYPE_LABELS` lookup (clean and predictable,
      never per-row or guessed); preserved through record links, the
      create link, and Cancel/Delete links
- [x] Because the create form moved, `createLocationAction`'s
      validation/duplicate/verification/invalid-parent/image error
      redirects now target `/admin/locations/new` instead of
      `/admin/locations` — the success redirect and every other action
      (`updateLocationAction`, `deleteLocationAction`), the Prisma
      schema, image storage, Game Version verification,
      hierarchy/cycle-prevention rules, and the child-location
      delete-blocking rule are all byte-for-byte unchanged
- [x] Pagination is deliberately deferred (zero seeded Location
      fixtures — an even smaller baseline than Category's own 5)
- [x] No Location tabs (General/Hierarchy/Acquisition Sources/Metadata
      split), no shared editor primitives
      (`EditorHeader`/`EditorTabs`/`ImagePanel`/`VerificationPanel`/
      `TimestampsPanel`/sticky `EditorActions`) adopted this pass — the
      existing `PageHeader` and plain-form presentation stayed as-is;
      only the navigation wrapper moved; no tree control,
      expandable hierarchy, or drag-and-drop was built
- [x] Tests: `location-workspace.ts` unit coverage (query normalization,
      preservation, slug-based edit/delete hrefs) mirroring the
      Profession/Category workspaces' own navigation-foundation unit
      tests; a rewritten `admin-locations.spec.ts` (workspace landing,
      dedicated creation route, create/edit/delete lifecycle, gameplay
      verification, duplicate-name rejection, cycle rejection,
      child-location delete-blocking, sparse-location rendering,
      unknown-slug 404, record-list search by name/slug/type label,
      quick-switching with `q` preservation across create/cancel/delete
      links, secondary-context rendering) replacing the old
      table-row-based helpers with a `recordRow` RecordList helper
      mirroring every other resource's own navigation-foundation
      rewrite; `admin-location-images.spec.ts` updated for the same
      route/helper changes; the unauthenticated-protection route list
      extended with `/admin/locations/new`; two OTHER suites that use
      `/admin/locations` purely as a fixture-creation helper
      (`admin-item-sources.spec.ts`, `admin-item-how-to-obtain.spec.ts`)
      updated to target `/admin/locations/new` instead, since the
      embedded form they relied on moved
- [x] No Location General/Hierarchy/Acquisition Sources/Metadata editor
      conversion, no dashboard summaries, and no Route Hubs were started

### Slice 9F.2 — Location General editor conversion (complete, 2026-07-20)

- [x] `/admin/locations/new` and `/admin/locations/[slug]/edit` now
      compose the shared editor primitives — `EditorHeader` (one h1:
      "Create Location" or the location's own name), `EditorTabs`
      (General active; create shows only General with no placeholders,
      matching the Item/Recipe/Profession/Category precedent; edit adds
      Hierarchy/Acquisition Sources/Metadata as disabled placeholders
      via the new `locationEditorTabs` helper), `ImagePanel` (reusing
      the exact shared `.admin-image-remove-*` classes Item/Recipe/
      Profession already migrated to — no bespoke inline `<style>`
      block), `VerificationPanel`, `TimestampsPanel` (edit only), and
      sticky `EditorActions` ("Create Location"/"Save Changes", Cancel,
      and on edit a "Delete Location" link via `EditorActions`' own
      `deleteHref`)
- [x] Delete is passed directly to `EditorActions`' `deleteHref` (the
      simpler Item/Profession-style placement) — Locations carry no
      capacity guard that would ever need to withhold the form
- [x] Parent selection stays exactly where it already was — inside
      General's own fields — since splitting hierarchy editing into a
      dedicated tab is later work; General still does not load the full
      `children` or `acquisitionSources` relations, so this slice adds
      no N+1 query and no relationship control
- [x] Every Location field (name, slug, type, parent, description,
      access note), redirect, server action, image behavior,
      verification rule (including historical Game Version selection
      and unchecked-edit preservation), hierarchy/cycle-prevention rule,
      and the child-location delete-blocking rule is byte-for-byte
      unchanged — only presentation moved
- [x] `updateLocationAction` and `deleteLocationAction` are completely
      untouched; General does not mutate Acquisition Source relations
- [x] Tests: `locationEditorTabs` unit coverage (General active/real,
      Hierarchy/Acquisition Sources/Metadata disabled,
      exactly-one-active, query preservation); a new "Location editor"
      E2E test proving exactly one h1, create shows only General, edit
      marks General active with the other three tabs inert, Timestamps
      render on edit only, and Image/Verification panels render
      correctly on both pages; the existing lifecycle test updated for
      the edit heading changing from the static "Edit Location" to the
      location's own name (slug as subtitle); the existing verification
      test rewritten around the shared `VerificationPanel` (status
      badge, Verified against/Verified on rows) in place of the removed
      inline "Gameplay data verified for X on Y" sentence, extended with
      a historical Game Version selection flow mirroring the Profession
      workspace's own verification test exactly
- [x] No Hierarchy tab, no Acquisition Sources tab, no Metadata content,
      and no other resource workspace was converted

### Slice 9F.3 — Location Hierarchy tab (complete, 2026-07-20)

- [x] `/admin/locations/[slug]/hierarchy` is a new, real, editable tab
      inside `LocationWorkspace`, mirroring the Recipe workspace's own
      General/Ingredients split (Slice 9C.3) in shape — a mutation tab
      splitting off from General — while also showing a read-only
      relationship list like the Profession workspace's Recipes tab
      (Slice 9D.3)
- [x] `locationEditorTabs` now takes an `active: "general" | "hierarchy"`
      key (its new `LocationEditorTabKey`, structurally identical to
      `professionEditorTabs`'s shape) — General and Hierarchy are both
      real links; Acquisition Sources and Metadata remain the only
      disabled placeholders
- [x] A new `locationHierarchyHref(slug, query)` helper builds the tab's
      own route; `LocationWorkspace` gained an optional `recordHref` prop
      (default `locationEditHref`, mirroring `ProfessionWorkspace`'s own)
      so quick-switching locations while on this tab stays on the
      Hierarchy tab, with `q` preserved
- [x] Parent assignment moved OUT of General's own fields and into this
      tab: the "Parent location" `<select>` no longer appears anywhere
      on `/admin/locations/[slug]/edit`; the create page is unaffected
      (it never had a General/Hierarchy split — there is no record yet
      for a Hierarchy tab to describe — so its own inline parent
      selector stays exactly where it was)
- [x] `updateLocationAction` was replaced by two narrow actions in
      `src/app/admin/locations/actions.ts`: `updateLocationGeneralAction`
      (name/slug/type/description/accessNote/image/verification — never
      touching `parentId`) and `updateLocationHierarchyAction` (a single
      `prisma.location.update({ data: { parentId } } )` — never touching
      any other field)
- [x] Both actions reuse — never reimplement — validation and the
      existing cycle guard: `src/lib/validation/location.ts` now
      extracts a private `parseLocationGeneralFields` helper that
      `parseLocationInput` (unchanged, still the create page's parser),
      the new exported `parseLocationGeneralInput`, and the new exported
      `parseLocationHierarchyInput` all share — the same field-by-field
      rules in exactly one place; `updateLocationHierarchyAction` calls
      the exact same `wouldCreateLocationCycle` helper the combined
      action always used, never a second cycle-prevention implementation
- [x] The Hierarchy tab's own content is a narrow `<form>`
      (`<fieldset><legend>Parent Location</legend>` holding just the
      parent `<select>`, self excluded from its own options exactly as
      before) plus sticky `EditorActions` ("Save Hierarchy"/Cancel/
      "Delete Location" — Delete via `EditorActions`' own `deleteHref`,
      unconditionally reachable since Locations carry no capacity guard)
- [x] A read-only `ContextPanel` titled "Sub-locations" lists this
      location's DIRECT children only (never a recursive descendant
      walk) via one restrained
      `prisma.location.findUnique({ include: { children: { orderBy: { name: "asc" } } } })`
      query — no N+1, no `acquisitionSources` include; each child's name
      links to the EXISTING `/admin/locations/[slug]/edit` route with
      its type label as concise context, and a restrained `EmptyState`
      ("No sub-locations yet") replaces the panel entirely when there
      are none, never an empty table or placeholder dash
- [x] No `ImagePanel`, `VerificationPanel`, or `TimestampsPanel` render
      on this tab — none apply to hierarchy assignment; no name, slug,
      type, description, access-note, image, or verification control
      exists anywhere on this tab
- [x] Every hierarchy/cycle-prevention rule (self-parent rejection,
      descendant-cycle rejection, missing-parent handling), the
      child-location delete-blocking rule, image behavior, and
      verification behavior are byte-for-byte unchanged
- [x] Tests: `locationEditorTabs`/`locationHierarchyHref` unit coverage
      (Hierarchy active/real, query preservation, exactly-one-active,
      Acquisition Sources/Metadata the only disabled tabs);
      `parseLocationGeneralInput`/`parseLocationHierarchyInput` unit
      coverage proving the delegation to the shared field validation; a
      new integration describe block proving a General-shaped update
      preserves `parentId`, a Hierarchy-shaped update changes ONLY
      `parentId` (name/slug/type/description/accessNote/image/
      verifiedAt/verifiedGameVersionId all provably preserved), removing
      the parent works, a failed hierarchy update (invalid parent id)
      leaves the location's data completely unchanged, reassigning a
      location's own parent never mutates its children, and direct
      children are returned alphabetically without a recursive
      descendant load; new "Location editor" E2E coverage (Hierarchy tab
      navigation, real/active tab state, no General/create field leakage
      onto Hierarchy) plus a dedicated Hierarchy E2E test (current parent
      preselected, self excluded, changing/removing the parent,
      sub-location list updates, General/image/verification preserved,
      Delete Location reachable) and a quick-switching test (mirroring
      the Recipe Ingredients tab's own); the existing cycle-rejection
      test retargeted to the Hierarchy route and its "Save Hierarchy"
      button; an unknown-slug 404 test for the hierarchy route; the
      unauthenticated-protection route list extended with the hierarchy
      route
- [x] No Acquisition Sources tab, no Metadata content, no tree control,
      no child-mutation control, and no other resource workspace was
      converted

### Slice 9F.4 — Location Acquisition Sources tab (complete, 2026-07-20)

- [x] `/admin/locations/[slug]/sources` is a new, real, read-only tab
      inside `LocationWorkspace`, mirroring the Profession Recipes tab
      (Slice 9D.3) and Category Items tab (Slice 9E.3) shape exactly —
      a relationship VIEW, never a mutation surface
- [x] `locationEditorTabs`'s `LocationEditorTabKey` now accepts
      `"sources"` via the new `locationSourcesHref(slug, query)` helper
      — every one of General, Hierarchy, and Acquisition Sources is now
      a real link; Metadata remains the sole disabled placeholder
- [x] `LocationWorkspace`'s existing `recordHref` prop (introduced in
      Slice 9F.3) takes `locationSourcesHref` so quick-switching
      locations while on this tab stays on the Acquisition Sources tab,
      with `q` preserved
- [x] One restrained query —
      `prisma.location.findUnique({ include: { acquisitionSources: { include: { item: true, profession: true }, orderBy: { item: { name: "asc" } } } } })`
      — no per-row follow-up query; no `verifiedGameVersion` include
      (verification detail belongs to a later Metadata tab, matching
      every other relationship tab's own restraint)
- [x] Rows are sorted by the new `sortLocationAcquisitionSourcesByType`
      helper in `src/lib/admin/location-workspace.ts`: grouped by
      `AcquisitionType` in the enum's own declared order (reusing the
      existing `ACQUISITION_TYPES` array — never a second,
      hand-maintained ordering) via a stable sort that preserves the
      query's own item-name-ascending order within each type group
- [x] Content is a `ContextPanel` titled "Acquisition Sources" holding
      an admin-table (Item/Type) with a restrained count, replaced
      entirely by an `EmptyState` ("No acquisition sources reference
      this location yet") when the location has no linked source —
      never an empty table
- [x] Each row's Item name links to the EXISTING
      `/admin/items/[itemSlug]/sources/[sourceId]/edit` route (no
      Location `q` carried onto that cross-resource link); source
      label, profession, quantity, and notes each render as a labeled
      detail line beneath the item name only when present — no
      placeholder dash, no empty label, no blank cell — following the
      hide-empty convention every prior relationship tab established;
      the current Location is never redundantly repeated in a row,
      since it is already the page's own context
- [x] No form, input, select, checkbox, file control, or
      mutation/create/unlink/delete/image/verification/hierarchy
      control exists anywhere on this tab — Acquisition Sources remain
      entirely Item-owned, managed only through the existing
      `/admin/items/[slug]/sources` routes, exactly as before this
      slice
- [x] Location/Item/AcquisitionSource CRUD, the Prisma schema, storage,
      and authorization are all unchanged
- [x] Tests: `locationSourcesHref`/`sortLocationAcquisitionSourcesByType`
      unit coverage (Acquisition Sources active/real, query preservation,
      exactly-one-active across all three real tabs, only Metadata
      disabled, stable type-then-name ordering, no input mutation); a
      new integration describe block proving the Location query returns
      linked Acquisition Sources with Item/Profession populated, stable
      type/name ordering independent of creation order, sparse optional
      values remain valid, a zero-source location returns an empty
      collection, and sources belonging to a different location are
      never included; a new dedicated "admin-location-sources" E2E spec
      (direct route access, grouped/ordered rendering, hide-empty
      optional facts, cross-resource link correctness with no Location
      `q` leakage, zero-source empty state, tab navigation, quick
      switching with `q` preservation, read-only-content assertions,
      unknown-slug 404) mirroring `admin-category-items.spec.ts`'s
      structure; the existing Location editor tabs E2E test updated for
      Acquisition Sources becoming a real tab; the
      unauthenticated-protection route list extended with the sources
      route
- [x] No Location Metadata content, and no other resource workspace was
      converted

### Slice 9F.5 — Location Metadata tab (complete, 2026-07-20)

- [x] `/admin/locations/[slug]/metadata` is a new, real, read-only tab
      inside `LocationWorkspace`, completing the Location workspace —
      mirroring the Item (Slice 9B.8), Recipe (Slice 9C.4), Profession
      (Slice 9D.4), and Category (Slice 9E.4) Metadata tabs' shape
      exactly
- [x] `locationEditorTabs`'s `LocationEditorTabKey` now accepts
      `"metadata"` and `locationEditorTabs` no longer renders any
      disabled placeholder — every one of the four Location tabs
      (General, Hierarchy, Acquisition Sources, Metadata) is a real
      link, via the new `locationMetadataHref(slug, query)` helper
      alongside the existing three
- [x] `LocationWorkspace`'s existing `recordHref` prop (introduced in
      Slice 9F.3) takes `locationMetadataHref` so quick-switching
      locations while on this tab stays on the Metadata tab, with `q`
      preserved
- [x] One restrained query —
      `prisma.location.findUnique({ include: { parent: true, verifiedGameVersion: true, _count: { select: { children: true, acquisitionSources: true } } } })`
      — a parent relation plus child/Acquisition-Source `_count`s only,
      never the full collections (which the Hierarchy and Acquisition
      Sources tabs already cover in full) — no per-row follow-up query
- [x] Content is a `ContextPanel` titled "Location" showing the type
      (always rendered, since it is a required field), the parent's
      name (only when present — a root location simply omits the row),
      and the sub-location/Acquisition-Source counts (via `_count`,
      always rendered since zero is itself meaningful administrative
      context); `VerificationPanel` (created/updated/verified dates, no
      ids, `readOnly` — status badge and Verified-against/Verified-on/
      Current-version rows, each hidden when its own data is absent);
      `TimestampsPanel` shows created/updated/verified dates
- [x] The description and access-note fields are deliberately NOT
      repeated here — both are editable General fields, and duplicating
      them would add no administrative information this tab exists to
      show
- [x] No form, picker, checkbox, submit button, file input, hidden
      mutation field, image control, hierarchy-mutation control, or
      Acquisition-Source-mutation control exists anywhere on this tab;
      no database id, foreign key, or storage path is ever surfaced
- [x] General/Hierarchy/Acquisition Sources behavior, Location/Item/
      AcquisitionSource actions, the Prisma schema, storage, and
      authorization are all unchanged
- [x] Tests: `locationEditorTabs`/`locationMetadataHref` unit coverage
      (Metadata active/real, query preservation, exactly-one-active
      across all four tabs, no disabled tabs remain); a new dedicated
      "admin-location-metadata" E2E spec (direct route access,
      created/updated dates, type, parent-when-present, accurate
      sub-location/Acquisition-Source counts including zero, current
      Game Version, unverified/verified status, tab navigation, quick
      switching with `q` preservation, read-only-content assertions,
      unknown-slug 404) mirroring `admin-profession-metadata.spec.ts`'s
      structure; the existing Location editor tabs E2E test and the
      Acquisition Sources tab's own navigation test updated for
      Metadata becoming a real tab; the unauthenticated-protection route
      list extended with the metadata route
- [x] The Location reference workspace (General, Hierarchy, Acquisition
      Sources, Metadata) is now functionally complete, matching the
      Item, Recipe, Profession, and Category workspaces' shape

### Remaining (not started)

- [ ] Dashboard summaries and Route Hubs — do not begin until explicitly
      instructed in the milestone conversation

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
