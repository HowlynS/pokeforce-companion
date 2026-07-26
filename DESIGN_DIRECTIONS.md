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

Only render facts present in the current schema and query. Do not invent
descriptions, rarity, weight, buy or sell price, crafting time, crafting
difficulty, station, required level, notes, or any other property.

### Images and sprites

Use the shared `ContentImage` component and preserve source aspect ratio.
Sprite content uses crisp-edge or pixelated rendering; never blur or smooth
native pixel art.

Current hero behavior supports a `32×32` sprite displayed at `192×192` within a
`240×240` stage. Images must not be distorted to fill that stage. Public
fallbacks should be quiet and intentional, while row fallbacks remain
fixed-size and preserve alignment.

Do not add decorative generated-looking icons. Do not repeat a Recipe result
thumbnail when the same image is already the Recipe hero. Real PokeForce visual
assets and map screenshots must not be published until permission or the
game's 1.0 release permits publication.

### Relationship rows

The full row is the single semantic link target. Arrow glyphs are decorative,
not separate focus targets. Visible keyboard focus belongs around the complete
linked row.

Hover and focus must not cause layout shift. Preserve thumbnail, title,
supporting metadata, quantity, and arrow alignment; long names must not
collapse quantity or action alignment.

## Content Integrity

All production content is factual and database-backed:

- Do not invent schema fields or gameplay mechanics.
- Hide optional sections when their data is empty.
- Keep verification build-based and factual.
- Keep timestamps factual.
- Preserve canonical relationships and routes.
- Do not use fake production content to make layouts appear fuller.

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
