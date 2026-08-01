export const PUBLIC_DESIGN_VIEWPORT_CATEGORIES = [
  "desktop",
  "intermediate",
  "mobile",
] as const;

export type PublicDesignViewportCategory =
  (typeof PUBLIC_DESIGN_VIEWPORT_CATEGORIES)[number];

export type PublicDesignViewport = {
  id: string;
  label: string;
  width: number;
  height: number;
  category: PublicDesignViewportCategory;
  expectedLayout: string;
  primary: boolean;
};

/**
 * Application-owned logical viewports for public redesign review. Keep this
 * registry browser-agnostic: admin preview chrome, Playwright, and capture
 * scripts all consume the same dimensions and acceptance labels.
 */
export const PUBLIC_DESIGN_VIEWPORTS = [
  {
    id: "desktop-1920",
    label: "Desktop 1920",
    width: 1920,
    height: 1080,
    category: "desktop",
    expectedLayout:
      "Bounded desktop shell; catalogue grids and detail sidebars use their full desktop composition.",
    primary: true,
  },
  {
    id: "desktop-2560",
    label: "Desktop 2560",
    width: 2560,
    height: 1440,
    category: "desktop",
    expectedLayout:
      "Bounded content remains centered while approved large-screen density rules apply.",
    primary: true,
  },
  {
    id: "ultrawide-3440",
    label: "Ultrawide 3440",
    width: 3440,
    height: 1440,
    category: "desktop",
    expectedLayout:
      "Content remains bounded and centered; scenic imagery may extend through the outer gutters.",
    primary: true,
  },
  {
    id: "intermediate-1000",
    label: "Intermediate 1000",
    width: 1000,
    height: 1100,
    category: "intermediate",
    expectedLayout:
      "Public header wraps, detail sidebars stack, and dense grids reduce columns without document overflow.",
    primary: true,
  },
  {
    id: "tablet-768",
    label: "Tablet 768",
    width: 768,
    height: 1024,
    category: "intermediate",
    expectedLayout:
      "Detail identity panels approach their stacked form and two-column catalogues remain usable where space permits.",
    primary: false,
  },
  {
    id: "mobile-390",
    label: "Mobile 390",
    width: 390,
    height: 844,
    category: "mobile",
    expectedLayout:
      "Single-column content, wrapped navigation and filters, stacked detail regions, and no horizontal overflow.",
    primary: true,
  },
] as const satisfies readonly PublicDesignViewport[];

export type PublicDesignViewportId =
  (typeof PUBLIC_DESIGN_VIEWPORTS)[number]["id"];

export const PRIMARY_PUBLIC_DESIGN_VIEWPORTS =
  PUBLIC_DESIGN_VIEWPORTS.filter((viewport) => viewport.primary);

export function getPublicDesignViewport(
  id: string
): (typeof PUBLIC_DESIGN_VIEWPORTS)[number] | undefined {
  return PUBLIC_DESIGN_VIEWPORTS.find((viewport) => viewport.id === id);
}
