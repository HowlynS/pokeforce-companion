# Merchants Codex Design Direction

## Purpose

Merchants Codex is a desktop-first crafting and trading reference for the
PokeForce MMO. It is not a generic Pokémon wiki.

Public pages should feel like a polished in-world game codex: structured,
readable, slightly warm, restrained, sprite-friendly, and optimized for quick
reference across dense, linked gameplay data. The product must not resemble a
generic SaaS dashboard. Its visual language may feel Pokémon-friendly without
copying or imitating any specific official Pokémon interface.

This document is the human-readable source of truth for product identity,
visual rationale, governance, constraints, and design review. The concise
operational memory used by Interface Design is
`.interface-design/system.md`. That file records implementation-facing tokens
and reusable patterns; it does not replace this broader rationale.

Meaningful design changes must update both documents in the same focused
commit.

## Design Authority

Use this order of authority:

1. The archived Claude Design production handoff for visible public-page
   presentation and geometry.
2. Production behavior, schema-backed data, accessibility, routing, and asset
   policy.
3. `DESIGN_DIRECTIONS.md`.
4. `.interface-design/system.md`.
5. General Interface Design principles.

Interface Design is a critique, memory, and consistency layer. It is not
permission to replace accepted Merchants Codex patterns or repeatedly propose
new aesthetic directions.

Existing tests and implementation patterns do not preserve obsolete public
geometry when the approved handoff replaces it. A visual deviation from the
handoff requires a concrete production constraint.

## Visual Foundation

### Core palette

The shared foundation is:

| Role | Value |
| --- | --- |
| Page background | `#111514` |
| Primary surface | `#171b19` |
| Elevated surface | `#1c201e` |
| Warm border | `#3a3528` |
| Primary text | Ivory |
| Secondary text | Muted neutral grey |
| Accent | Restrained gold |

Red is reserved for destructive actions and errors, green for success and
verified states, and orange for warnings.

Charcoal remains visually dominant. Gold guides hierarchy and interaction; it
must not be distributed across every element. Avoid navy or blue-black
foundations, harsh pure-white text, generic purple gradients, and bright neon
treatments.

### Resource atmosphere

Accepted detail-page atmospheres are:

- Item: a subtle, localized cool-blue atmosphere.
- Recipe: a subtle, localized warm-amber atmosphere.

Atmosphere is low-opacity, decorative, non-semantic, localized, and independent
of layout geometry. It must not tint every card, determine content positions,
or reduce text readability. Any atmosphere for another resource type requires
an explicit proposal and approval.

### Typography

The existing Manrope-based sans-serif system remains the interface typeface for
navigation, search, buttons, body copy, labels, metadata, relationship rows,
sidebars, dense factual content, and admin UI.

DM Serif Display is reserved for major public resource titles:

- Use regular weight only.
- Keep line-height tight but readable.
- Use restrained negative tracking.
- Control long Recipe titles at narrow widths.
- Do not apply it globally to headings.
- Do not apply it automatically to admin UI.
- Do not use it for card headings, metadata, buttons, labels, or navigation.

Preserve the serif/sans pairing. Additional fonts require approval.

### Surfaces, shape, and depth

Use moderately rounded, Pokémon-friendly shapes, restrained borders, subtle
elevation, and minimal heavy shadow. Avoid excessive glassmorphism, ornamental
frames, and equal visual weight across every card. The hero, primary content,
supporting content, and verification areas need an unmistakable hierarchy.
Dense rows remain compact and scannable.

## Layout and Shared Shell

Primary desktop targets are:

- `1920×1080`
- `2560×1440`
- `3440×1440`

The system is desktop-first while keeping mobile functional and accessible.
Public content stays bounded and centered. Ultrawide layouts must not stretch
cards excessively. Use meaningful negative space rather than filling the
viewport simply because room exists.

Background artwork is decorative. Foreground layout must remain correct when
the artwork is removed, and artwork must never determine content geometry.
Detail pages may retain a restrained right sidebar where appropriate.

The approved first scenic-background rollout uses the lossless coastal
overlook as a finite upper-page atmosphere on the homepage, Items catalogue,
and Item detail only. It uses a strong charcoal wash, a restrained horizontal
vignette, and a vertical fade into the solid page background. The source
remains an unaltered CSS background; cards and panels stay nearly opaque.
Desktop uses a slightly right-biased `55% center` crop, while mobile uses an
explicit `82% center` crop to favor the lighthouse and sunset. Do not extend
the scene through long content, use fixed attachment, or apply it to admin or
other public resources without a later visual review.

