# Handoff: Merchants Codex

## Overview

Merchants Codex is a 16-screen reference site — a trader's field guide to a Pokémon-style
region. It answers three questions for a player: *what is this thing*, *who makes or sells
it*, and *what is it used for*. Seven entity types (items, recipes, professions, classes,
locations, shops, NPCs) each get a **directory** (searchable, filterable, grid/list) and a
**detail page**, cross-linked so any entity mentioned anywhere is a link. A landing page
and a World Navigation overview sit on top.

Total content: **188 entries** — 37 items, 68 recipes, 9 professions, 5 classes,
30 locations, 18 shops, 21 NPCs.

## About the design files

The `.dc.html` files in this bundle are **design references written in HTML** — working
prototypes that show intended look, motion and behavior. They are **not production code to
copy**. The task is to recreate these designs in the target codebase using its existing
framework, component library and conventions (React/Vue/Svelte/native — whatever is
already there). If no codebase exists yet, pick the framework that fits the project and
implement the designs there.

Each file opens standalone in a browser (they need the sibling `support.js`, which is the
prototype runtime — do **not** port it). Read them for structure, exact values and
interaction detail; ignore their templating mechanics.

## Fidelity

**High fidelity.** Colors, typography, spacing, radii, motion timings and copy are final.
Recreate the UI as closely as the target stack allows. The only deliberately unfinished
areas are listed under *Known gaps* at the end.

## Design tokens

### Color

| Role | Value |
|---|---|
| Page background | `#111514` |
| Card / panel surface | `#171b19` |
| Raised / hover surface | `#1c201e` |
| Menu surface | `#191d1b` |
| Inset row (inventory) | `#0f1210` |
| Art-frame interior | `#141715` |
| Menu item hover | `#23281f` |
| Border, default | `#262b27` |
| Border, chrome & art frames | `#3a3528` |
| Border, hover (mid) | `#4a4536` |
| Accent gold (primary) | `#d8b562` |
| Accent gold (muted / labels) | `#c39a4b` |
| Accent gold (bright numeric) | `#f4c542` |
| Gold hover fill (CTA) | `#e0c079` |
| Text primary | `#eee7d8` |
| Text body | `#c8c2b4` |
| Text secondary | `#aaa69c` |
| Text meta | `#8a8579` |
| Text meta dim | `#7d796f` |
| Placeholder | `#6f6b61` |
| Divider inside menus | `#2a2f28` |

Translucent recipes used repeatedly:
`rgba(17,21,20,0.92)` header panel · `rgba(15,18,16,0.58)` sprite-overlay badge ·
`rgba(195,154,75,0.12)` gold pill fill · `rgba(195,154,75,0.35)` gold pill border ·
`rgba(195,154,75,0.55)` quantity-bubble border · `rgba(216,181,98,0.22)` hover glow ·
`radial-gradient(circle at 30% 22%, rgba(195,154,75,0.14), transparent 62%)` art-frame sheen.

Selection: `::selection { background:#c39a4b; color:#111514 }`.

### Typography

- **Display**: Cormorant Garamond 700 (Google Fonts). Landing hero 92px/1.0; page titles
  22px; detail-page entry names 40px (auto-shrunk to keep one line); section headings 26px
  on landing, 22px elsewhere; large stat numerals 26px.
- **UI**: Manrope 400/500/600/700 (Google Fonts).
- Scale in use: 8–8.5px (micro badge), 9.5–10.5px (uppercase labels, meta), 11.5–12px
  (secondary body), 12.5–13.5px (nav, rows, card titles), 15–15.5px (lead paragraph).
- Uppercase labels: 700 weight, `letter-spacing` .05em (inline labels) to .12em
  (section eyebrows) to .22em (landing eyebrow).
- Card titles clamp to one line (`white-space:nowrap; overflow:hidden; text-overflow:ellipsis`)
  and step down by name length: ≥26 chars → 11px, ≥20 → 12px, else 13.5px (grid);
  detail heroes 40 → 34 → 28px by the same idea.
