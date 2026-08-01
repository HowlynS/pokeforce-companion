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

### Scenic public background

- First rollout only: homepage, Items catalogue, and Item detail.
- Source: the original coastal-overlook PNG as one decorative CSS background;
  never transform the lossless master or expose it semantically.
- Desktop crop: `55% center`; mobile crop: `82% center`.
- Finite upper-page depths: home `880px`, catalogue `600px`, detail `760px`;
  mobile home `760px`, catalogue `560px`, detail `700px`.
- Use a strong charcoal vertical wash, subtle horizontal vignette, and a
  complete fade to `#111514`; cards and panels remain nearly opaque.
- Home desktop wash: `0.36`/`0.46`; vignette:
  `0.54`/`0.16`/`0.30`. Home mobile wash: `0.48`/`0.56`; vignette:
  `0.52`/`0.28`/`0.36`.
- Items catalogue desktop wash: `0.48`/`0.58`; vignette:
  `0.56`/`0.26`/`0.44`. Catalogue mobile wash: `0.56`/`0.64`; vignette:
  `0.52`/`0.32`/`0.42`.
- Homepage visibility may be stronger than catalogue/detail. Retain a darker
  reading zone behind copy and the existing lower fade into solid `#111514`.
  Item detail keeps its existing scenic values and cool-blue atmosphere,
  untouched by the second visibility pass.
- Preserve layout when decoration is removed. Do not use fixed attachment,
  preload globally, apply to admin, or extend to other public resources
  without visual review.

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
- The official Merchants Codex image logo (`public/images/branding/
  merchants-codex-logo.png`) is the authoritative brand mark, replacing the
  prior temporary text lockup. It is the header's one home link, implemented
  once in the shared public shell so every public page inherits it. Preserve
  its proportions, size it responsively through CSS only, and never
  independently recrop, recolor, or reconstruct the lossless master. Applying
  it to the admin shell is a separate decision, not implied by this pattern.

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

### Public Item catalogue cards

- Keep Item cards visually simpler than Recipe cards.
- Center the fixed image/fallback stage; genuine images and fallbacks use
  identical geometry.
- Item title: left-aligned, `20px`, `1.25` line-height, clean wrapping.
- Category: Category name only, directly beneath the title, left-aligned,
  `14px`, upright, muted, and medium weight.
- Never show a `Category:` prefix, Tradeable status, description, or base
  value.
- Preserve full-card navigation, visible focus, and the responsive catalogue
  grid.

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

### Rich descriptions

- Applies to Game Version, Category, Item, Profession, Player Class, Location,
  Currency, and Shop descriptions.
- Author with the shared TipTap WYSIWYG editor; store normalized versioned JSON
  in `descriptionRich` and keep plain `description` as the synchronized
  compatibility/search projection.
- Supported only: paragraph, subordinate section/subsection headings, bold,
  italic, underline, unordered list/list item, hard break, and safe link.
- Prohibit H1, ordered lists, arbitrary styles/colors, images, embeds, scripts,
  raw HTML, and unsupported nodes/marks.
- Sanitize paste and submitted JSON through the same allowlist. Never render
  stored raw HTML.
- Internal resource links use canonical public routes. External links allow
  secure `https://` URLs only and use safe new-tab attributes.
- Link dialogs preserve and restore the authored selection across focus moves.
- Render established public prose surfaces through shared `RichTextContent`;
  preserve hide-empty behavior and wrap long text/URLs.
- Do not place long-form formatted descriptions in catalogue cards by default.

### Admin internal-resource link search feedback

- Render search feedback only for one of: active loading ("Searching…"),
  populated results, or a completed non-empty search with no matches
  ("No matching resources").
- Never render an empty bordered results container; the bordered
  `.rich-link-results` box only mounts once there are results to show.
- Selecting a result clears the stale query/results and shows a selected-target
  summary (`.rich-link-selected-resource`): name, type/context, and the
  canonical path.
- Reuse the existing canonical resource-link lookup
  (`src/app/admin/resource-links/route.ts`) for both search and href
  resolution; do not add a parallel lookup path.

### Rich-text link hover/focus popover

- Every rich-text link exposes a shared viewport-aware destination popover
  (`.rich-link-popover`) on hover, keyboard focus, and caret placement inside
  the link.
- Linked text must not navigate while being edited; clicks on a link inside the
  editor open the popover instead of following the href.
- The popover supports Edit link, Remove link, Escape dismissal, safe path
  wrapping, visible focus, and a graceful "Internal resource"/"External link"
  fallback while the target is still resolving or unresolved.
- Removing a link preserves its visible text and any other marks (bold,
  italic, underline) — only the link mark is unset.
- Popover resource resolution reuses the same canonical resource-link
  infrastructure as search, never a second lookup implementation.

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
- Use the shared themed calendar picker for contributor-editable calendar
  dates. Currently this is only optional Game Version release date.
- Display dates as `DD MMM YYYY`; preserve the date-only `YYYY-MM-DD` storage
  contract without timezone conversion. Optional dates provide a clear action.
