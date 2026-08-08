# Slice 0 mapping — Claude Design handoff → production repository

Written 2026-08-08 on `overhaul/claude-design-integration` (branched from `main` @
`88cd538906d1bb54acf0318f36ef352e11701a2d`, tagged `pre-claude-public-overhaul-v1`).
Audit-only; no visual changes were made in this slice.

## 1. Screen → production route mapping

| Handoff screen | Production route(s) | Status |
|---|---|---|
| `Landing Page.dc.html` | `/` — `src/app/page.tsx` | Exists, needs redesign (Slice 3) |
| `World Navigation.dc.html` | none yet | No dedicated `/world` route exists. Slice 9 gate — implement only with truthful entities (Location hierarchy is real; region/NPC framing in the mock is not) |
| `Items Directory.dc.html` / `Item Detail.dc.html` | `/items`, `/items/[slug]` | Exists (Slice 4/5) |
| `Recipes Directory.dc.html` / `Recipe Detail.dc.html` | `/recipes`, `/recipes/[slug]` | Exists (Slice 6) |
| `Professions Directory.dc.html` / `Profession Detail.dc.html` | `/professions`, `/professions/[slug]` | Exists (Slice 7) |
| `Classes Directory.dc.html` / `Class Detail.dc.html` | `/classes`, `/classes/[slug]` | Exists — `PlayerClass` is a fully established resource per CLAUDE.md (Slice 7) |
| `Locations Directory.dc.html` / `Location Detail.dc.html` | `/locations`, `/locations/[slug]` | Exists — Milestone 10 Route Hubs (Slice 8) |
| `Shops Directory.dc.html` / `Shop Detail.dc.html` | `/shops`, `/shops/[slug]` | Exists — Milestone 11 (Slice 8) |
| `NPCs Directory.dc.html` / `NPC Detail.dc.html` | **none** | **Domain gap — see §3.** No `NPC` model in `prisma/schema.prisma` anywhere; only the legacy `NPC_OR_SHOP` `AcquisitionSourceType` enum value. Do not implement (Slice 9 gate). |

Other production public routes with no handoff screen (unaffected by this redesign except
through the shared header/shell): `/categories`, `/categories/[slug]`, `/search`, `/login`,
`/access-denied`, `/account`, `/account/password`.

## 2. Domain gaps — do not invent schema for these

- **NPC**: no model, no route, no admin surface. The handoff's Shop Detail hero shows an
  `NPC:` info chip and World Navigation shows "NPCs Present" chip groups — both reference an
  entity that does not exist in production. Per the overhaul instructions, Slice 8 (Shops)
  must omit the NPC chip entirely (hide-empty, not fake), and Slice 9 must leave NPC
  directory/detail unimplemented and documented, not stubbed.
- **World Navigation "region"**: the handoff's World screen assumes a region tree
  (Johto/Kanto-style) with NPCs-present/shop-vendor/notable-items chip groups. Production's
  real hierarchy primitive is `Location.parent` (containment, not regions — see the Milestone
  10 CLAUDE.md rule that hierarchy means containment, not adjacency). Slice 9 must build World
  Navigation only from real Location containment + real Shop/AcquisitionSource relationships,
  never from invented region/NPC concepts.
- **Shop `type`, `role`, Location `region`**: the handoff dataset (`codex-data.js`) shapes
  (`Shop.type`, `NPC.role`, `Location.region`) are prototype-only conveniences. Confirm each
  against the actual Prisma schema per field before using it in a directory filter — do not
  assume the mock shape exists on the real model.

## 3. Design tokens — reconciliation

Current `src/lib/design-tokens.ts` + `globals.css` `:root` already carry a gold/charcoal
palette nearly identical to the handoff (very likely descended from the same design
direction as the incomplete `design-checkpoints/claude-public-redesign-01/` pass). Delta to
close in Slice 1:

| Token | Current (`designTokens.colors`) | Handoff | Action |
|---|---|---|---|
| Page background | `#111514` | `#111514` | Match — no change |
| Panel surface | `#171b19` | `#171b19` | Match — no change |
| Raised surface | `#1c201e` (`surfaceSoft`) | `#1c201e` | Match — no change |
| Default border | `#3a3528` (`border`) | `#3a3528` is handoff's *chrome/art-frame* border; handoff's *default* border is `#262b27` | Current token conflates the two — Slice 1 should add a distinct default-border token |
| Accent | `#c39a4b` (`accent`) | handoff calls `#c39a4b` "muted/labels" and `#d8b562` "primary" | Naming is inverted vs. handoff; reconcile role, don't just rename |
| Bright numeric gold | — | `#f4c542` | Missing — add |
| Menu surface | — | `#191d1b` | Missing — add |
| Inset row (inventory) | — | `#0f1210` | Missing — add |
| Art-frame interior | — | `#141715` | Missing — add |
| Text tiers | `text` / `textMuted` only | primary/body/secondary/meta/meta-dim/placeholder (6 tiers) | Current has 2 of 6 — add the rest |