- `text-wrap: pretty` on descriptive paragraphs.

### Spacing, radius, elevation

- Page container `max-width:1760px`, horizontal padding 28px.
- Radii: 14px cards/panels/header, 10–11px art frames and rows, 8–9px controls and
  inputs, 5–7px sprite tiles, 999px pills.
- Gaps: 12–14px between cards, 8px between list rows, 16–28px between page regions.
- Shadows: `0 8px 24px rgba(0,0,0,0.35)` header · `0 10px 24px rgba(0,0,0,0.45)` popovers ·
  `0 16px 32px rgba(0,0,0,0.5)` nav dropdown · hover glow
  `0 0 0 1px rgba(195,154,75,0.3), 0 0 20px rgba(216,181,98,0.22)`.
- Every page sits on a fixed full-bleed background photo (`assets/background.png`,
  `object-fit:cover`, `object-position:60% 40%`, opacity .9) under two scrims:
  a vertical gradient `rgba(17,21,20,.55) → #111514` and a radial vignette.

### Motion

| Name | Spec | Used for |
|---|---|---|
| `cx-item-in` | `opacity 0→1, translateY(-4px→0)`, 220ms `cubic-bezier(.2,.9,.3,1)` | list/grid card entrance, menu items |
| `cx-item-out` | reverse, 120ms ease | closing a collapsed section |
| `cx-fade-in-stagger` | `translateY(-6px→0)`, 320ms ease | detail-page card sections |
| `cx-menu-in / out` | scaleY .92→1 + fade, 200/180ms | nav dropdown, filter popovers |
| `cx-panel-in / out` | scaleY .92→1 + fade, 200/180ms | ingredient overflow panel |
| `cx-line-sweep` | `scaleX 0→1` from left, 350ms ease | gold rule beside section headers |
| `cx-rise` | `translateY(10px→0)` + fade, 500ms | landing hero |
| `cx-logo-breathe` | drop-shadow pulse, 3.2s infinite | logo on hover |
| `cx-search-pulse` | expanding soft ring, 1.6s infinite | search field on hover only |

**Stagger rule (important):** each card's `animation-delay` is computed from its **index in
the data array** — `Math.min(index * 30, 330)`ms (45ms step on the landing page) — and set
inline. Do *not* derive it from DOM position (`:nth-child`): position-based delays desync
when a list remounts, which made the last row appear before the first when toggling
grid ⇄ list. Some prototype files still carry `:nth-child` rules as a leftover fallback;
implement the index-based version only.

Hover transitions are 150–220ms ease on `border-color`, `background-color`, `box-shadow`,
`transform`, `color`.

## Shared chrome

**Header** (every page). `max-width:1760px`, `padding:10px 22px`, background
`rgba(17,21,20,0.92)` + `backdrop-filter:blur(10px)`, 1px `#3a3528` border, 14px radius,
`grid-template-columns:auto 1fr auto`:

1. Logo (`assets/merchants-logo.png`, 66px tall, negative 13px vertical margin so it
   overhangs the bar), links home, breathes on hover.
2. Center nav: Items · Recipes · Professions · Classes, then a **World** dropdown
   (chevron rotates 180°). Links are 12.5px/600 with a 2px bottom border — transparent
   normally, `#c39a4b` plus a gold text-shadow on hover; the active section shows gold
   text and a gold border. The dropdown (230px, 12px radius, `#191d1b`) lists World
   Navigation (with a gold "Recommended" chip), Locations, Shops, NPCs — each a title plus
   a 10px description. It closes on outside click via a capture-phase document listener.
3. Search field, 230px, `#171b19`, 9px radius. On hover it pulses; on focus the border
   goes gold with a 3px ring and the magnifier icon turns gold.

