# Public Redesign Integration Dossier

This dossier is the implementation contract for integrating a future external
public-site redesign into Merchants Codex. It describes the application at
baseline commit `4d635a83dc72ffed03838fc9924485103d758cb7` and must be updated
when public behavior, routes, fixtures, or redesign tooling change.

## 1. Product scope and non-goals

Merchants Codex is a desktop-first crafting and trading reference for the
PokeForce MMO. It is not a general Pokemon wiki, player-account application,
theme builder, or permission to reuse protected pre-release PokeForce assets.
This harness prepares an externally designed public presentation for safe
integration. It does not redesign the current public site, import speculative
markup, add gameplay facts, or mix contributor-only admin concerns into public
routes.

Four categories keep review decisions explicit:

- **Preserve behavior:** canonical routes, Prisma-backed facts, search and
  filter semantics, deterministic ordering, hide-empty rules, safe rich text,
  Appearance authority, accessibility, and responsive usability.
- **Replaceable implementation:** page/component composition and data shaping
  may be refactored if the preserved behavior and query bounds remain intact.
- **Replaceable visual decisions:** tokens, typography, spacing, card treatment,
  and layout can change only through the approved redesign and visual review.
- **Hard boundary:** admin authentication, mutations, unpublished Appearance
  drafts, database IDs, and credentials never enter public output or captures.

## 2. Current public architecture

The project uses Next.js App Router and React Server Components. All public
page modules are server components unless explicitly noted; `MainNav` and
`PublicLogo` are the only client boundaries in the shared public shell. Public
pages import the singleton Prisma client from `src/lib/db.ts` and are marked
`force-dynamic`. There is no public REST/GraphQL data layer and the Supabase
Data API is not used for game data.

`src/app/layout.tsx` owns fonts and global metadata. Every public route composes
`AppShell`, which resolves the published Appearance record, renders one shared
header/navigation/search/footer, and optionally adds an `aria-hidden` scenic
layer. Catalogue helpers live in `src/lib/catalogue-query.ts`; global search is
in `src/lib/search/global-search.ts`; images and rich descriptions go through
`ContentImage` and `RichTextContent`.

No public `loading.tsx` or `error.tsx` exists. Resource-specific `not-found.tsx`
files for Items, Recipes, Professions, Classes, Categories, Locations, and
Shops all delegate to `PublicNotFound`. Missing detail records call
`notFound()`. The root Next.js not-found/error behavior remains framework-owned.

The reusable redesign metadata lives in `src/lib/public-design/`: `contracts.ts`
owns page contracts and allowlisted route resolution, `acceptance.ts` expands
those contracts across logical viewports, `fixtures.ts` owns deterministic
fixture identities/states, and `viewports.ts` owns dimensions. Their focused
unit tests validate IDs, references, routes, metadata, and complete matrix
coverage without importing public pages or touching a database.

## 3. Complete route inventory

The table is exhaustive for non-admin, non-auth application routes at the
baseline. “RSC” means a server page; “client” identifies the shared interactive
boundary rather than making the page client-rendered.