Homepage scenery remains legible but is calibrated to the handoff's dark
field-guide presentation. The desktop homepage wash uses the handoff's
`0.55`/`0.50` top/middle opacity and `0.72`/`0.10` vignette edge/center; the
mobile homepage uses `0.52`/`0.58` and `0.56`/`0.24`/`0.40`. The Items
catalogue uses the handoff's `0.62`/`0.55` vertical wash and `0.70`/`0.15`
radial vignette edge/center; mobile retains the stronger `0.56`/`0.64` wash.
Item detail retains its established wash and cool-blue
resource atmosphere, unchanged by this pass. Reading zones stay darker than
scenic focal areas, the lower fade into solid `#111514` is unchanged, and the
lossless master remains byte-identical.

The landing hero uses the handoff's `96px` desktop top inset, `92px` display
title, flat horizontal statistic row, `66px` Start Anywhere art stages, and
`1.35fr / 1fr` lower information band. Live counts and recent records replace
prototype literals without changing that geometry.

The established public shell contains:

- Merchants Codex branding.
- A shared header.
- Primary navigation and an active state.
- Search.
- A centered main content region.
- A restrained footer.
- Visible keyboard focus.
- Responsive behavior without horizontal overflow.

The Items and Recipes directories use the handoff's fixed-height desktop
catalogue shell: the header stays fixed, the catalogue results scroll inside
the remaining viewport, and the footer is omitted at desktop widths. Below
`1180px`, they return to ordinary document flow so stacked controls and the
overview remain accessible.

Its desktop geometry follows the handoff directly: a `1760px` maximum-width
container with `28px` page gutters, a three-column logo/navigation/search
header, and the compact reference footer cadence. At narrow widths the same
elements reflow without changing their semantics.

Do not independently redesign the shell while implementing an individual
resource page.

The official Merchants Codex image logo (`public/images/branding/
merchants-codex-logo.png`) is the authoritative public-header brand mark. It
replaced the prior temporary "Merchants Codex / PokeForce Companion" text
lockup and lives at the far left of the shared header as the one home link,
implemented through the shared public shell so every public page inherits it
automatically. Its proportions are preserved and it is sized responsively
through CSS, never stretched or distorted; the lossless master asset is never
independently recropped, recolored, or reconstructed. Applying it to the
admin shell is a separate, later decision — this pattern covers the public
header only.

## Public Detail Pages

The shared detail-page composition is:

- A semantic breadcrumb.
- A prominent resource hero.
- A fixed sprite or image stage.
- Genuine resource context, such as category or profession.
- A major resource title.
- Schema-backed summary information.
- A primary content column.
- A restrained supporting sidebar.
- Dense linked relationship rows.
- Verification metadata.
- Universal hide-empty behavior.

Item pages use the accepted cool-blue atmosphere. Recipe pages use the accepted
warm-amber atmosphere.

The calibrated Item detail identity follows the archived Claude Design handoff:
the content occupies the handoff's full `1760px` desktop measure, the primary
and supporting columns are separated by `28px`, the supporting rail is `272px`,
and the hero is a flat art-and-copy row rather than a bordered card.
Its art frame is `180×180px` with `14px` corners and centered `128×128px`
content. The copy begins `6px` below the art frame's top edge, uses an `11px`
uppercase category, a `40px` resource title, and `14.5px` summary copy capped at
`640px`. At narrow widths the columns and identity row stack without changing
the art frame's size. Production-only acquisition, relationship, and
verification information remains visible beneath or beside that composition.

The calibrated Recipe detail follows its distinct archived handoff rather than
copying Item detail's fact rail. It uses the full `1760px` desktop measure with
no visible sidebar, a flat `180×180px` warm-amber art frame, centered
`128×128px` content, and a bottom-right factual yield badge. Copy begins `6px`
from the top with an `11px` `Profession Recipe` eyebrow, `40px` title, and a
data-derived `14.5px` summary capped at `640px`. Profession, optional required
level, and EXP reward are compact hero chips.

The Ingredient disclosure begins `32px` after the hero. Its heading rule uses
the full main measure while the bordered list is `538px` wide at desktop
(`520px` handoff content plus border/padding), with `8px` outer padding, `6px`
row gaps, `32px` images, and right-aligned quantities. Production-owned Crafted
result, Related Recipes, verification, and update metadata continue beneath
this reference composition; they do not recreate the removed sidebar.

