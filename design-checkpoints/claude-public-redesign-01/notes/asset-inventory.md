# Asset inventory and safety notes

All paths below are relative to `source/project-archive/`. Nothing in this
checkpoint is served from production `public/`.

| File | Dimensions / format | Source and intended use | Status | Public-use / beta finding | Later action |
| --- | --- | --- | --- | --- | --- |
| `.thumbnail` | WebP container; dimensions not exposed by local decoder | Claude Design generated project thumbnail; Item detail overview | Generated, archival-only | Contains an unfinished design view; not approved as public content | Keep only in checkpoint |
| `assets/background.png` | 3876x1622 PNG | Normalized scenic background used by all five documents | Original source unknown; reusable concept | SHA-256 matches `public/images/backgrounds/merchants-codex-coastal-overlook.png`, already classified public | Future integration must use Appearance/current master, not this copy |
| `assets/merchants-logo.png` | 1394x486 PNG | Header logo used by all five documents | Original source unknown; reusable concept | SHA-256 matches `public/images/branding/merchants-codex-logo.png`, already classified public | Use current authoritative master through Appearance |
| `assets/sprites/chipped-pot.png` | 32x32 PNG | Reused mock Item/Class/Profession/Recipe sprite | Original/provenance unknown; archival-only | Public-use permission and possible game/IP restriction unknown | Replace or approve provenance before production |
| `assets/sprites/comet-shard.png` | 32x32 PNG | Reused mock sprite | Original/provenance unknown; archival-only | Same concern | Replace or approve provenance before production |
| `assets/sprites/dusk.png` | 32x32 PNG | Reused mock sprite | Original/provenance unknown; archival-only | Same concern | Replace or approve provenance before production |
| `assets/sprites/ether.png` | 32x32 PNG | Reused mock sprite | Original/provenance unknown; archival-only | Same concern | Replace or approve provenance before production |
| `assets/sprites/gigaton.png` | 32x32 PNG | Reused mock sprite | Original/provenance unknown; archival-only | Same concern | Replace or approve provenance before production |
| `assets/sprites/net.png` | 32x32 PNG | Reused mock sprite | Original/provenance unknown; archival-only | Same concern | Replace or approve provenance before production |
| `assets/sprites/paralyze-heal.png` | 32x32 PNG | Reused mock sprite | Original/provenance unknown; archival-only | Same concern | Replace or approve provenance before production |
| `assets/sprites/x-speed.png` | 32x32 PNG | Reused mock sprite | Original/provenance unknown; archival-only | Same concern | Replace or approve provenance before production |
| `uploads/ChatGPT Image 27 juil. 2026, 07_07_11 (1).png` | 1938x811 PNG | Generated Recipes-directory visual reference | Generated, archival-only | Contains invented counts, icons, imagery, and gameplay copy; not authoritative or approved for production | Retain as comparison only |
| `uploads/ChatGPT Image 27 juil. 2026, 07_07_11 (2).png` | 1938x811 PNG | Generated Items-directory visual reference | Generated, archival-only | Same concern | Retain as comparison only |
| `uploads/ChatGPT Image 27 juil. 2026, 07_07_11 (3).png` | 1938x811 PNG | Generated Professions-directory visual reference | Generated, archival-only | Same concern | Retain as comparison only |
| `uploads/chipped-pot.png` | 32x32 PNG | Original upload duplicated into normalized sprites | Byte duplicate; archival-only | Same finding as normalized counterpart | Retain unchanged |
| `uploads/comet-shard.png` | 32x32 PNG | Original upload duplicated into normalized sprites | Byte duplicate; archival-only | Same finding as normalized counterpart | Retain unchanged |
| `uploads/dusk.png` | 32x32 PNG | Original upload duplicated into normalized sprites | Byte duplicate; archival-only | Same finding as normalized counterpart | Retain unchanged |
| `uploads/ether.png` | 32x32 PNG | Original upload duplicated into normalized sprites | Byte duplicate; archival-only | Same finding as normalized counterpart | Retain unchanged |
| `uploads/gigaton.png` | 32x32 PNG | Original upload duplicated into normalized sprites | Byte duplicate; archival-only | Same finding as normalized counterpart | Retain unchanged |
| `uploads/net.png` | 32x32 PNG | Original upload duplicated into normalized sprites | Byte duplicate; archival-only | Same finding as normalized counterpart | Retain unchanged |
| `uploads/paralyze-heal.png` | 32x32 PNG | Original upload duplicated into normalized sprites | Byte duplicate; archival-only | Same finding as normalized counterpart | Retain unchanged |
| `uploads/x-speed.png` | 32x32 PNG | Original upload duplicated into normalized sprites | Byte duplicate; archival-only | Same finding as normalized counterpart | Retain unchanged |
| `uploads/Merchantslogo.png` | 1394x486 PNG | Original logo upload | Byte duplicate; archival-only | Matches already-public authoritative master | Retain unchanged; do not promote this duplicate |
| `uploads/WebsiteBackgroundUpScaled.png` | 3876x1622 PNG | Original scenic-background upload | Byte duplicate; archival-only | Matches already-public authoritative master | Retain unchanged; do not promote this duplicate |
| `uploads/pasted-1785403125779-0.png` | 1447x811 PNG | Recipe grid visual reference | Pasted screenshot, archival-only | Contains unfinished mock UI and item imagery; approval/provenance unknown | Retain as comparison only |
| `uploads/pasted-1785404759542-0.png` | 53x54 PNG | Ingredient-overflow `+2` crop | Pasted UI crop, archival-only | No standalone production value | Retain as evidence only |
| `uploads/pasted-1785405022358-0.png` | 79x55 PNG | Ingredient/overflow crop | Pasted UI crop, archival-only | Includes unknown-provenance sprite imagery | Retain as evidence only |
| `uploads/pasted-1785405069272-0.png` | 414x672 PNG | Expanded ingredient-disclosure visual reference | Pasted screenshot, archival-only | Contains unfinished mock data and sprites | Retain as comparison only |
| `uploads/pasted-1785405291710-0.png` | 184x50 PNG | Ingredient row/overflow crop | Pasted UI crop, archival-only | Includes unknown-provenance sprite imagery | Retain as evidence only |
| `uploads/pasted-1785408951541-0.png` | 264x124 PNG | Recipe list-row crop | Pasted UI crop, archival-only | Contains unfinished mock content | Retain as evidence only |
| `uploads/pasted-1785414581865-0.png` | 82x30 PNG | Recipe profession-label crop | Pasted UI crop, archival-only | Contains unfinished mock content | Retain as evidence only |
| `uploads/pasted-1785420637730-0.png` | 998x732 PNG | Recipes list-mode visual reference | Pasted screenshot, archival-only | Contains unfinished mock data and sprites | Retain as comparison only |

## Safety summary

- No secrets, credentials, cookies, tokens, emails, or personal account data
  were detected in text source.
- The checkpoint is outside production `public/` and is not imported by active
  code, so its images are not application-served assets.
- The background and logo are already-public, byte-identical masters.
- Sprite provenance and public-use permission are unknown. They may be subject
  to game/IP or beta restrictions and must not be promoted from this archive.
- Generated and pasted screenshots contain unfinished visual concepts and
  invented gameplay facts. They are evidence only, never production content.
