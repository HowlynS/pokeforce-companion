# Merchants Codex Interface System

For product rationale, governance, and review policy, see
`DESIGN_DIRECTIONS.md`. Meaningful design changes must update both files in the
same focused commit.

## Direction

- Product: desktop-first crafting and trading codex for the PokeForce MMO.
- Personality: restrained, warm, structured, readable, sprite-friendly.
- Optimize for quick reference and dense linked factual data.
- Avoid generic SaaS patterns, excessive ornament, and generated-looking icons.
- The archived Claude Design production handoff is authoritative for visible
  public presentation; production remains authoritative for behavior and data.
- Existing implementation and tests do not preserve obsolete public geometry.

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
- Public display and major resource titles: Cormorant Garamond `700`.
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
- Home desktop wash: `0.55`/`0.50`; radial vignette edge/center:
  `0.72`/`0.10`. Home mobile wash: `0.52`/`0.58`; vignette:
  `0.56`/`0.24`/`0.40`.
- Items catalogue desktop wash: `0.62`/`0.55`; radial vignette edge/center:
  `0.70`/`0.15`. Catalogue mobile wash remains `0.56`/`0.64`.
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
- Desktop container: `1760px` maximum width with `28px` gutters; header uses
  the handoff's three-column logo/navigation/search geometry.
- Preserve active navigation, visible focus, and overflow-free responsiveness.
- Items and Recipes directories use a `100vh` desktop shell with internal
  result scrolling and no desktop footer; return to document flow below
  `1180px`.
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
- Calibrated Item detail: full `1760px` desktop content measure, `28px`
  primary/rail gap, fixed `272px` supporting rail, and a flat (unbordered)
  identity row. Use a `180×180px`, `14px`-radius art frame with centered
  `128×128px` content; begin copy `6px` from the top, then an `11px` uppercase
  category, `40px` title, and `14.5px` summary capped at `640px`. Stack the rail
  and identity row at narrow widths while retaining the art frame's dimensions.
- Calibrated Recipe detail: full `1760px` desktop content measure and no
  visible sidebar. Use a flat `180×180px` warm-amber art frame with centered
  `128×128px` content and a bottom-right yield badge. Copy begins `6px` from
  the top: `11px` `Profession Recipe` eyebrow, `40px` title, data-derived
  `14.5px` summary capped at `640px`, then Profession/optional level/EXP chips.
- Recipe Ingredients begin `32px` after the hero. The heading rule spans the
  main measure; the list is `538px` wide at desktop, with `8px` outer padding,
  `6px` gaps, `32px` images, and right-aligned quantities. Crafted result,
  Related Recipes, verification, and update metadata follow below without
  recreating a sidebar.

### Public resource responsibilities

- Recipes index is the canonical full Recipe catalogue: approved result-focused
  cards, twelve-Recipe pagination, and one server-rendered Profession filter
  backed by `Recipe.profession`. Player Class filtering is not part of the
  Recipe domain.
- Items index is the canonical full Item catalogue: deterministic pagination
  and a server-rendered Item Category filter through `Item.category`.
- Profession detail explains a discipline with the handoff's flat neutral
  identity, real fact chips, complete linked Recipe grid/list, and inline
  Verification. Recipe, resulting Item, and Ingredient remain distinct links.
- Class detail is an independent resource surface: the handoff's flat neutral
  identity, optional image/description, one factual Resource chip, and inline
  Verification. It has no Recipe count, Recipe previews, or Recipe-catalogue
  link.
- Category detail describes and counts an Item type, then links to the
  canonical filtered Items index. It does not duplicate Item or Recipe grids.
- Location detail owns its real ancestor breadcrumb, direct children, direct
  Shops, obtainable Items, and access note. It never infers nearby Locations,
  a Region relation, or NPC data.
- Shops catalogue owns Shop search and preserves real Location, inventory, and
  public Verification facts. It never infers a Shop category/type.
- Profession detail is the approved exception to the canonical-catalogue rule:
  its handoff explicitly presents that Profession's complete craftable output
  directory. Other explanatory/contextual lists do not inherit this pattern.