Public collection and context pages have distinct responsibilities:

- `/recipes` is the canonical full Recipe catalogue. It uses the approved
  result-focused Recipe cards, deterministic twelve-Recipe pagination, and one
  server-rendered Profession filter backed only by `Recipe.profession`.
  Player Class filtering is not part of the Recipe domain.
- `/items` is the canonical full Item catalogue. It uses deterministic
  pagination and a server-rendered Item Category filter backed only by
  `Item.category`.
- Profession detail explains a crafting discipline through the handoff's flat
  neutral identity and complete linked Recipe grid/list. Recipe, resulting
  Item, and Ingredient remain distinct production relationships.
- Class detail explains an independent player Class through its compact neutral
  identity, optional image/description, and inline Verification. It has no
  Recipe count, Recipe previews, or Recipe-catalogue link.
- Item Category detail describes and counts an Item type, then links to the
  canonical filtered Items index. It does not reproduce an Item grid or infer
  a Recipe catalogue from resulting Item Category.
- Full Recipe output cards belong to canonical collection contexts, except for
  the explicitly approved Profession detail handoff, which presents that
  Profession's complete craftable-output directory. No other explanatory or
  contextual page inherits that exception automatically.
- Profession verification remains a restrained factual strip, and Profession
  remains atmosphere-free. Class verification is identical in shape, and
  Class is likewise atmosphere-free.
- Recipe detail shows its Profession, optional required Profession level, and
  EXP reward as hero chips. Result and Ingredients remain linked production
  relationships. Recipe cards expose the required Profession level when
  present.

### Public Item catalogue cards

Public Item catalogue cards remain visually simpler than Recipe cards:

- Use a centered fixed image or fallback stage with identical geometry.
- Keep the Item name left-aligned at `13.5px` with a `1.25` line-height and a
  one-line ellipsis backed by the full title attribute.
- Show the Category directly beneath at `10.5px`, uppercase, and muted gold.
- Show a two-line real description when present and the first real acquisition
  source in the quiet card footer.
- Do not prefix the Category with `Category:`.
- Do not show Tradeable status or base value.
- Preserve full-card navigation, visible focus, long-title wrapping, and the
  established responsive grid.

Only render facts present in the current schema and query. Do not invent
descriptions, rarity, weight, buy or sell price, crafting time, crafting
difficulty, station, required level, notes, or any other property.

### Public Recipe catalogue cards

The canonical `/recipes` directory uses the archived handoff's compact Recipe
cards, without changing the richer shared cards used in Profession previews:

- The desktop grid uses `repeat(auto-fill, minmax(190px, 1fr))` with `12px`
  gaps; the standard `1760px` shell produces seven columns beside the `272px`
  overview rail.
- Each grid card has `12px` padding, a square art frame, centered `104px`
  result content, and a bottom-left factual yield badge.
- Recipe names are `13.5px`, one line, and ellipsized. Profession and required
  level share the compact line below without allowing the level to collapse.
- Show three linked `36px` Ingredient previews in grid view, retaining the
  real disclosure and tooltip behavior for additional Ingredients.
- Show the schema-backed EXP reward in the quiet ruled footer.
- Preserve the handoff's Grid/List control. List view reorganizes the same
  Recipe result, Profession/level, EXP, and linked Ingredient data; it does not
  introduce another query or data source.
- Keep deterministic twelve-Recipe server pagination. It is production-owned
  behavior retained in place of the handoff's decorative infinite-scroll
  sentinel.

### Public Profession catalogue cards

The canonical `/professions` directory follows the archived handoff's roomier
discipline-card presentation rather than the compact Item or Recipe card:

- At desktop, use a two-column grid with `20px` gaps beside the shared `272px`
  overview rail. Cards use `20px` padding, `14px` corners, and a fixed
  `130×130px` image stage containing an `88px` sprite or quiet fallback.
- Use a `19px` sans title, a compact uppercase `Profession` resource label,
  and at most three lines of the real plain compatibility description. The
  ruled footer shows the real Recipe count and shared maximum Profession level
  only when progression rows exist.
- The prototype-only Gathering/Production types have no production schema
  authority. Do not display or filter by them. The name search is a genuine
  server-side GET filter, while Grid/List are two presentations of the same
  Prisma-backed alphabetical result set.
