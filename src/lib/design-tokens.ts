export const designTokens = {
  colors: {
    background: "#111514",
    surface: "#171b19",
    surfaceSoft: "#1c201e",
    // `border` stays the existing chrome/art-frame border value used
    // throughout the app today (cards, panels, art frames). `borderMuted`
    // is the Claude Design handoff's separate *default* border role —
    // added alongside rather than renamed, so existing callers are
    // unaffected; new shared primitives should reach for the one that
    // matches their surface.
    border: "#3a3528",
    borderMuted: "#262b27",
    borderHover: "#4a4536",
    dividerMenu: "#2a2f28",
    text: "#eee7d8",
    textBody: "#c8c2b4",
    textMuted: "#aaa69c",
    textMeta: "#8a8579",
    textMetaDim: "#7d796f",
    textPlaceholder: "#6f6b61",
    accent: "#c39a4b",
    accentSoft: "#d8b562",
    accentBright: "#f4c542",
    accentHover: "#e0c079",
    menuSurface: "#191d1b",
    insetSurface: "#0f1210",
    artFrameSurface: "#141715",
    success: "#22c55e",
    warning: "#f97316",
    danger: "#ef4444",
  },
  layout: {
    maxWidth: "1200px",
    pagePadding: "24px",
    sectionGap: "32px",
  },
  // Three clearly separated title tiers: the page title (one h1 per page),
  // section headings (h2), and card titles (h3). Body text stays 16px.
  typography: {
    pageTitle: "36px",
    sectionTitle: "24px",
    cardTitle: "18px",
  },
  radius: {
    sm: "8px",
    md: "12px",
    lg: "16px",
  },
  shadow: {
    card: "0 20px 45px rgba(0, 0, 0, 0.25)",
  },
} as const;