- Profession and Class both remain atmosphere-free unless a future atmosphere
  is explicitly approved.
- Recipe detail shows its Profession, optional required Profession level, and
  EXP reward as hero chips. Recipe cards expose the Profession level when
  present.

### Public Item catalogue cards

- Keep Item cards visually simpler than Recipe cards.
- Center the fixed image/fallback stage; genuine images and fallbacks use
  identical geometry.
- Item title: left-aligned, `13.5px`, `1.25` line-height, one-line ellipsis.
- Category: Category name only, directly beneath the title, left-aligned,
  `10.5px`, uppercase, and muted gold.
- Render a two-line real description and a quiet first-source footer when
  those facts exist.
- Never show a `Category:` prefix, Tradeable status, or base value.
- Preserve full-card navigation, visible focus, and the responsive catalogue
  grid.

### Public Recipe catalogue cards

- Scope the handoff card treatment to canonical `/recipes`; Profession preview
  cards retain the shared explanatory composition.
- Grid: `repeat(auto-fill, minmax(190px, 1fr))`, `12px` gaps, seven desktop
  columns alongside the `272px` overview rail.
- At `1920×1080`, grid cards render `190×317px`: `12px` padding, a
  `166×166px` result-art frame with centered `104px` content, and a factual
  yield badge at bottom left.
- Title: `13.5px`, one-line ellipsis. Follow with compact uppercase Profession
  plus non-collapsing `Lvl` metadata.
- Grid view exposes three linked `36px` Ingredient previews; preserve real
  additional-Ingredient disclosure and tooltips.
- Put schema-backed EXP reward in the ruled card footer.
- List view has an explicit Recipe / Profession / EXP / Ingredients heading
  row. Desktop result rows render `1402×64px` with a `50px` result stage,
  `110px` title, `80px` Profession/level, `55px` EXP, and a `1011px`
  Ingredients region; linked Ingredient stages are `42px` outer size.
- Grid/List is a client presentation switch over the same server-rendered
  Recipe facts and links. Retain deterministic twelve-Recipe pagination rather
  than copying the handoff's decorative infinite-scroll sentinel.

### Public Profession catalogue cards

- `/professions` uses the archived handoff's roomier two-column discipline
  ledger beside the shared `272px` overview rail. Grid cards use `20px` gaps,
  `20px` padding, `14px` corners, and a fixed `130px` square image stage with
  centered `88px` content.
- Card copy uses a `19px` title, a compact uppercase `Profession` resource
  label, up to three lines of the real plain compatibility description, then
  a ruled factual footer for Recipe count and the shared maximum Profession
  level when that progression data exists.
- The handoff's Gathering/Production taxonomy is not in the production schema,
  so neither its filter nor its counts render. Name search is a real
  server-rendered GET query; Grid/List reorganize the same Prisma result set.
- The overview reports only real totals: Professions, assigned Recipes,
  verified entries, and the maximum stored Profession level. Full-card links,
  deterministic alphabetical ordering, image fallbacks, and mobile stacking
  remain intact.
- The handoff's shared catalogue scenic layer is presentation, not a new
  Profession atmosphere. It reuses the managed catalogue asset/crops and does
  not change content geometry or introduce a Profession-specific background.

### Public Profession detail

- Use the full `1760px` detail measure. The hero is flat: `180px` square art
  frame with `128px` content, then copy beginning `6px` from the top. Use an
  `11px` uppercase resource eyebrow, `40px` serif title, and `14.5px` authored
  description capped at `640px`.
- Chips expose only real facts: Resource (`Profession`), maximum stored shared
  Profession level when present, and the live Recipe count. Never translate
  the handoff's unsupported Gathering/Production type into production data.
- The Recipe disclosure begins `32px` after the hero. Its reveal arrow rotates
  in `150ms`, the gold rule sweeps in over `350ms`, and cards enter over
  `220ms` with `30ms` stagger capped at `330ms`. Grid/List switch the same
  server-rendered Recipe set; reduced-motion users receive no entrance motion.