- The overview is factual: total Professions, assigned Recipes, verified
  entries, and the highest stored Profession level. Preserve full-card links,
  visible focus, image fallbacks, and a single-column mobile transition.

The scenic layer shown in the Profession directory handoff reuses the approved
managed catalogue asset and crop. It is not a Profession-specific resource
atmosphere and must not alter the page's data hierarchy or geometry.

### Public Profession detail

The canonical Profession detail follows its archived handoff literally while
retaining richer production relationships:

- Use the full `1760px` detail measure. The identity is a flat row with a
  `180×180px` neutral art frame, centered `128px` content, and copy beginning
  `6px` from the frame's top. Use an `11px` uppercase resource eyebrow, `40px`
  serif title, and `14.5px` rich description capped at `640px`.
- Fact chips show Resource (`Profession`), the maximum stored shared
  Profession level when available, and live Recipe count. The prototype's
  Gathering/Production type remains unsupported and must not be invented.
- The Recipe section starts `32px` after the hero. Preserve its reveal arrow,
  sweeping gold rule, Grid/List control, `220ms` card entrance with `30ms`
  stagger capped at `330ms`, and reduced-motion equivalent.
- Grid cards use `repeat(auto-fill, minmax(280px, 1fr))`, `14px` gaps, a
  `78px` result stage with `64px` content and factual yield, Recipe title,
  Profession/optional level, and three linked `36px` Ingredient previews.
  Additional Ingredients open from a compact anchored disclosure.
- Recipe titles, resulting Item stages, and Ingredients are distinct canonical
  links with explicit accessible context. List view adds schema-backed EXP and
  reorganizes the same server-rendered data. Render all real Recipes; the
  prototype mock pool and infinite behavior have no production authority.
- Keep rich text, fallbacks, hide-empty Recipe behavior, verification/build
  metadata, and factual update date. The managed detail scenic backdrop is
  shared presentation, not a Profession-specific atmosphere.

Player Classes (Trainer, Artisan, Rancher, Ranger, Farmhand) are a top-level
public/admin resource, matching Item, Recipe, Profession, Category, Location,
Shop, and Currency in status. The internal/schema/domain name is
`PlayerClass` — never the bare word `Class`, which would collide with the
existing Item Category concept and the language keyword; every public label
reads "Class"/"Classes". This milestone introduces no player levels, Class
progression, unlock trees, Class-specific permissions, or account/character
ownership — those remain explicitly out of scope until a later milestone.

Player Classes are independent resources. Recipes do not belong to or require
Classes. `Recipe.requiredLevel` represents the Profession level required to
perform that Recipe. Future Class gameplay relationships are undefined and
must not be inferred.

### Images and sprites

Use the shared `ContentImage` component and preserve source aspect ratio.
Sprite content uses crisp-edge or pixelated rendering; never blur or smooth
native pixel art.

The calibrated Item and Recipe detail heroes display content at `128×128px`
inside `180×180px` art frames. Other public detail resources may continue to
use shared `192×192px` content inside a `240×240px` stage until their own
archived handoff calibration is complete. Images must not be distorted to fill
either stage. Public fallbacks should be quiet and intentional, while row
fallbacks remain fixed-size and preserve alignment.

Do not add decorative generated-looking icons. Recipe detail retains a compact
square Crafted Result image or fallback with an overlapping yield badge. That
image may intentionally repeat the Recipe hero because the hero identifies the
page while the Crafted Result stage identifies the exact output and anchors its
quantity. Do not add further duplicate imagery beyond those two uses. Real
PokeForce visual assets and map screenshots must not be published until
permission or the game's 1.0 release permits publication.

Deterministic visual fixtures should prefer validated genuine sprite coverage
while retaining deliberate no-image examples. Fixture use must preserve source
bytes, transparency, aspect ratio, and crisp rendering and must never alter
production seed content.

### Relationship rows

The full row is the single semantic link target. Where arrow glyphs are
retained, they are decorative and not separate focus targets. Visible keyboard
focus belongs around the complete linked row.

Hover and focus must not cause layout shift. Preserve thumbnail, title,
supporting metadata, quantity, and row alignment; long names must not collapse
quantity or action alignment.

Linked Ingredient and Crafted-result rows on Recipe detail do not need
decorative trailing arrows: the complete row already communicates navigation
through link semantics, hover, and focus treatment.

## Content Integrity

All production content is factual and database-backed:

- Do not invent schema fields or gameplay mechanics.
- Hide optional sections when their data is empty.
- Keep verification build-based and factual.
- Keep timestamps factual.
- Preserve canonical relationships and routes.
- Do not use fake production content to make layouts appear fuller.

### Rich descriptions

Game Version, Category, Item, Profession, Player Class, Location, Currency,
and Shop descriptions use one true WYSIWYG authoring pattern. The stored source
is versioned, normalized structured JSON; the legacy plain `description`
remains a synchronized compatibility/search projection. Existing plain
descriptions were migrated into deterministic paragraphs without altering
their text.

The supported vocabulary is deliberately small: paragraphs, subordinate
section and subsection headings, bold, italic, underline, unordered lists,
hard line breaks, and safe links. Page-level H1, ordered lists, arbitrary
styles, colors, images, embeds, scripts, raw HTML, and unknown nodes or marks
are not supported. Pasted content is sanitized into the same vocabulary.
Internal resource links use canonical public routes. External links are
restricted to secure `https://` URLs and render with safe new-tab behavior.

Public detail and established prose surfaces use the shared semantic renderer,
never raw HTML. Empty descriptions remain hidden, long words and URLs wrap,
and headings stay subordinate to the page title. Catalogue cards do not
inherit long-form rich content unless a future approved card pattern explicitly
calls for it.

The admin rich-text editor's internal-resource link search renders feedback
only while actively loading, once results are populated, or after a completed
non-empty search finds nothing ("No matching resources") — an empty bordered
results container must never appear. Selecting a resource clears the stale
search and shows a selected-target summary (label, type/context, and
canonical path). Every authored link also exposes a shared, viewport-aware
destination popover on hover, keyboard focus, and caret placement, offering
Edit link, Remove link, and Escape dismissal; linked text must not navigate
while being edited, so clicking a link in the editor opens the popover instead
of following it. Removing a link preserves its visible text and other
formatting. Both the search and the popover resolve resources through the same
canonical resource-link infrastructure — never a parallel lookup.

## Accessibility and Interaction

Use semantic links and headings, preserve accessible names, and provide
accessible fallback labels. Keyboard focus must remain visible. Decorative
controls must not create duplicate focus targets.

No interaction may depend exclusively on hover, and hover or focus must not
shift layout. Maintain reasonable text contrast. If motion is introduced,
respect reduced-motion preferences.

## Responsive Behavior

Desktop remains the primary design context. At narrow widths:

- Stack detail-page columns cleanly.
- Do not squeeze a desktop sidebar beside the main content.
- Allow long titles to wrap naturally while controlling scale and line-height.
- Preserve clear label/value alignment.
- Remove decorative dividers that become awkward when stacked.
- Retain readable relationship-row hit targets.
- Prevent horizontal overflow.

Do not redesign desktop patterns around mobile-first assumptions.

## Public and Admin Boundaries

Public and admin interfaces share the charcoal-and-gold identity, but they are
not interchangeable layouts. Admin remains denser and operational, preserving
existing shared components and contributor authoring efficiency.

Public display typography and resource atmospheres do not automatically apply
to admin. Interface Design must not homogenize the two contexts.

All contributor-editable calendar dates use the shared themed picker. The
current schema has exactly one such field: optional Game Version release date.
It displays `DD MMM YYYY`, submits/stores the existing `YYYY-MM-DD` date-only
value without timezone conversion, supports keyboard navigation and clearing,
and participates in dirty-state and draft recovery. Automatic `createdAt` and
`updatedAt` values plus verification timestamps are factual/read-only and do
not receive calendar controls.

## Visual Restraint

Avoid:

- Generic generated-looking icons.
- Excessive ornamentation or texture.
- Decorative badges without information value.
- Unnecessary gradients.
- Large glow effects or strong glass effects.
- Gratuitous animation.
- Identical card grids.
- Pill-shaped controls everywhere.
- Generic SaaS dashboard conventions.
- Empty decorative panels.
- Fake data added for visual balance.

## Workflow and Collaboration

Codex and Claude Code must remain interchangeable collaborators.

Before every implementation slice:

1. Audit the branch and HEAD.
2. Audit upstream alignment.
3. Inspect the working tree.
4. Inspect staged, modified, and untracked files.
5. Inspect recent commits.
6. Inspect the actual relevant diff.
7. Preserve unrelated work.

