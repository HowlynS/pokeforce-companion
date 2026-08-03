# Rendered screenshot index

These PNGs were rendered directly from the unchanged `.dc.html` documents in
`../source/project-archive/` on 2026-08-03 with local Chromium. They are visual
references only. Rendering loaded the archive's external React/Babel and
Google Fonts references; no application server, Prisma data, production route,
or authenticated session was used.

| Filename | Page/state | Viewport | Source | Caveats |
| --- | --- | --- | --- | --- |
| `classes-directory-1920x1080.png` | Classes Directory, default grid | 1920x1080 | `Classes Directory.dc.html` | Hardcoded five-Class dataset and unsupported type/bonus/level facts |
| `item-detail-1920x1080.png` | Potion Item detail | 1920x1080 | `Item Detail.dc.html` | Entire record, relations, values, and merchant note are static mock content |
| `items-directory-1920x1080.png` | Items Directory, default grid | 1920x1080 | `Items Directory.dc.html` | Hardcoded 37 Items; first 24 loaded; placeholder links |
| `professions-directory-1920x1080.png` | Professions Directory, default grid | 1920x1080 | `Professions Directory.dc.html` | Hardcoded nine Professions and unsupported type/max-level facts |
| `recipes-directory-1920x1080.png` | Recipes Directory, default grid | 1920x1080 | `Recipes Directory.dc.html` | Hardcoded 68 Recipes; first 21 loaded; invented Class requirements |
| `items-directory-2560x1440.png` | Items Directory, large desktop | 2560x1440 | `Items Directory.dc.html` | Demonstrates bounded 1760px content and scenic outer gutters |
| `recipes-directory-3440x1440.png` | Recipes Directory, ultrawide | 3440x1440 | `Recipes Directory.dc.html` | Demonstrates bounded content; very large scenic gutters remain |
| `items-directory-1000x900.png` | Items Directory, intermediate width | 1000x900 | `Items Directory.dc.html` | Desktop shell compresses rather than switching to an explicit responsive mode |
| `item-detail-390x844.png` | Potion Item detail, mobile audit | 390x844 | `Item Detail.dc.html` | Captures a real failure state: header clipping, sidebar overlap, and unusably narrow prose; not an approved mobile design |

No missing page or viewport was fabricated. The intermediate/mobile captures
document how the supplied desktop export actually behaves at those widths.