- Grid uses `repeat(auto-fill, minmax(280px, 1fr))` with `14px` gaps. Cards use
  a `78px` result stage with `64px` content and a factual yield badge, then
  Recipe/Profession/level and three linked `36px` Ingredient previews. The
  additional-Ingredient control opens a compact anchored panel.
- Recipe title, resulting Item stage, and every Ingredient are separate
  canonical links with distinct accessible names. List mode adds real EXP and
  exposes the same facts without another query. All real Recipes render; the
  prototype runtime's mock pool is not a pagination authority.
- Preserve rich text, quiet image fallbacks, hide-empty Recipe section,
  verification/build metadata, and factual updated date beneath the handoff
  composition. The managed detail scenic layer is not a Profession-specific
  atmosphere.

### Public Class catalogue cards

- `/classes` uses the handoff's two-column ledger geometry beside the shared
  `272px` overview rail: `20px` grid gaps, `20px` card padding, `14px` corners,
  and a `130px` image stage with centered `88px` content. The stage retains the
  handoff's restrained lavender-neutral radial highlight.
- Copy uses a `19px` Class title, compact uppercase `Class` resource label, up
  to three lines of real plain compatibility description, and a ruled factual
  verification state. The list view reorganizes the same fields.
- PlayerClass has no production focus/type, bonus, level, Recipe requirement,
  or Recipe-gating relationship. Omit the prototype filter and those card or
  overview values rather than simulating them.
- Name search is a real server GET query. Overview values are total Classes,
  verified entries, and current matches. Preserve alphabetical ordering,
  full-card links, the shared `220ms`/`30ms` entrance stagger, fallbacks,
  reduced motion, and single-column mobile transition.
- The managed catalogue scenic layer is shared presentation and does not create
  a Class-specific atmosphere or gameplay meaning.

### Public Class detail

- `/classes/[slug]` uses the handoff's flat, full-width identity composition
  within the `1760px` content measure: a `180px` image stage, `128px` content
  inset, `28px` gap, and `6px` top copy inset. The stage keeps the restrained
  lavender-neutral radial highlight used by the Class catalogue.
- The eyebrow is `11px` uppercase, the Class title is `40px`, and rich authored
  description copy is `14.5px`/`1.7` with a `640px` maximum reading measure.
- Production PlayerClass has no focus, bonus, maximum-level, Profession, or
  Recipe fields. Render only the factual `Resource: Class` chip, linked back to
  the Classes catalogue; do not synthesize prototype attributes.
- Hide absent description and update metadata, keep Verification inline below
  the hero, and preserve the shared detail scenic layer as presentation rather
  than a Class-specific atmosphere.

### Public Locations catalogue

- `/locations` follows the handoff's nested ledger within the shared `1760px`
  catalogue shell: `16px 28px` page inset, `22px` title, `20px` toolbar gap,
  and `26px` between root groups. The results column fills the available width
  and becomes its own vertical scroller at desktop catalogue widths.
- Topmost production Location records are the factual root headings. Their
  descendants flatten beneath them in canonical Location-type order with a
  ruled `11px` uppercase subheading. Never invent a World, Region, or NPC model.
- Cards use an auto-fill `minmax(220px, 1fr)` grid with `12px` gaps, `11px`
  padding, a `52px` green-neutral stage with `34px` content, a `13.5px` name,
  factual type, and real direct-Shop count. Keep the handoff's `220ms`/`30ms`
  entrance stagger and `130ms` fold exit.
- Name search and multi-select Location-type filtering are real GET queries.
  Root and type folds are accessible disclosures; empty results retain the
  handoff's reset guidance. All motion respects reduced-motion preference.

### Public Location detail

- `/locations/[slug]` uses a `1fr / 272px` layout with a `28px` gap. The main
  column carries the full root-first breadcrumb, a flat `180px` green-neutral
  image stage with `128px` content, and the shared `40px` identity typography;
  the facts rail is sticky at `88px` on desktop and stacks below at `940px`.
