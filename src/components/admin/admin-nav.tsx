"use client";

// The admin shell's persistent left navigation (Slice 9B.1). A client
// component only because active-state needs the current pathname; the
// items themselves and the active rule live in the pure module
// src/lib/admin/admin-nav.ts. Uses next/link so moving between admin
// sections is a soft navigation that keeps the surrounding shell stable.
// Accessibility: a labeled <nav> landmark, and the active link carries
// aria-current="page" (which the stylesheet also uses as its styling
// hook, so the visual state and the accessible state can never drift
// apart).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_NAV_ITEMS, isAdminNavItemActive } from "@/lib/admin/admin-nav";

export function AdminNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav aria-label="Admin navigation" className="admin-nav">
      {ADMIN_NAV_ITEMS.map((item) => {
        const isActive = isAdminNavItemActive(item.href, pathname);

        return (
          <Link
            key={item.href}
            href={item.href}
            className="admin-nav-link"
            aria-current={isActive ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
