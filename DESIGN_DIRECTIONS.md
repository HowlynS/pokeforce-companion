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

1. Finalized, implemented Merchants Codex patterns.
2. Approved screenshots and mock-ups.
3. `DESIGN_DIRECTIONS.md`.
4. `.interface-design/system.md`.
5. General Interface Design principles.

Interface Design is a critique, memory, and consistency layer. It is not
permission to replace accepted Merchants Codex patterns or repeatedly propose
new aesthetic directions.

If Interface Design advice conflicts with an accepted project pattern,
preserve the pattern, report the conflict, and request approval before
redesigning it.

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

Homepage scenery may be more visible than catalogue/detail scenery. The final
desktop homepage wash uses `0.52`/`0.63` top/middle opacity and a
`0.72`/`0.28`/`0.44` left/center/right vignette; the mobile homepage uses
`0.63`/`0.72` and `0.70`/`0.43`/`0.51`. The Items catalogue stays quieter:
desktop `0.67`/`0.76` and `0.74`/`0.42`/`0.61`; mobile `0.75`/`0.82` and
`0.69`/`0.50`/`0.58`. Item detail retains its established wash and cool-blue
resource atmosphere. Reading zones stay darker than scenic focal areas, and
the lossless master remains byte-identical.

The established public shell contains:

- Merchants Codex branding.
- A shared header.
- Primary navigation and an active state.
- Search.
- A centered main content region.
- A restrained footer.
- Visible keyboard focus.
- Responsive behavior without horizontal overflow.

Do not independently redesign the shell while implementing an individual
resource page.

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

Public collection and context pages have distinct responsibilities:

- `/recipes` is the canonical full Recipe catalogue. It uses the approved
  result-focused Recipe cards, deterministic twelve-Recipe pagination, and one
  server-rendered Profession filter backed only by `Recipe.profession`.
  Player Class filtering is not part of the Recipe domain.
- `/items` is the canonical full Item catalogue. It uses deterministic
  pagination and a server-rendered Item Category filter backed only by
  `Item.category`.
- Profession detail explains a crafting discipline. Its compact neutral hero
  keeps factual Recipe and unique-result totals, while an optional compact
  three-Recipe preview links to the canonical filtered Recipes index.
- Class detail explains an independent player Class through its compact neutral
  identity, optional image/description, and inline Verification. It has no
  Recipe count, Recipe previews, or Recipe-catalogue link.
- Item Category detail describes and counts an Item type, then links to the
  canonical filtered Items index. It does not reproduce an Item grid or infer
  a Recipe catalogue from resulting Item Category.
- Full Recipe output cards belong to canonical collection contexts, not
  explanatory or contextual detail lists.
- Profession verification remains a restrained factual strip, and Profession
  remains atmosphere-free. Class verification is identical in shape, and
  Class is likewise atmosphere-free.
- Recipe detail shows its Profession, optional required Profession level, and
  EXP reward as separate facts alongside Result and Ingredients. Recipe cards
  expose the required Profession level when present.

### Public Item catalogue cards

Public Item catalogue cards remain visually simpler than Recipe cards:

- Use a centered fixed image or fallback stage with identical geometry.
- Keep the Item name left-aligned at `20px` with a `1.25` line-height.
- Show only the Category name directly beneath the title at `14px`, upright,
  muted, and medium weight.
- Do not prefix the Category with `Category:`.
- Do not show Tradeable status, description, or base value.
- Preserve full-card navigation, visible focus, long-title wrapping, and the
  established responsive grid.

Only render facts present in the current schema and query. Do not invent
descriptions, rarity, weight, buy or sell price, crafting time, crafting
difficulty, station, required level, notes, or any other property.

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

Current hero behavior supports a `32×32` sprite displayed at `192×192` within a
`240×240` stage. Images must not be distorted to fill that stage. Public
fallbacks should be quiet and intentional, while row fallbacks remain
fixed-size and preserve alignment.

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