No purple admin accent exists anywhere in the current codebase (Slice 9H of Milestone 9
already retired it in favor of the same gold token) — the overhaul handoff's assumption of a
"purple admin vs. gold public" split does not apply; admin and public already share one gold
identity. This redesign only touches public surfaces regardless.

**Fonts**: `src/app/layout.tsx` currently loads `DM_Serif_Display` + `Manrope` via
`next/font/google`. Handoff spec is Cormorant Garamond 700 (display) + Manrope 400/500/600/700
(UI). Manrope already matches. Slice 1 swaps `DM_Serif_Display` → `Cormorant_Garamond` using
the same `next/font/google` strategy (no CDN `<link>` tags, no layout-shift regression).

## 4. Reusable production primitives already in place

- `src/components/layout/app-shell.tsx` (`AppShell`) — server component, calls
  `requireOrdinarySiteAccess()`, loads Appearance data, renders header/nav/scenic background.
  This is the correct integration point for the new header/World-dropdown/scenic-shell work
  in Slice 1–2, not a new shell.
- `src/components/layout/main-nav.tsx` (`MainNav`), `src/components/layout/page-header.tsx`
  (`PageHeader`), `src/components/layout/public-logo.tsx` (`PublicLogo`),
  `src/components/layout/public-not-found.tsx` — existing shared chrome to evolve, not
  replace.
- `src/components/ui/card.tsx` (`Card`), `src/components/ui/content-grid.tsx`
  (`ContentGrid`), `src/components/ui/empty-state.tsx` (`EmptyState`) — already shared across
  directory pages (confirmed via `classes/page.tsx` and `shops/page.tsx`, both import the same
  three). Slice 4's "shared directory framework" work extends these rather than starting from
  zero — no per-page markup duplication was found to clean up.
- No dedicated breadcrumb or footer component exists yet — both are net-new in Slice 1/2,
  built as shared primitives per the handoff's breadcrumb/footer spec.
- `src/lib/search/global-search.ts` — real server-side Prisma search (name/description +
  relational matching, 10-per-type cap), already used by `/search`. This is the production
  search Slice 2's header search field must call; the handoff's per-page name-only client
  filtering (README "Known gaps" §8) is prototype-only and must not be copied in.
- `src/lib/appearance/public.ts` (`getPublishedSiteAppearance()`) — the existing
  Appearance-aware scenic-background resolver `AppShell` already calls. Slice 1's scenic shell
  work must route through this, never hardcode `assets/background.png` as a bypass.
- `src/app/admin/design-review/` + `PUBLIC_REDESIGN_INTEGRATION.md` +
  `src/lib/public-design/contracts.ts` — an existing design-fixture/capture harness
  (`pnpm public:design:fixtures`, `pnpm public:design:capture`, `pnpm test:public-design`,
  `e2e/public-design-contracts.spec.ts`). Slice 11's visual comparison/regression audit should
  use this harness rather than building a second one.

## 5. Asset policy

- `design-checkpoints/claude-public-redesign-02-production-handoff/source/design_handoff_merchants_codex/assets/`
  (background, logo, 8 sprites + 48 pre-rendered sizes) is preserved as **reference only** —
  not wired into any route.
- The Merchants logo and scenic background are managed at runtime through the Appearance
  system (`SiteAppearance` DB record, admin-uploaded) per §4 above — the handoff's static
  `assets/merchants-logo.png` / `assets/background.png` may be used as the *default* Appearance
  asset if/when an admin explicitly sets it, but no code path may hardcode them as a bypass of
  Appearance.
- Sprite assets (`assets/sprites/*.png`, pre-rendered at 24/26/36/40/44/60px) are prototype
  placeholder pixel art for 8 specific items (chipped-pot, comet-shard, dusk, ether, gigaton,
  net, paralyze-heal, x-speed) — explicitly flagged in the handoff README as placeholders to
  swap for the project's own licensed art. Production already has its own
  `ContentImage`/storage convention (`src/components/content/content-image.tsx`); these
  prototype sprites are not gameplay-ready assets and must not be published as real item
  artwork. The handoff's "always pre-render pixel art at exact sizes, never scale at runtime"
  rule should still inform how production sprite-style imagery (if any) is rendered, per
  CLAUDE.md's crisp-pixel-art requirement.

## 6. Prior checkpoint relationship

`design-checkpoints/claude-public-redesign-01/` (on `design/claude-public-redesign-checkpoint-1`,
not yet merged) is an earlier, partial (5-screen) pass at the same design direction — its own
README states it was never connected to Prisma/routing/Appearance/auth. It remains valid
prior-art reference (particularly `notes/visual-decisions.md`); this checkpoint (`02`)
supersedes it as the authoritative, complete 16-screen source for the current rollout.

## 7. Slice sequencing note

Given how close the current token set already is to the handoff, Slice 1 is expected to be a
reconciliation/extension pass (add missing tokens, swap the display font, add scenic-shell
plumbing through Appearance, add breadcrumb/motion primitives) rather than a from-scratch
palette rebuild. This does not change the overall 12-slice sequence defined in the overhaul
handoff.