| Route | Type / boundary | Primary module and data source | Public contract |
| --- | --- | --- | --- |
| `/` | landing, RSC | `src/app/page.tsx`; four concurrent Prisma counts | Scenic `home`; one H1; item/recipe CTAs; six resource links; real counts; bounded desktop/ultrawide and single-column mobile. |
| `/items` | catalogue, RSC + client nav | `src/app/items/page.tsx`; Category filter query, Item count/findMany | Scenic `catalogue`; category chips; alphabetical name/id order; 12/page; invalid category redirects to `/items`; square image/fallback; empty catalogue. |
| `/items/[slug]` | detail, RSC + client logo/nav | `src/app/items/[slug]/page.tsx`; Item plus Category, RecipeIngredient/Recipe, AcquisitionSource, ShopListing/Currency, verification | Scenic `detail`; breadcrumb; hero; Held item; acquisition and recipe-use sections hide when empty; verified/unverified copy; wide two-column layout stacks at 1040px. |
| `/recipes` | catalogue, RSC | `src/app/recipes/page.tsx`; Profession filter, Recipe count/findMany using `recipeOutputCardSelect` | No scenic layer; Profession-only filter; stale `class` and invalid Profession redirect; name/id order; 12/page; inherited result image; ingredient disclosure; filtered/global empty states. |
| `/recipes/[slug]` | detail, RSC | `src/app/recipes/[slug]/page.tsx`; Recipe, result Item, Profession, ingredients, verification | Breadcrumb; inherited/custom hero image; quantity range; ingredient rows; crafted-result stage; optional Profession/level; EXP; verification; no empty ingredients panel. |
| `/professions` | catalogue, RSC | `src/app/professions/page.tsx`; Profession including all Recipes | Alphabetical grid; image/fallback; description plus recipe names/count; global empty state. This query currently over-fetches and may be replaced. |
| `/professions/[slug]` | detail, RSC | `src/app/professions/[slug]/page.tsx`; Profession, verification, all Recipes/result Items | Breadcrumb; semantic rich description; counts; at most three recipe previews; browse-all filtered link; preview hidden at zero; neutral/no scenic atmosphere. |
| `/classes` | catalogue, RSC | `src/app/classes/page.tsx`; PlayerClass selected fields | Alphabetical grid; optional image/description; empty state; no Recipe relationship. |
| `/classes/[slug]` | detail, RSC | `src/app/classes/[slug]/page.tsx`; PlayerClass and verification | Breadcrumb; neutral identity; optional rich description/image; verification; deliberately no counts, Recipes, or scenic atmosphere. |
| `/categories` | catalogue, RSC | `src/app/categories/page.tsx`; Category including all Items | Alphabetical grid; image/fallback; description plus Item names/count; empty state. Query may be narrowed in a future implementation. |
| `/categories/[slug]` | detail/context, RSC | `src/app/categories/[slug]/page.tsx`; Category and Item count | Optional rich description; image/fallback; count; filtered Items link only when count is nonzero; no duplicated Item grid. |
| `/locations` | catalogue, RSC | `src/app/locations/page.tsx`; Location name/slug/type | Flat alphabetical name/slug grid; type labels; no filter/pagination; empty state. Hierarchy belongs to detail pages. |
| `/locations/[slug]` | detail/route hub, RSC | `src/app/locations/[slug]/page.tsx`; Location children, direct Shops, AcquisitionSources; bounded ancestor loader | Full ancestor breadcrumb; optional rich description/image/access; children, direct Shops, and obtainable Item groups hide independently; no public verification output. |
| `/shops` | catalogue/utility, RSC | `src/app/shops/page.tsx`; Shop, Location, counts, verification | Route-local GET search over name/description/location; alphabetical name/slug order; no pagination; summary, no-result and clear actions; image/fallback. |
| `/shops/[slug]` | detail, RSC | `src/app/shops/[slug]/page.tsx`; cached Shop query, Location ancestry, Listings/Items/Currencies/verification | Per-page metadata; hierarchy breadcrumb; optional rich description/image; required Location; optional verification; Inventory hidden when empty; stable listing order. |
| `/search?q=` | utility, RSC | `src/app/search/page.tsx`; `searchGameData` runs seven concurrent bounded Prisma queries | GET form; blank query performs no DB search; ten results/type; fixed group order; relation context; actionable no-result state; responsive form/grid. |
| resource `not-found` | system state, RSC | seven `not-found.tsx` files -> `PublicNotFound` | Real 404 response, shared shell, one H1, no sensitive diagnostics. |
| framework loading/error | system state | no application-owned boundary | Browser/framework behavior only; no artificial production failure route may be added for review. |

All page families use `AppShell`, the shared focus rule in `globals.css`, and
the global Manrope font. Item, Recipe, Profession, and Class detail pages use
the DM Serif resource-title treatment. Cards use `Card`/`ContentGrid` except
Recipe output cards, Shop listing cards, and dense linked rows, which have
purpose-built components.

