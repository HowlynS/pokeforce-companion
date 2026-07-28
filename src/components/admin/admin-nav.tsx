"use client";

// Persistent admin navigation. Categories remains its own route and
// workspace, but its Item-only classification role makes it the one nested
// destination beneath Items.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ChevronDown,
  Coins,
  GraduationCap,
  Hammer,
  History,
  LayoutDashboard,
  MapPinned,
  Package,
  ScrollText,
  Shapes,
  Store,
  type LucideIcon,
} from "lucide-react";
import {
  ADMIN_NAV_ITEMS,
  ITEM_ADMIN_NAV_CHILDREN,
  isAdminNavItemActive,
  type AdminNavIcon,
  type AdminNavItem,
} from "@/lib/admin/admin-nav";

const ADMIN_NAV_ICONS: Record<AdminNavIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  items: Package,
  recipes: ScrollText,
  professions: Hammer,
  playerClasses: GraduationCap,
  categories: Shapes,
  locations: MapPinned,
  shops: Store,
  gameVersions: History,
  currencies: Coins,
};

export function AdminNav() {
  const pathname = usePathname() ?? "";
  const itemsRouteActive =
    isAdminNavItemActive("/admin/items", pathname) ||
    isAdminNavItemActive("/admin/categories", pathname);
  const [manualItemsState, setManualItemsState] = useState<{
    pathname: string;
    expanded: boolean;
  } | null>(null);
  const itemsExpanded =
    manualItemsState?.pathname === pathname
      ? manualItemsState.expanded
      : itemsRouteActive;

  function renderLink(item: AdminNavItem, nested = false) {
    const isActive = isAdminNavItemActive(item.href, pathname);
    const Icon = ADMIN_NAV_ICONS[item.icon];

    return (
      <Link
        key={item.href}
        href={item.href}
        className={
          nested ? "admin-nav-link admin-nav-link--nested" : "admin-nav-link"
        }
        aria-current={isActive ? "page" : undefined}
      >
        <Icon aria-hidden="true" className="admin-nav-icon" />
        {item.label}
      </Link>
    );
  }

  return (
    <nav aria-label="Admin navigation" className="admin-nav">
      {ADMIN_NAV_ITEMS.map((item) => {
        if (item.href !== "/admin/items") {
          return renderLink(item);
        }

        return (
          <div className="admin-nav-group" key={item.href}>
            <div className="admin-nav-group-row">
              {renderLink(item)}
              <button
                type="button"
                className="admin-nav-group-toggle"
                aria-expanded={itemsExpanded}
                aria-controls="admin-nav-items-children"
                aria-label={
                  itemsExpanded
                    ? "Collapse Items navigation"
                    : "Expand Items navigation"
                }
                onClick={() =>
                  setManualItemsState({
                    pathname,
                    expanded: !itemsExpanded,
                  })
                }
              >
                <ChevronDown aria-hidden="true" />
              </button>
            </div>

            <div
              id="admin-nav-items-children"
              className="admin-nav-children"
              hidden={!itemsExpanded}
            >
              {ITEM_ADMIN_NAV_CHILDREN.map((child) =>
                renderLink(child, true)
              )}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