Never assume another agent's implementation is complete. Never let two agents
edit the same working tree concurrently. Use small, focused commits; validate
before committing; push verified slices; and require the next agent to begin
from the latest pushed commit. When visual approval has been requested, stop
before committing.

## Design Review

For a new or changed public page:

1. Inspect the most polished accepted related page.
2. Read `DESIGN_DIRECTIONS.md`.
3. Read `.interface-design/system.md`.
4. Identify reusable patterns before editing.
5. State any necessary deviation.
6. Implement through reuse.
7. Validate at the target widths.
8. Capture screenshots.
9. Compare against accepted pages.
10. Consolidate corrections into one pass where possible.

Once this direction is loaded, Interface Design should enforce consistency and
surface conflicts—not infer a replacement aesthetic.

The authenticated `/admin/design-review` workbench is the operational form of
this checklist. It renders exactly one registered ordinary public fixture
route in a sandboxed logical viewport, beside application-owned contract
expectations. Its selectors, refresh/copy/open controls, and session-only
checklist use the established admin charcoal/gold system. It is read-only,
allowlisted, never embeds arbitrary URLs, and never copies public markup into
an admin-only substitute.

## Admin Appearance Governance

The Appearance workspace is the authoritative admin workflow for the public
header logo, favicon, the three approved public scenic wallpapers (homepage,
Items catalogue, and Item detail), and the shared authenticated admin-shell
background. It changes those visual assets and their crop positions; it is not
a general theme editor and must not expose typography, color-token,
component-style, or arbitrary-page controls.

Committed brand and scenic assets remain safe defaults. Published custom assets
use cache-busted public URLs, while missing records, malformed values, and
unavailable custom objects fall back to the committed presentation without
breaking navigation or content. Decorative scenic layers remain
accessibility-neutral and `aria-hidden`.

Each scenic surface owns an independent desktop crop and mobile crop.
Ultrawide uses the desktop crop. The admin preview uses the real public classes
and atmosphere layers, but every preview edit remains unpublished until the
complete draft is saved. Header-logo proportions are intrinsic and responsive;
the logo may scale but must never stretch or be cropped.

Every asset uses the same accessible gold `Choose file` control backed by a
visually hidden native file input. The selected filename is always explicit,
including the `No file selected` empty state, and requirements live in the
shared accessible info-tooltip beside `Replacement file`. Selecting or dropping
a file validates and stages its draft immediately; there is no per-asset upload
action because the page-level guarded Save remains the only atomic publication
boundary.

The admin background is applied only at the shared `AdminShell` boundary.
Desktop and ultrawide share one exact integer X/Y crop; the committed
`/images/admin/admin-shell-background.webp` at `50% 50%` remains the fallback.
The existing dark overlay and opaque sidebar, central workspace, panels, forms,
and dialogs remain authoritative for readability. Draft files and positions
appear only in the representative admin-shell preview until Save publishes the
complete snapshot. Public routes and login never receive the admin background.

Admin navigation separates content work from site governance. Existing resource
ordering remains intact in the primary group, while a bottom-anchored
`Site administration` group contains Appearance, Design review, Users & access,
and Audit log when permitted by the current role, with existing active-state
and keyboard behavior. Do not render inaccessible destinations or future
governance placeholders.

Private-beta access UX is deliberately operational rather than promotional.
Login contains only email, password, safe return-path handling, and concise
access-state feedback—never signup, invitation, approval, or request-access
controls. Users & access uses the established bounded admin tables and explicit
confirmation checkboxes for role, status, password-reset, and visibility
changes. The Owner-only visibility panel must show both stored and effective
mode when the emergency forced-private override is active. Audit history stays
readable and append-only; raw JSON is not its primary interface.

## Public Redesign Integration

`PUBLIC_REDESIGN_INTEGRATION.md` is the implementation-grade inventory and
acceptance dossier for the future externally authored public redesign. Its
application-owned viewport registry lives in
`src/lib/public-design/viewports.ts`. Future redesign work must begin with the
dossier's baseline/import protocol and preserve its behavioral, Appearance,
accessibility, responsive, and public/admin boundary contracts. The readiness
harness records current behavior; it does not approve or import a new visual
direction by itself.

Use `pnpm test:public-design` as the focused behavioral gate before and after a
public redesign slice, and `pnpm public:design:capture` for deterministic visual
baselines. Both commands consume the application-owned contracts, fixtures,
and viewport presets documented in `PUBLIC_REDESIGN_INTEGRATION.md`; neither is
a substitute for explicit visual approval.