## 4. Shared shell/header/footer architecture

`AppShell` is the single public shell. The header contains one Appearance-backed
logo home link, six ordered navigation destinations (Items, Recipes,
Professions, Classes, Locations, Shops), and a progressively enhanced GET
search to `/search`. `MainNav` uses `usePathname` for segment-aware active state
and `aria-current="page"`. The footer describes all public resource families.

The base container is capped at 1480px, wide details at 1720px, and the landing
container at a responsive 1440–1720px. The sticky header stacks below 1120px.
The shell must remain structurally complete without scenic decoration. Future
markup may replace the implementation, but these landmarks, routes, accessible
names, active state, and single shared ownership must survive.

## 5. Appearance system integration

`SiteAppearance` is a singleton (`id = "site"`). `getPublishedSiteAppearance`
loads it through a cached Prisma query and falls back to committed defaults on
missing data or failures. Managed asset object paths become cache-busted public
URLs. The root layout consumes the favicon; `AppShell` consumes header logo and
the three approved scenic variants:

- home: `/`, independent desktop/mobile crops;
- catalogue: `/items`, independent desktop/mobile crops;
- item detail: `/items/[slug]`, independent desktop/mobile crops.

No other public family is scenic. The custom logo falls back in the resolver
and again client-side on image load error. Scenic backgrounds are decorative,
`aria-hidden`, pointer-inert, finite-height, and cannot determine layout. Admin
Appearance drafts and the admin background never reach public routes.

## 6. Public typography and image rules

Manrope is the shared UI/body font. DM Serif Display is limited to major public
resource titles. One page-level H1 is required. Authored rich-text headings
start at H2/H3.

`ContentImage` accepts trusted database object paths and resolves them through
the storage helper. `next/image` renders genuine content with `object-fit:
contain`, `crisp-edges`, and `pixelated`; fixed stages prevent layout shift.
Card/detail/hero/row display sizes are 96/160/192/48px. Hero stages are 240px.
Fallbacks are textual and keep context-specific geometry; Item catalogue and
Recipe output CSS explicitly restores square fallback stages. Images must never
stretch, crop to fill, or expose a storage secret.

## 7. Catalogue contracts

- Catalogue ordering is deterministic. Items and Recipes add `id` tie-breakers;
  Locations and Shops add `slug`; other legacy catalogues use name only.
- Items and Recipes paginate in server-rendered pages of 12 with Previous/Next
  navigation; there is no infinite scroll.
- Item cards expose only image, name, and Category (or `Uncategorized`). They do
  not expose Tradeable, base value, or description.
- Recipe cards show inherited/custom result imagery, yield, result/category,
  Profession and required level when present, then up to four ingredient chips
  with an accessible disclosure for additional ingredients.
- Remaining catalogue grids use shared linked `Card` components. Empty data is
  explicit on catalogue pages; contextual detail sections hide instead.
- A sparse final row stays grid-aligned and does not stretch through custom
  positional hacks.

## 8. Detail-page contracts

Detail routes resolve by canonical slug and call `notFound()` when absent.
Breadcrumbs use a labelled nav and ordered list where implemented. Optional
descriptions/images use shared renderers. Item and Recipe details expose factual
verification metadata; Profession and Class details expose it in their own
compact verification section; Location deliberately does not; Shop and
individual listings show verification only when present.

Item and Recipe layouts use a main column plus restrained sidebar on desktop,
then stack at 1040px. Profession/Class detail uses a compact identity frame.
Category, Location, and Shop retain the older single-column route-hub pattern.
The future redesign may unify visual structure but may not invent fields,
relationships, verification, or public sections.

## 9. Rich-description contracts

