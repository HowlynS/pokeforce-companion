export const designTokens = {
  colors: {
    background: "#0f172a",
    surface: "#111827",
    surfaceSoft: "#1f2937",
    border: "#334155",
    text: "#f8fafc",
    textMuted: "#cbd5e1",
    accent: "#facc15",
    accentSoft: "#fde68a",
    success: "#22c55e",
    warning: "#f97316",
    danger: "#ef4444",
    // Admin editor accent (Slice 9B.2): purple, per the approved dark
    // admin mockup — editor chrome only, never the public design system.
    adminAccent: "#8b5cf6",
    adminAccentSoft: "#c4b5fd",
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
