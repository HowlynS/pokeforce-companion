# Merchants Codex Interface System

For product rationale, governance, and review policy, see
`DESIGN_DIRECTIONS.md`. Meaningful design changes must update both files in the
same focused commit.

## Direction

- Product: desktop-first crafting and trading codex for the PokeForce MMO.
- Personality: restrained, warm, structured, readable, sprite-friendly.
- Optimize for quick reference and dense linked factual data.
- Avoid generic SaaS patterns, excessive ornament, and generated-looking icons.
- Accepted implemented patterns override generic Interface Design advice.
- Preserve accepted patterns and report conflicts before proposing redesigns.

## Tokens

### Color

- Page: `#111514`
- Surface: `#171b19`
- Elevated: `#1c201e`
- Warm border: `#3a3528`
- Primary text: ivory, not harsh pure white
- Secondary text: muted neutral grey
- Accent: restrained gold; use for hierarchy and interaction
- Semantic red: destructive/error only
- Semantic green: success/verified only
- Semantic orange: warning only
- No navy, blue-black, purple-gradient, or neon foundation

### Typography

- UI, body, dense data, and admin: existing Manrope-based sans-serif.
- Major public resource title: DM Serif Display `400`.
- Display line-height: tight and readable.
- Display tracking: restrained negative.
- Do not apply the serif globally, to card titles/metadata/navigation, or
  automatically to admin.
- Long Recipe titles must wrap with controlled narrow-screen scale.
- Add no new fonts without approval.

### Shape and depth

- Moderate radii and restrained borders.
- Subtle elevation; minimal heavy shadow.
- Avoid excessive glass and ornamental framing.
- Keep hero, primary, supporting, and verification hierarchy distinct.

### Layout

- Targets: `1920×1080`, `2560×1440`, `3440×1440`.
- Bounded, centered public content; no excessive ultrawide stretching.
- Desktop-first; mobile remains functional and accessible.
- Use meaningful negative space.
- Decorative backgrounds never determine geometry.
- Preserve a restrained detail-page sidebar where applicable.

## Resource Atmospheres

- Item: localized, low-opacity cool blue.
- Recipe: localized, low-opacity warm amber.
- Atmosphere is decorative, non-semantic, and layout-independent.
- Charcoal remains dominant; do not tint every card or reduce readability.
- New resource atmospheres require approval.

## Public Shell

- Reuse shared brand, header, navigation, search, main region, and footer.
- Preserve active navigation, visible focus, and overflow-free responsiveness.
- Do not redesign the shell within a resource-page slice.

## Public Detail Pattern

- Semantic breadcrumb.
- Prominent hero with a fixed `ContentImage` stage.
- Genuine category/profession context only.
- Shared major public title treatment.
- Schema-backed summary metadata.
- Primary column plus restrained supporting sidebar.
- Dense full-row relationship links.
- Factual verification metadata.
- Hide empty optional sections universally.

### Public resource responsibilities

- Recipes index is the canonical full Recipe catalogue: approved result-focused
  cards, twelve-Recipe pagination, and one server-rendered Profession filter
  backed by `Recipe.profession`. Player Class filtering is not part of the
  Recipe domain.
- Items index is the canonical full Item catalogue: deterministic pagination
  and a server-rendered Item Category filter through `Item.category`.
- Profession detail explains a discipline with its compact neutral identity
  hero, factual Recipe/result counts, at most three compact Recipe preview
  rows, a browse-all filtered Recipes link, and inline Verification.
- Class detail is an independent resource surface: compact neutral identity,
  optional image/description, and inline Verification. It has no Recipe count,
  Recipe previews, or Recipe-catalogue link.
- Category detail describes and counts an Item type, then links to the
  canonical filtered Items index. It does not duplicate Item or Recipe grids.
- Do not reuse full Recipe cards for explanatory or contextual lists.
- Profession and Class both remain atmosphere-free unless a future atmosphere
  is explicitly approved.
- Recipe detail shows its Profession, optional required Profession level, and
  EXP reward as separate facts. Recipe cards expose the Profession level when
  present.

### PlayerClass naming

- Internal/schema/domain name: `PlayerClass` — never bare `Class` (collides
  with the Item Category concept and the language keyword).
- Every public-facing label reads "Class"/"Classes".
- Initial records: Trainer, Artisan, Rancher, Ranger, Farmhand.
- Player Classes are independent resources. Recipes do not belong to or
  require Classes, and future Class gameplay relationships must not be
  inferred.
- No player levels, Class progression, unlock trees, Class permissions, or
  account/character ownership in this milestone.

## ContentImage

- Use the shared component.
- Preserve aspect ratio and crisp/pixelated sprite rendering.
- A `32×32` sprite may display at `192×192` inside a `240×240` hero stage.
- Never distort an image to fill the stage.
- Keep public fallbacks quiet and row fallbacks fixed-size/aligned.
- Recipe detail retains a compact square Crafted Result image or fallback with
  an overlapping yield badge. It may repeat the hero image because the hero
  identifies the page while the result stage identifies the exact output and
  anchors its quantity. Add no further duplicate imagery beyond those two
  intentional uses.
- Do not publish pre-release PokeForce visuals without permission.
- Deterministic screenshots should favor validated genuine sprite fixtures
  while retaining deliberate fallbacks; preserve fixture bytes and never
  alter production seed content.

## Linked Rows

- The full row is one semantic link.
- Any retained arrow is decorative, `aria-hidden`, and not focusable.
- Show visible focus around the full row.
- Do not introduce hover/focus layout shift.
- Preserve thumbnail/title/metadata/quantity/action alignment.
- Long names must not collapse quantity or action placement.
- Recipe-detail Ingredient and Crafted-result rows omit decorative trailing
  arrows; full-row link semantics plus hover/focus treatment carry navigation.

## Content Rules

- Use real database-backed facts only.
- Never invent fields, descriptions, or gameplay mechanics.
- Hide empty optional sections.
- Keep verification build-based and timestamps factual.
- Preserve canonical relations and routes.
- Never add fake production data for visual fullness.

## Accessibility and Responsive Rules

- Use semantic headings/links and preserve accessible names.
- Avoid duplicate focus targets and hover-only interactions.
- Maintain contrast and reduced-motion expectations.
- At narrow widths, stack main/sidebar cleanly.
- Control long-title scale and preserve label/value alignment.
- Remove awkward stacked dividers; retain usable row hit targets.
- Prevent horizontal overflow.

## Admin Boundary

- Share the charcoal/gold identity.
- Keep admin dense, operational, and efficient for contributors.
- Do not automatically apply public serif typography or atmospheres to admin.
- Preserve existing shared admin components.

## Workflow

- Audit repository state and actual diffs before each slice.
- Read both design documents and inspect the most polished accepted related
  page.
- Reuse accepted patterns before creating variants.
- Report conflicts or deviations before redesigning.
- Validate at target widths and capture comparison screenshots.
- Keep Codex and Claude Code interchangeable.
- Never edit concurrently in the same working tree.