Game Version, Category, Item, Profession, PlayerClass, Location, Currency, and
Shop store normalized versioned JSON in `descriptionRich` plus a synchronized
plain `description` projection. Public pages use `RichTextContent` and never
render raw stored HTML. Allowed output is paragraph, H2/H3, bold, italic,
underline, unordered list/list item, hard break, canonical internal link, and
safe HTTPS external link. Unsupported content is rejected by normalization.
Empty normalized content returns `null`. Long text and URLs wrap.

Internal links render with Next `Link`; external links use an anchor with
`noopener noreferrer`. The current renderer does not force a new tab, so tests
must assert the implemented safe behavior rather than inventing `target`.

## 10. Hide-empty behavior

The following are conditional and leave no empty wrapper/heading:

- Item description, Category label/details, acquisition groups, Shops,
  recipe usages, timestamps.
- Recipe Profession, required level, ingredient section, updated date.
- Profession/Class description/image fallback is retained but recipe preview is
  absent at zero; Profession counts and verification always remain meaningful.
- Category browse link is absent at zero Items.
- Location access facts, children, direct Shops, and obtainable groups.
- Shop description, verification, listing notes, and entire Inventory.
- Search groups with zero matches and catalogue pagination with one page.

Catalogue-level empty and no-result states remain explicit because the absence
is the page result, not optional supporting content.

## 11. Search/filter/pagination contracts

Header and global search are semantic GET forms. Global search trims repeated
or whitespace-only input, avoids database search on blank input, searches seven
resource families, caps each group at ten, and uses fixed group order. Items
filter through `Item.category`; Recipes filter only through
`Recipe.profession`. Unsupported/invalid filter state redirects to a canonical
route. Shops has independent GET search and no pagination. Page-number parsing
is centralized; invalid/out-of-range values resolve to a valid page. Query
links preserve only supported filters.

## 12. Responsive viewport matrix

The source of truth is `src/lib/public-design/viewports.ts`.

| Preset | Size | Primary | Expected behavior |
| --- | ---: | :---: | --- |
| `desktop-1920` | 1920x1080 | yes | Normal bounded desktop shell, grids, and detail sidebars. |
| `desktop-2560` | 2560x1440 | yes | Centered bounded content with approved large-screen density. |
| `ultrawide-3440` | 3440x1440 | yes | No excessive stretch; outer scenic gutters may remain visible. |
| `intermediate-1000` | 1000x1100 | yes | Header wraps; detail sidebar and dense structures reduce/stack. |
| `tablet-768` | 768x1024 | no | Useful transition audit around identity/grid breakpoints. |
| `mobile-390` | 390x844 | yes | Single column, touch-sized controls, wrapped paths/labels, no overflow. |

Verified CSS breakpoints include 1120 (header), 1260 (landing), 1180/680
(Recipe grids), 1040 (detail sidebar), 820 (lower detail grids), 760
(identity panels), 620 (mobile scenic/shop cards), and 520 (long titles and
dense rows). Acceptance follows behavior, not those incidental values.

## 13. Accessibility requirements

- Exactly one H1 per public page; rich content begins below it.
- Preserve header, main, footer, search, navigation, breadcrumb, list, and
  article semantics.
- Every interactive element is keyboard reachable with a visible gold focus
  outline; no nested interactive elements.
- Active filters/nav expose `aria-current`; disabled pagination is not a link.
- Linked rows have meaningful composite names; decorative arrows/images are
  hidden where appropriate and content images have contextual alt text.
- Scenic layers are absent from the accessibility tree.
- Ingredient tooltips work on hover and focus, stay within narrow viewports,
  and reduced motion removes movement.
- Search/result feedback and loading/error states are announced without
  producing duplicate landmarks or H1s.
- Touch targets remain at least 44px where the current component contract
  specifies interactive controls.

## 14. Required fixture states

