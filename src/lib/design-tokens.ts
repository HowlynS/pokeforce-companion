export const designTokens = {
  colors: {
    background: "#111514",
    surface: "#171b19",
    surfaceSoft: "#1c201e",
    border: "#3a3528",
    text: "#eee7d8",
    textMuted: "#aaa69c",
    accent: "#c39a4b",
    accentSoft: "#d8b562",
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
