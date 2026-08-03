# Claude public redesign checkpoint 01

## Purpose

This checkpoint preserves the unfinished first Claude Design iteration of the
Merchants Codex public site. It protects against session or export loss,
provides a stable visual comparison point, and supports a later controlled
integration effort.

The supplied project archive was copied byte-for-byte into
`source/project-archive/`. The `.dc.html` design documents were rendered only
to create the reference captures in `screenshots/`; they were not adapted to
the application.

## Explicit non-goals

- This checkpoint is not production-ready and must not be merged into `main`.
- It is not connected to Prisma, current routing, Appearance, authentication,
  authorization, or private/public access behavior.
- It is not authoritative over application behavior or gameplay facts.
- It is not approved for direct replacement of current public pages.
- It does not install the archive's external runtime or font dependencies.

## Snapshot contents

The received archive contains 38 files (23,194,771 bytes):

- five Claude Design documents: Classes Directory, Item Detail, Items
  Directory, Professions Directory, and Recipes Directory;
- the generated Claude Design `support.js` runtime and `.thumbnail` preview;
- one normalized scenic background, one Merchants Codex logo, and eight 32x32
  item sprite files under `assets/`;
- the original `uploads/` collection: three generated full-page visual
  references, eight item sprites, the logo and background masters, one larger
  page crop, and seven small UI-detail crops.

The exact per-file asset record is in
[`notes/asset-inventory.md`](notes/asset-inventory.md). The normalized
background and logo are byte-identical to the already tracked application
masters; no archive file was copied into production `public/`.

## Missing or unresolved material

- No homepage, Recipe detail, Profession detail, Class detail, Categories,
  Locations, Shops, search-results, error, loading, or not-found design
  document was supplied.
- No source-session history, design rationale, standalone token file, source
  map, package manifest, asset license/provenance record, or font file was
  supplied.
- No explicit mobile or tablet composition exists. The documents contain no
  media queries; the captured 390px Item detail visibly overlaps and narrows
  prose to unusable columns.
- The archive leaves canonical navigation, pagination, empty/loading/error
  behavior, keyboard interaction, focus treatment, and real data mapping
  unresolved.
- Sprite and uploaded-reference provenance is unknown. They remain
  archival-only pending public-use and beta-restriction review.

## Known mock behavior

- All gameplay records, counts, descriptions, categories, sources, class
  bonuses, levels, yields, EXP values, ingredients, related items, and
  verification summary counts are hardcoded examples.
- Every navigation and breadcrumb destination uses `href="#"`.
- Search and filters operate only on in-document arrays.
- Directory pages switch between grid and list presentations and simulate
  incremental loading with `IntersectionObserver`; they do not implement the
  application's canonical pagination.
- Recipe ingredient expansion and description disclosure depend on pointer
  hover/click behavior and are not complete keyboard interactions.
- Global search, cards, and detail relations do not navigate to real routes.
- The Item detail's merchant note, sell value, stack size, related items, and
  some acquisition/recipe claims are speculative rather than schema-backed.

## Current-app contracts a future integration must preserve

Future work must begin with
[`PUBLIC_REDESIGN_INTEGRATION.md`](../../PUBLIC_REDESIGN_INTEGRATION.md) and the
typed registries under [`src/lib/public-design`](../../src/lib/public-design).
The guarded workflow remains:

- `pnpm public:design:fixtures`
- `pnpm public:design:capture`
- `pnpm test:public-design`

A production implementation must preserve Appearance-managed assets and
fallbacks, private/public access behavior, canonical routes and query strings,
hide-empty rules, real bounded Prisma queries, authentication and
authorization boundaries, sprite/image geometry, safe rich-text rendering,
responsive behavior, accessibility, and the application-owned viewport and
acceptance contracts.

The archive's visual ideas may be compared or reinterpreted. Its mock data,
runtime, inline-style implementation, route behavior, and invented gameplay
relationships are not contracts.

## Future integration rule

A later production integration must start from a fresh branch based on the
then-current `main`. Do not merge this archival branch wholesale and do not
promote files from `source/project-archive/` directly into active application
paths.