Fixture IDs and targeted states live in the public-design fixture manifest.
The matrix must cover populated, sparse, dense, no-image, long-name,
long-rich-text, semantic formatting/links, verified/unverified, relationship
extremes, Item acquisition/use/listings, Recipe ingredient/yield/image
inheritance, Profession pagination/preview counts, all Location types and deep
hierarchy, Shop inventory/currencies, Class/Category/Currency sparsity, empty
catalogues/filters/search, invalid filters, and not-found slugs. Loading/error
states are included only where they exist safely; no production-only failure
switch may be introduced.

All fixture slugs/names use the `design-review-` / `Design Review -` prefix.
Setup is idempotent and transactional; cleanup matches exact IDs/prefixes and
never deletes ordinary developer data. Production seed behavior is unchanged.
`pnpm public:design:fixtures setup` creates 2 Categories, 18 Items, 14 Recipes,
3 Professions, 2 Classes, 7 hierarchical Locations (one of every enum type),
2 Shops, 2 Currencies, 5 Acquisition Sources, and 13 Shop Listings in the
guarded isolated test database. `status` reports only prefixed rows and
`cleanup` removes them in foreign-key-safe order. One exact prefixed Storage
object supplies deterministic genuine/custom/inherited image states; it is
uploaded through the authenticated test client and removed by exact path.

## 15. Redesign import order

1. **Freeze/export external design:** screenshots, hierarchy, assets, fonts,
   tokens, responsive states, and unresolved decisions.
2. **Branch/baseline:** start from pushed `main`; run `pnpm
   test:public-design`; capture the current registered matrix.
3. **Tokens/primitives:** introduce approved tokens and map existing
   primitives without route rewrites.
4. **Shared shell:** header, footer, container, scenic integration, search.
5. **Representative pages:** one catalogue and one detail through every fixture
   and viewport.
6. **Resource rollout:** Items, Recipes, Professions, Classes, Categories,
   Locations, Shops, utility/system states.
7. **Accessibility/responsive hardening:** keyboard, focus, overflow, reduced
   motion, primary viewports.
8. **Final regression:** focused command, full capture, selected broader tests;
   decide separately whether the complete E2E suite is warranted.

## 16. Recommended branch/commit strategy

Start each slice from the latest pushed commit. Fetch and record branch, HEAD,
local/live origin, divergence, staged files, tracked changes/deletions, and
untracked files. Restore generated `next-env.d.ts` drift. Use small focused
commits and push each verified slice. Never run two agents against the same
working tree. Preserve unrelated work and leave `.claude/` untouched.

## 17. Visual acceptance checklist

- [ ] Shell, logo, nav, search, footer, and one H1 are present.
- [ ] Appearance assets/crops match the selected contract and fall back safely.
- [ ] Content remains bounded at 1920/2560/3440 and usable at 1000/390.
- [ ] Long names, descriptions, paths, quantities, and prices wrap without
  obscuring actions.
- [ ] Genuine images preserve ratio and sprite crispness; fallbacks keep stage
  geometry.
- [ ] Empty optional sections are absent; true empty results are explicit.
- [ ] Rich headings/lists/marks/links are semantic and readable.
- [ ] Dense and sparse relationship layouts remain balanced.
- [ ] Focus, hover, active, loading, and preview-error states are visible.
- [ ] `scrollWidth <= clientWidth` at every primary viewport.

## 18. Functional regression checklist

- [ ] Every registered route resolves its representative fixture.
- [ ] Unknown detail slugs return the shared 404.
- [ ] Item Category and Recipe Profession filters canonicalize invalid input.
- [ ] Pagination keeps supported filters and correct Previous/Next state.
- [ ] Global and Shop search preserve blank/no-result/result behavior.
- [ ] Item acquisition, Recipe ingredients/results, Profession previews,
  Location hierarchy/groups, and Shop inventory use canonical links.
- [ ] Verification and dates appear only on routes that currently expose them.
- [ ] Appearance-managed logo/favicon/scenic assets and fallbacks resolve.
- [ ] Admin Design Review remains authenticated, allowlisted, and read-only.

## 19. Performance considerations

