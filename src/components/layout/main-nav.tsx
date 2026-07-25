"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Items", href: "/items" },
  { label: "Recipes", href: "/recipes" },
  { label: "Professions", href: "/professions" },
  { label: "Locations", href: "/locations" },
  { label: "Shops", href: "/shops" },
] as const;

export function MainNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main navigation" className="public-primary-nav">
      <div className="public-primary-nav-links">
        {navItems.map((item) => {
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
      </div>

      {/* Preserve the existing progressively enhanced GET search. */}
      <form
        action="/search"
        method="get"
        role="search"
        aria-label="Site search"
        className="public-site-search"
      >
        <input
          type="search"
          name="q"
          aria-label="Search query"
          placeholder="Search..."
          className="public-site-search-input"
        />
        <button type="submit" className="btn btn-primary btn-compact">
          Search
        </button>
      </form>
    </nav>
  );
}
