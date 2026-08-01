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
  MonitorCheck,
  Package,
  Palette,
  ScrollText,
  Shapes,
  Store,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import {
  ADMIN_NAV_ITEMS,
  ITEM_ADMIN_NAV_CHILDREN,
  SITE_ADMIN_NAV_ITEMS,
  filterAdminNavItems,
  isAdminNavItemActive,
  type AdminNavIcon,
  type AdminNavItem,
} from "@/lib/admin/admin-nav";
import { useAdminRole } from "@/components/admin/admin-authorization";

const ADMIN_NAV_ICONS: Record<AdminNavIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  appearance: Palette,
  designReview: MonitorCheck,
  items: Package,
  recipes: ScrollText,
  professions: Hammer,
  playerClasses: GraduationCap,
  categories: Shapes,
  locations: MapPinned,
  shops: Store,
  gameVersions: History,
  currencies: Coins,
  users: UsersRound,
};

export function AdminNav() {
  const role = useAdminRole();
  const pathname = usePathname() ?? "";
  const primaryItems = role ? filterAdminNavItems(ADMIN_NAV_ITEMS, role) : [];
  const siteItems = role ? filterAdminNavItems(SITE_ADMIN_NAV_ITEMS, role) : [];
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
      <div className="admin-nav-primary">
        {primaryItems.map((item) => {
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
      </div>

      {siteItems.length > 0 ? (
        <div className="admin-nav-site-group">
          <p className="admin-nav-section-label">Site administration</p>
          {siteItems.map((item) => renderLink(item))}
        </div>
      ) : null}
    </nav>
  );
}