On the landing page the header is `position:sticky; top:0` inside a band whose own
background fades `#111514 → transparent`, so content scrolls out of view behind it.
Directory pages are fixed-height shells (`height:100vh`, internal scroll) so their header
never moves.

**Breadcrumb**, directly under the header: `Home / World / Section` or
`Home / Section / Entry`, 12.5px, `#aaa69c` links with `#3a3528` slashes and a
`#d8b562` current segment. Links animate on hover: color to gold plus a 1px gold underline
sweeping in from the left (`::after`, `transform:scaleX(0→1)`, 180ms).

**Scrollbars** are hidden (`scrollbar-width:none`) on internal scroll areas.

## Screens

### 1. Landing (`Landing Page.dc.html`)

Full-page scroll. Sticky header, then:

- **Hero**, centered, 96px top padding: gold eyebrow "A TRADER'S FIELD GUIDE TO JOHTO"
  flanked by two 38px gradient rules; 92px serif title "Merchants Codex"; 15.5px lead
  paragraph (max 660px); two CTAs — primary gold pill "Browse the Codex" with arrow icon
  (hover: lightens to `#e0c079`, gold glow), ghost "Explore the World"
  (`rgba(23,27,25,.72)` + `#3a3528`, hover gold border); then four stats (188 Entries,
  68 Recipes, 18 Vendors, 2 Regions) as 26px serif gold numerals over 9.5px uppercase labels.
  Whole block plays `cx-rise`.
- **"Start Anywhere"** — serif heading plus sweeping rule, then `auto-fill minmax(300px,1fr)`
  cards, one per directory: 66px art frame with a 44px sprite, title, gold count pill,
  12px blurb, and an arrow that fades and slides in on hover. Cards lift 2px, border goes
  gold with glow. Entrance staggers 45ms per card.
- **Lower band**, `1.35fr 1fr`: left, "Recently Updated" — six rows (44px sprite tile,
  name, uppercase kind, right-aligned change note); on hover the row background lifts,
  border goes gold and left padding grows 14→16px, nudging content right. Right: a
  "How the Codex Works" panel (three numbered steps in 22px gold-bordered squares) and a
  "Crafting Chains" promo card with a radial gold sheen that survives hover.
- **Footer**: 11.5px credit line plus the four nav links using the breadcrumb hover.

### 2. Directories (Items, Recipes, Professions, Classes, Locations, Shops, NPCs)

One shared skeleton, `height:100vh`, no page scroll:

- Page title (22px serif) and count.
- **Toolbar row**: wide search input ("Find an item by name…"), a **Filter** dropdown
  (checkbox list of categories/professions/types/roles in a 340px, 2-column popover; the
  button and its icon turn gold when filters are active), and a right-aligned
  **Grid / List** segmented toggle (active segment `#23281f` + gold icon).
- **Content area**, internal scroll, and an **Overview** panel on the right (`#171b19`,
  gold uppercase title, label/value rows) — e.g. Items Overview: Total Items 37,
  Categories 8, Verified Entries 31, Recently Updated 6.
- **Grid view**: `auto-fill minmax(148–320px, 1fr)`, 12–14px gaps. Item cards are
  square art frame + title + uppercase category + 2-line clamped description with a
  tooltip when truncated + source footer. Recipe cards add a translucent "YIELDS n" badge
  over the art and a row of ingredient sprites.
- **List view**: 8px-gapped rows, fixed column widths (44px sprite, 110–150px name,
  80px meta, 55px numeric, remainder for ingredients), with a small uppercase column header.
- Locations, Shops and NPCs group rows under **collapsible region/type headers**
  (chevron rotates −90°→0°, contents stagger in).
- Lists load 24 at a time via an IntersectionObserver sentinel; filtering resets to 24.
- Empty state: centered "No items found" with a "Clear filters" action.

### 3. Detail pages (Item, Recipe, Profession, Class, Location, Shop, NPC)

Page-scroll layout, `padding:28px 28px 80px`, no sidebar:

- **Hero**: large art frame (180px for recipes, 128px sprite inside) beside the entry
  name at 40px serif, a one-line summary, and a row of **info chips** — `Profession:`,
  `Type:`, `Region:`, `Location:`, `NPC:` — each a link with a gold hover glow, an
  animated caret sliding in and a brightening border. Recipe heroes carry the
  translucent "YIELDS" badge bottom-right of the art.
- **Collapsible sections** (Used In, Related Items, Ingredients, Recipes, Inventory,
  Details, Traveler's / Merchant's Note): header is an uppercase gold label plus chevron
  plus a gold rule that sweeps out; contents stagger in and reverse out on collapse.
  Sections with lists repeat the directory's Grid/List toggle and card designs verbatim.
- **Ingredient rows** (Recipe Detail) are bordered pills: 40px sprite, name, `×qty`
  right-aligned, gold hover glow, each row a link to that item.
- **Inventory rows** (Shop Detail) are inset `#0f1210` rows with price, stock and a
  selected state.
- **Grid recipe cards** show 3 ingredient sprites (36px, 6px gaps) plus a 24px `+N`
  button; clicking it opens a "Recipe Ingredients" popover listing every ingredient at
  24px with `×qty`. List rows show as many sprites as fit and use the same `+N` overflow.

### 4. World Navigation (`World Navigation.dc.html`)

Region tree on the left, selected-region panel on the right: 110px region art, name,
description, then chip groups for NPCs Present, Shop / Vendor and Notable Items Found Here.

## Interactions & behavior

- **Navigation** is page-to-page with query strings: `?item=`, `?recipe=`, `?profession=`,
  `?class=`, `?location=`, `?shop=`, `?npc=`, each value `slugify(name)`
  (lowercase, non-alphanumerics → `-`). Unmatched slugs fall back to the first entry —
  replace that with a real 404/empty state.
- **Search** filters the current directory client-side on every keystroke (name match,
  case-insensitive) and resets pagination. The header search is decorative in the
  prototype; the landing page routes Enter to the Items directory. A real global search
  index is out of scope here.
- **Filters** are multi-select checkboxes, OR within a facet, AND across facets; the
  popover closes on outside click; "Clear filters" resets search + facets + pagination.
- **Grid/List** choice is per-section state, not persisted.
- **Collapsible sections** animate open/closed with a ~180ms close timer before unmount,
  so the reverse animation is visible.
- **Tooltips**: truncated descriptions and ingredient sprites show a small dark tooltip on
  hover (first item left-aligned, others centered) — hover only, `pointer-events:none`.
- **Ingredient overflow panels** and dropdowns raise their card's `z-index` to 40 while open.
- Layouts assume ≥1280px desktop. No responsive breakpoints were designed.

## State

Per directory: `searchQuery`, `selected<Facet>[]`, `viewMode: 'grid'|'list'`,
`loadedCount` (24-step pagination), `collapsedFolds{}` + `closingFolds{}`, `worldMenuOpen`
+ `worldMenuClosing`, `filterOpen`, `hoveredDesc`, `truncatedByName{}` (from a
ResizeObserver that detects clamped text).

Per detail page: one `<section>Open` + `<section>Closing` pair per collapsible section,
`viewMode` per list section, `expandedRecipes{}` + `closingRecipes{}` for ingredient
popovers, `hoveredIng`, plus `worldMenuOpen/Closing`.

Data needs are read-only: fetch the seven collections, resolve one entry by slug on detail
pages, and resolve cross-references (a recipe's ingredients → items; a profession → its
recipes; a shop → its location, NPC and inventory items).

## Data

`codex-data.js` is the **canonical dataset** — all seven collections plus the sprite maps
(`SPR`, `RENDERED`), `ing()`, `sizesFor()`, `slugify()` and `COUNTS` / `TOTAL_ENTRIES`.
Build the implementation against this shape (or map it onto the real API).

