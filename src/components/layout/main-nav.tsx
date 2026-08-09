"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PUBLIC_NAV_ITEMS } from "@/lib/public-nav";
import { WorldMenu } from "@/components/layout/world-menu";
import { PublicSiteSearch } from "@/components/layout/public-site-search";

// The <nav> wraps both the link row and the search form (search stays a
// role="search" region nested inside the nav landmark, matching the
// existing header-search E2E coverage's own scoping), but visually
// renders as a 3-column grid — see .public-primary-nav's display:contents
// in globals.css, which promotes these two children into
// .public-site-header-inner's own grid instead of boxing them together.
export function MainNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main navigation" className="public-primary-nav">
      <div className="public-primary-nav-links">
        {PUBLIC_NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                "public-nav-link" +
                (active ? " public-nav-link--active" : "")
              }
              aria-current={active ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}

        <WorldMenu />
      </div>

      <PublicSiteSearch />
    </nav>
  );
}