- Keep `createdAt`, `updatedAt`, and verification timestamps read-only; they
  are not contributor date fields.
- Keep gameplay/content navigation in the primary sidebar flow. Site-level
  governance lives in a bottom-anchored `Site administration` group;
  Appearance, Design review, Users & access, and Audit log render only when
  the current role owns their capability. No placeholder links render.
- The shared admin shell alone owns the managed scenic background. It resolves
  a cache-busted custom asset and desktop X/Y crop, falling back to
  `/images/admin/admin-shell-background.webp` at `50% 50%`. Public routes and
  login never inherit it; central work surfaces remain opaque.

## Workflow

- Audit repository state and actual diffs before each slice.
- Read both design documents and inspect the most polished accepted related
  page.
- Reuse accepted patterns before creating variants.
- Report conflicts or deviations before redesigning.
- Validate at target widths and capture comparison screenshots.
- Keep Codex and Claude Code interchangeable.
- Never edit concurrently in the same working tree.

## Appearance Workspace

The admin Appearance route is a dense workbench, not a gallery or theme
builder. At wide widths, use the existing 4px spacing system in a two-column
controls/preview composition (`minmax(420px, 0.72fr)` /
`minmax(0, 1.28fr)`); stack the columns below 1480px without horizontal
overflow. The shared sticky form action bar remains the single Save/Cancel
surface.

Asset controls use one bordered field group per asset with:

- concise purpose with accepted-file guidance in the shared accessible
  info-tooltip beside `Replacement file`;
- side-by-side Published and Draft previews when space allows;
- visible source/dimension metadata;
- one shared gold `Choose file` button backed by a visually hidden native file
  input, an explicit filename/empty state, and drop support;
- explicit replacement/removal intent plus a per-asset reset.

File selection validates and stages the draft immediately. Per-asset upload
buttons are prohibited: the shared sticky Save action is the only publication
surface and atomically publishes every pending asset and position.

The live preview is always labelled as an unpublished draft. It reuses public
header/scenic classes and layers for Homepage, Items catalogue, and Item detail,
and renders a representative opaque AdminShell proof for Admin workspace.
Public modes expose Desktop 1920×1080, Ultrawide 3440×1440, and Mobile 390×844
presets; Admin workspace is desktop/ultrawide only and owns one desktop crop
shared by both. Crop inputs are exact integer percentages from 0–100. Pointer
dragging and numeric input update the same value, with visible active, focus,
and disabled states. Provide Reset to published and Restore default position
actions.

Preview content is representative structure only and must not invent gameplay
facts. Scenic backgrounds are decorative and absent from the accessibility
tree. Logo previews always preserve the uploaded intrinsic ratio. Pending
files may use authenticated in-memory object URLs in the protected admin
client, but do not become public until Save publishes the whole appearance
configuration.

## Public Redesign Readiness

`PUBLIC_REDESIGN_INTEGRATION.md` is the authoritative public-redesign
integration dossier. The typed contract, viewport, fixture, acceptance, and
capture registries live under `src/lib/public-design`; shared logical review
widths are application data there, not duplicated values in new tooling.
Readiness infrastructure must not restyle the public application. This
milestone intentionally left the current public visual design unchanged while
establishing review and regression infrastructure for a future explicit
redesign import branch.

`/admin/design-review` is the protected admin workspace for reviewing real
public routes against deterministic fixtures and viewport contracts. It uses
the existing dense admin identity: 4px base spacing, 16–24px workbench gaps,
quiet bordered surfaces, Manrope hierarchy, and restrained gold only for
focus/action/status. The live public iframe is the focal surface; selectors and
contract evidence remain subordinate. It loads one allowlisted real route at
one logical viewport, scales from the top-left, and keeps checklist state in
memory only.

- `pnpm public:design:fixtures setup|status|cleanup` manages the redesign
  fixture lifecycle.
- `pnpm public:design:capture` captures the registered public design matrix and
  writes Git-ignored screenshots plus a manifest.
- `pnpm test:public-design` is the focused public-redesign regression gate; run
  it before and after importing an approved redesign slice.

Future redesign import sequence:

1. Capture the current baseline.
2. Introduce tokens and primitives.
3. Migrate the shared shell.
4. Validate one representative catalogue and one detail page.
5. Roll out remaining public resources.
6. Perform accessibility and responsive hardening.
7. Run final redesign regression and capture.

Known replaceable redesign issue: a one-result filtered Item catalogue can
stretch its single card across the generic auto-fit grid.

Private-beta access UI extends the existing dense admin workbench without
restyling public routes. Login is a restrained single-purpose surface with no
signup, invitation, approval, or request-access affordance. Users & access
uses bounded tables, explicit confirmations for dangerous actions, and an
Owner-only visibility control that states both stored and effective mode.
Audit log is append-only, newest first, filterable, and presents readable
field summaries instead of raw JSON as its primary interface.

Latest clean visual baseline commit: `8ec557e`. Later access-control commits
intentionally leave the current public visual design unchanged.
