// The ONE definition of the admin shell's navigation. Game Versions and
// Currencies are settings-scoped supporting resources after the primary
// content destinations. Game Versions remains ahead of Currencies in that
// supporting-resource group, while Shops is a primary content destination.
// Acquisition Sources remains deliberately absent (contextual, managed under its
// owning item), along with any users/roles/audit/route-hub destinations.
// Pure data plus a pure active-state rule — no React, no environment —
// so the mapping every admin route depends on is unit-testable.

// A stable identifier, not a component: this module stays pure data (no
// React, no icon-library import) so it remains unit-testable without a
// render environment. src/components/admin/admin-nav.tsx maps each
// identifier to its Lucide icon component.
export type AdminNavIcon =
  | "dashboard"
  | "appearance"
  | "items"
  | "recipes"
  | "professions"
  | "playerClasses"
  | "categories"
  | "locations"
  | "shops"
  | "gameVersions"
  | "currencies";

export type AdminNavItem = {
  label: string;
  href: string;
  icon: AdminNavIcon;
};

export const ADMIN_NAV_ITEMS: readonly AdminNavItem[] = [
  { label: "Dashboard", href: "/admin", icon: "dashboard" },
  { label: "Items", href: "/admin/items", icon: "items" },
  { label: "Recipes", href: "/admin/recipes", icon: "recipes" },
  { label: "Professions", href: "/admin/professions", icon: "professions" },
  { label: "Classes", href: "/admin/classes", icon: "playerClasses" },
  { label: "Locations", href: "/admin/locations", icon: "locations" },
  { label: "Shops", href: "/admin/shops", icon: "shops" },
  {
    label: "Game Versions",
    href: "/admin/settings/game-versions",
    icon: "gameVersions",
  },
  {
    label: "Currencies",
    href: "/admin/settings/currencies",
    icon: "currencies",
  },
] as const;

export const SITE_ADMIN_NAV_ITEMS: readonly AdminNavItem[] = [
  { label: "Appearance", href: "/admin/appearance", icon: "appearance" },
] as const;

// Categories remains an independent model, route, and workspace, but its
// Item-only classification role makes it a child of Items in navigation.
export const ITEM_ADMIN_NAV_CHILDREN: readonly AdminNavItem[] = [
  { label: "Categories", href: "/admin/categories", icon: "categories" },
] as const;

export const ADMIN_NAV_DESTINATIONS: readonly AdminNavItem[] = [
  ...ADMIN_NAV_ITEMS,
  ...ITEM_ADMIN_NAV_CHILDREN,
  ...SITE_ADMIN_NAV_ITEMS,
] as const;

/**
 * True when the given nav item should be marked active for the current
 * pathname. Dashboard matches only exactly "/admin" — every other admin
 * route belongs to a more specific section (or, like the settings pages,
 * deliberately to none). A resource item is active on its list route and
 * every child route (edit, delete, nested sources, ...), matched on the
 * path-segment boundary so "/admin/itemsomething" can never light up
 * Items.
 */
export function isAdminNavItemActive(
  itemHref: string,
  pathname: string
): boolean {
  if (itemHref === "/admin") {
    return pathname === "/admin";
  }

  return pathname === itemHref || pathname.startsWith(`${itemHref}/`);
}
