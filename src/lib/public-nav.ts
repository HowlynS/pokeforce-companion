// The four flat top-level resources, shared between the header's primary
// nav (main-nav.tsx) and the footer (app-shell.tsx) so both read from one
// list. Locations and Shops live under the header's World dropdown
// instead (world-menu.tsx) — the footer intentionally mirrors the
// handoff's flat four-link footer, not the full site map.
export const PUBLIC_NAV_ITEMS = [
  { label: "Items", href: "/items" },
  { label: "Recipes", href: "/recipes" },
  { label: "Professions", href: "/professions" },
  { label: "Classes", href: "/classes" },
] as const;