Normal public bundles must not import admin review UI. Registry metadata stays
small and database-free. Design Review loads one selected contract/fixture/
viewport and one iframe, never the full matrix. Capture runs sequentially or
with restrained concurrency. Search is bounded to ten per family; pagination
queries are bounded. Preserve React caching on Shop detail metadata/page data
and the cached Appearance resolver. The legacy Profession/Category catalogue
over-fetching is a known replaceable implementation, not a behavior contract.

## 20. Known implementation risks

- Public pages mix inline token styles with large legacy global CSS; a redesign
  can accidentally preserve only one side of the system.
- There is no public error/loading boundary to preview honestly.
- Category/Profession indexes fetch full relations to build descriptions.
- Some detail families use newer wide compositions while Category/Location/
  Shop use the older route-hub structure.
- Verification visibility differs by resource and must not be generalized.
- Managed asset URLs can resolve but later fail in the browser; logo has a
  second fallback, scenic CSS relies on its committed fallback layer.
- Rich external links are safe but do not currently open a new tab.
- Fixture density can stress the shared isolated test database; cleanup and
  serial execution are mandatory.
- Next development/build commands rewrite `next-env.d.ts`; restore it before
  commits.

## 21. Explicit non-negotiable product rules

1. Merchants Codex remains crafting/trading focused.
2. Desktop is primary; mobile remains usable and accessible.
3. Current fallback presentation is charcoal with restrained gold until an
   approved redesign replaces it.
4. Appearance-managed assets are authoritative and committed assets are safe
   fallbacks.
5. Optional public sections obey hide-empty.
6. Images preserve aspect ratio; sprites remain crisp; fallbacks preserve
   intended geometry.
7. Item cards stay simpler than Recipe cards unless an approved product
   decision changes that contract.
8. Recipe cards expose current Profession/level/ingredient contracts.
9. Internal links use canonical public routes; rich text is safe and semantic.
10. Verification/build metadata remains available exactly where the current
    public contract exposes it.
11. Admin and public data/interaction concerns remain separated.
12. Pre-release/protected PokeForce assets are not reused without permission.
13. PlayerClass stays independent from Recipe and Category.
14. No invented data, mechanics, completeness claims, or production mutations.

## 22. Final merge-readiness checklist

- [ ] Dossier, contracts, acceptance matrix, viewports, and fixture manifest
  agree on IDs/routes.
- [ ] Fixture setup/cleanup integration tests pass against the guarded test DB.
- [ ] Admin authentication and preview allowlist tests pass.
- [ ] Focused unit/component/browser/Appearance/overflow checks pass through
  `pnpm test:public-design`.
- [ ] One filtered and one representative multi-route capture completed; output
  and credentials are absent from Git.
- [ ] Targeted ESLint, `pnpm exec tsc --noEmit`, production build, Prisma
  validation, and `git diff --check` pass.
- [ ] `next-env.d.ts` is restored; tracked tree is clean; nothing is staged;
  `.claude/` is untouched.
- [ ] HEAD, local origin, and live origin are aligned after every pushed slice.
- [ ] Public visual design did not change during readiness work.
- [ ] The complete E2E suite was intentionally not run.

The current reusable foundations are classified as follows:

| Foundation | Classification | Integration guidance |
| --- | --- | --- |
| Canonical routes, Prisma relations, query bounds, hide-empty, safe rich text | behavioral contract | Preserve. |
| `AppShell`, `ContentImage`, `RichTextContent`, catalogue helpers, verification formatter | reusable structural primitive | Reuse or replace behind equivalent focused tests. |
| Charcoal/gold tokens, DM Serif/Manrope scale, borders/radii/shadows, current grid proportions | replaceable visual style | Change only with approved redesign evidence. |
| Inline styles, legacy generic `Card` catalogues, mixed detail-page structures | legacy/replaceable implementation | Migrate incrementally; do not freeze incidental CSS. |
| Managed Appearance resolver and public/admin boundary | behavioral and security contract | Preserve authority, fallbacks, and isolation. |