- Identity chips expose only schema-backed type, direct Sub-location count,
  and direct Shop count. The facts rail adds parent and unique obtainable-Item
  count. The optional production access note becomes the Traveler's Note.
- Direct children—not same-region or inferred nearby records—use the handoff's
  collapsible Location directory with grouped types, grid/list modes,
  `220ms` section exit, and `130ms` type-fold exit. Grid cards use `14px`
  padding around the shared `52px` green-neutral stage.
- Direct Shops and grouped obtainable Items remain separate collapsible
  production relationships below the hero. Reuse the same compact horizontal
  card geometry, retain canonical links and descriptions, hide empty sections,
  and preserve reduced motion. Public Location verification remains admin-only.

### Public Shops catalogue

- `/shops` uses the handoff's full-width catalogue ledger with the same
  `16px 28px` inset, `22px` heading, `20px` toolbar gap, `26px` root-group
  rhythm, desktop result scroller, and scenic catalogue surface as Locations.
- Shop has no production category/type field. Group Shops first by their real
  topmost Location and then by the assigned Location's canonical type; label
  the second fold `{Location type} Shops`. Omit the prototype Shop-type filter.
- Cards use `repeat(auto-fill, minmax(220px, 1fr))`, `12px` gaps, `11px`
  padding, and a `52px` gold-neutral stage with `34px` content. Keep the title
  on one ellipsized line, a factual `Shop` label, Location name,
  inventory count, and public Verification string.
- Search remains a real server GET across Shop name, description, and Location.
  Preserve query summary, clear/reset actions, `220ms`/`30ms` card entrance,
  `130ms` fold exit, hide-empty behavior, and reduced motion.

### Public Shop detail

- `/shops/[slug]` uses the managed detail scenic surface, canonical hierarchy
  breadcrumb, `180px` gold-neutral identity stage with `128px` content, and
  shared `40px` detail typography. Rich description and Verification remain
  optional and hide completely when empty.
- Shop has no production type, keeper, or NPC relation. Render `Shop` as the
  resource label and only real Region, Location, and Location-type facts.
- Inventory is a `520px` selectable panel with a `76px` selected stage,
  `72px` selected content, `28px` row art, `8px` row rhythm, and `40ms`
  entrance stagger. Hover/select uses the handoff's `180ms` translate, glow,
  image-scale, cursor-reveal, and price-emphasis motion.
- Keep ordered listings, canonical Item links, Currency identity, large prices,
  optional notes, independent Verification, keyboard selection, hide-empty
  behavior, and reduced motion.

### Shared public interaction fidelity

- Public nav links and the World trigger share the handoff's `180ms` border and
  text-glow behavior without recoloring inactive labels. Align World vertically
  with the link row; keep its panel centered throughout exact `200ms` cubic-in,
  `180ms` out, and `30ms` item-stagger animations.
- Every public search input uses the shared header-search interaction primitive:
  `200ms` border/background/glow and icon transitions, the exact `1.6s` hover
  pulse, focus cancellation, muted placeholder treatment, and reduced-motion
  suppression. Route-specific geometry and GET/query behavior stay independent.
  The logo uses the handoff's dual-shadow `3.2s` breathing keyframes.
- Shared disclosure close is not an immediate unmount: retain content for the
  `220ms` line sweep-out and apply either `120ms` item exit or `200ms` stagger
  exit by content family. Shared ingredient popovers use `200ms` cubic entrance
  and `180ms` exit.
- Breadcrumb color/underline transitions are `180ms`; view controls and common
  card surfaces use `200ms`; Recipe ingredient hover uses the exact `180ms`
  cursor, 4px shift, sprite glow, and quantity emphasis treatment.
- `prefers-reduced-motion` removes transitions/transforms and makes all delayed
  unmounts immediate while preserving final visual and accessible states.
- Menu and disclosure exits are interruptible; reactivation during an exit
  cancels the pending unmount instead of dropping the user's input.

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
- Item and Recipe detail use `128×128px` content inside calibrated
  `180×180px` art frames. Other detail resources may retain `192×192px`
  content inside a `240×240px` hero stage until their own handoff calibration
  is completed.
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
