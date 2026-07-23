// Canonical section-icon mapping (Admin Editor Section Redesign pass):
// the ONE place every semantic editor-section category maps to its
// Lucide icon — the same icon always means the same kind of section,
// across every resource, rather than a different icon chosen ad hoc per
// page. Callers reference SECTION_ICONS.<category>, never import a raw
// Lucide icon of their own for a section heading.

import {
  Clock,
  Database,
  DownloadCloud,
  FileText,
  GitBranch,
  History,
  IdCard,
  ImageIcon,
  Info,
  Layers,
  Link2,
  ListChecks,
  ListTree,
  Package,
  PackageOpen,
  ScrollText,
  ShieldCheck,
  Sliders,
  Tags,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

export const SECTION_ICONS = {
  /** Name, Page address — every resource's own identity fields. */
  identity: IdCard,
  /** Description and other freeform written content. */
  content: FileText,
  /** Category assignment and similar classification fields. */
  classification: Tags,
  /** Held item, Tradeable, Base value, and similar gameplay-only flags. */
  gameplayDetails: Sliders,
  /** Recipe's Resulting item / quantity range. */
  output: PackageOpen,
  /** Recipe's Profession / Required level crafting context. */
  requirements: ListChecks,
  /** Recipe Ingredients. */
  ingredients: Layers,
  /** Acquisition Source's own Type field. */
  source: DownloadCloud,
  /** Acquisition Source's Location/Profession pairing. */
  linkedContext: Link2,
  /** Acquisition Source's label/quantity/notes. */
  details: Info,
  /** Location parent assignment. */
  hierarchy: GitBranch,
  /** Location's direct children. */
  subLocations: ListTree,
  /** A record's existing linked rows (Acquisition Sources list). */
  existingSources: Database,
  image: ImageIcon,
  verification: ShieldCheck,
  timestamps: Clock,
  dangerZone: TriangleAlert,
  /** Recipe relationships (Item Used in Recipes, Profession Recipes) —
      the same icon admin-nav.ts already uses for the Recipes
      destination. */
  recipes: ScrollText,
  /** Item relationships (Category Items) — the same icon admin-nav.ts
      already uses for the Items destination. */
  items: Package,
  /** Game Versions — the same icon admin-nav.ts already uses for the
      Game Versions destination. */
  gameVersions: History,
} as const satisfies Record<string, LucideIcon>;

export type SectionIconKey = keyof typeof SECTION_ICONS;
