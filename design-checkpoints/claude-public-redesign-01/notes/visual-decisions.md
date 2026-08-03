# Visual decision log

This log records only what is visible in the supplied project archive and its
uploaded reference images. "Approved direction" means the decision also
matches the repository's already accepted interface system; it does not
approve the archive's implementation.

## Approved direction

- **Color roles:** charcoal page `#111514`, near-black green surfaces
  `#171b19`/`#1c201e`, warm border `#3a3528`, ivory `#eee7d8`, muted neutral
  `#aaa69c`, and restrained gold `#c39a4b`/`#d8b562`.
- **Body typography:** Manrope is used for navigation, controls, facts, and
  dense data.
- **Bounded desktop composition:** content is centered at a maximum width of
  about 1760px while scenic imagery continues through outer gutters.
- **Sprite treatment:** small source sprites are enlarged with
  `image-rendering: pixelated` inside restrained, fixed stages.
- **Hierarchy:** gold is reserved for active navigation, category/profession
  labels, quantities, headings inside side panels, and selected controls.

## Tentative

- **Display typography:** Cormorant Garamond at 500–700 replaces the current
  accepted DM Serif Display. The archive uses 22px directory headings and a
  40px Item detail title.
- **Header:** a floating rounded shell with warm border, dark translucent fill,
  blur, logo at left, centered nav, and search at right.
- **Directory geometry:** compact breadcrumb/title/toolbar above a dense main
  grid and narrow overview/about sidebar.
- **Card geometry:** 8–10px radii, quiet borders, dark inset image stages, dense
  12–14px padding, and almost no decorative shadow.
- **Interaction:** filter popovers, client-side search, grid/list modes,
  incremental loading, description tooltips, and recipe ingredient expansion.
- **Background:** one full-viewport scenic illustration at 90% image opacity
  with strong vertical and radial charcoal washes.

## Unresolved

- Whether descriptions and acquisition sources belong on Item catalogue
  cards.
- Whether directory overview/about panels justify real aggregate queries.
- Whether grid/list preference is local, persistent, or removed.
- Whether infinite loading is intentional or a prototype convenience.
- Whether Item detail needs Related Items, Merchant's Note, stack size, or sell
  value.
- Whether Recipe cards show EXP and Class requirements.
- Whether Profession/Class types, bonuses, max levels, and progression are real
  future gameplay concepts.
- Hover, active, focus, disabled, loading, error, and empty-state styling is
  incomplete or inconsistently represented.
- No animation rationale is supplied beyond a 300ms upward fade.

## Contradicted by another snapshot

The three uploaded full-page generated references predate or differ from the
`.dc.html` archive:

- Their headers use different logo scale, navigation sets, vertical spacing,
  and active-link ornament.
- Their directory headings are large editorial uppercase compositions with
  descriptive introductions and statistic rows; the archive uses compact
  22px headings and toolbars.
- The Items reference uses a category tab bar, price/value facts, and no
  grid/list toggle; the archive uses a filter menu, source labels, and a
  grid/list toggle.
- The Recipes reference uses profession tabs, category/sort controls,
  unlocked-only state, pagination, and editorial side cards; the archive uses
  a filter popover, level range, incremental loading, and a simpler summary.
- The Professions reference uses an eight-card grid and illustrated tip panel;
  the archive uses searchable/filterable two-column horizontal cards.

These conflicts are preserved as evidence. The project archive remains the
authoritative checkpoint state.

## Missing mobile decision

- No media query exists in any design document.
- Header wrapping, nav collapse, search placement, filter stacking, sidebar
  stacking, card columns, touch targets, and disclosure behavior are undefined.
- The 390x844 Item detail capture shows the desktop sidebar over the identity
  content and prose reduced to nearly one word per line.

## Missing implementation behavior

- Canonical link destinations and browser history.
- Server-backed search, filters, pagination, and empty/loading/error states.
- Appearance asset resolution and fallbacks.
- Hide-empty decisions for optional relationships.
- Keyboard and screen-reader interaction for popovers/disclosures.
- Reduced-motion behavior and complete focus states.
- Rich-text safety and long-content handling.
