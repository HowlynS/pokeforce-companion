# Checkpoint: Claude Design public redesign — 02 (production handoff)

**Source date:** 2026-08-07 (zip timestamp on `Items directory design.zip`, delivered 2026-08-08)
**Archived:** 2026-08-08
**Status: design reference only.** Nothing under `source/` is production code, is imported
by any runtime route, or drives Prisma/gameplay data. It exists so implementation slices can
be visually compared against the original handoff and so provenance (exact bytes, as
delivered) is auditable later.

## What this is

The full 16-screen `design_handoff_merchants_codex/` export referenced by
`claude-code-public-overhaul-handoff.md`, preserved byte-for-byte under
`source/design_handoff_merchants_codex/`:

- `README.md` — the design system spec (tokens, motion, screen-by-screen behavior, known gaps)
- 16 `.dc.html` screens (Landing, World Navigation, 7× Directory, 7× Detail)
- `codex-data.js` — the prototype's canonical mock dataset (NOT gameplay truth)
- `support.js` — the prototype runtime (reference only, never ported)
- `assets/` — background, logo, 8 source sprites, 48 pre-rendered sprite sizes

`manifest.sha256.txt` lists SHA-256 + byte size for every file in the bundle, generated
directly from the delivered zip's extracted contents, for future integrity/provenance checks.

## Relationship to `design-checkpoints/claude-public-redesign-01/`

That earlier checkpoint (still present on `design/claude-public-redesign-checkpoint-1`, not
yet merged to `main`) archived a **different, partial** iteration of this same design
direction — 5 of the 16 screens, no `codex-data.js`, a different palette/manifest shape, and
its own README explicitly states it was never connected to Prisma/routing/Appearance/auth.
It remains useful prior art (its `notes/visual-decisions.md` and
`comparisons/current-app-mapping.md` record earlier reasoning) but this checkpoint (`02`)
supersedes it as the authoritative design source for the current rollout, since it is the
complete, final-fidelity 16-screen export the production handoff instructions require.

## Rules while this checkpoint exists

- No production route may import anything from `source/design_handoff_merchants_codex/`
  (`support.js`, `codex-data.js`, or any `.dc.html` file).
- `codex-data.js` is never seeded into Prisma as gameplay truth.
- Treat `source/design_handoff_merchants_codex/README.md` as the fidelity/behavior
  specification; treat the `.dc.html` files as structural/visual reference only.

See `mapping.md` in this same directory for the screen → production route mapping,
domain-gap analysis, and reusable-token/component audit this checkpoint was archived to support.