Note the prototypes each inline their own copy of the arrays they need, and two of those
copies are incomplete (see gaps 1–2). Trust `codex-data.js` over the per-page copies.

Shapes:

- **Item** `{ name, category, description, source, price?, image }`
- **Recipe** `{ name, profession, level, image, ingredients: [{name, image24…60, qty}], outputRange, exp }`
- **Profession** `{ name, type, description, recipeCount, maxLevel, image }`
- **Class** `{ name, focus, description, image, … }`
- **Location** `{ name, region, type, description, image, … }`
- **Shop** `{ name, type, location, region, npc, inventory[], … }`
- **NPC** `{ name, role, location, region, description, … }`

## Assets

- `assets/background.png` — full-bleed backdrop, every page.
- `assets/merchants-logo.png` — wordmark, 66px in the header, 72px on the landing hero.
- `assets/sprites/*.png` — 8 source item sprites (chipped-pot, comet-shard, dusk, ether,
  gigaton, net, paralyze-heal, x-speed). Pixel art, from the game's item icons — swap in
  the project's own licensed art if these are placeholders for you.
- `assets/sprites/rendered/*.png` — the same 8 sprites **pre-rendered at 24, 26, 36, 40,
  44 and 60px** (48 files).

**Sprite rendering rule:** always draw a sprite as a `<div>` with `background-image`,
`background-size` and explicit pixel `width`/`height` matching a pre-rendered size, plus
`image-rendering: pixelated`. Never scale a sprite at runtime and never use an `<img>` with
a templated `src`. Both caused visible shimmer/flicker during development; pre-rendering at
exact sizes fixed it. If the real app can render pixel art crisply at arbitrary sizes
(e.g. a nearest-neighbour image pipeline), that constraint can be relaxed — but keep
`image-rendering: pixelated`.

Fonts: Cormorant Garamond and Manrope via Google Fonts. No icon library — all icons are
inline SVG strokes at `stroke-width:2–2.5`, `currentColor`.

## Files in this bundle

| File | Screen |
|---|---|
| `Landing Page.dc.html` | Landing |
| `World Navigation.dc.html` | World overview |
| `Items Directory.dc.html` / `Item Detail.dc.html` | Items |
| `Recipes Directory.dc.html` / `Recipe Detail.dc.html` | Recipes |
| `Professions Directory.dc.html` / `Profession Detail.dc.html` | Professions |
| `Classes Directory.dc.html` / `Class Detail.dc.html` | Classes |
| `Locations Directory.dc.html` / `Location Detail.dc.html` | Locations |
| `Shops Directory.dc.html` / `Shop Detail.dc.html` | Shops |
| `NPCs Directory.dc.html` / `NPC Detail.dc.html` | NPCs |
| `codex-data.js` | Canonical dataset + helpers |
| `support.js` | Prototype runtime — reference only, do not port |
| `assets/` | Background, logo, sprites, pre-rendered sprites |

To view a prototype, open its `.dc.html` in a browser with `support.js` and `assets/`
alongside it.

## Known gaps

1. `Item Detail` inlines only 8 of the 37 items — the other item links resolve to the
   first entry. Reading from `codex-data.js` fixes it with no new content.
2. `Shop Detail` inlines only 6 of the 18 shops — same fallback behavior, same fix.
3. `Profession Detail` uses its own 11-recipe pool instead of filtering the canonical
   `RECIPES` by profession. Names were aligned so links resolve; it should filter.
4. Landing page hero counts are computed from literals; use `COUNTS` / `TOTAL_ENTRIES`.
5. Leftover `:nth-child` stagger CSS still sits alongside the index-based delays in some
   files — implement only the index-based one.
6. Desktop only (≥1280px). Mobile needs real work: the fixed-height directory shells,
   two-column bands, grid/list toggles and filter popovers all assume width.
7. No loading or error states; empty states exist only for "filtered to zero".
8. Search is per-page and name-only. No global search, no fuzzy matching, no sorting
   controls (lists render in data order).
