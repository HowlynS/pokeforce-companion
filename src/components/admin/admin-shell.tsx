// The shared admin shell (Slice 9B.1): a desktop-first two-column frame —
// persistent sidebar on the left, scrolling content area on the right —
// rendered ONCE by the /admin layout so it wraps every authenticated
// admin route and stays stable while navigating between them. Pages
// render only their own content (typically PageHeader plus body, or an
// AdminWorkspace composition in later slices); they must NOT wrap
// themselves in the public AppShell anymore.
//
// This component is purely structural: it owns no data fetching and no
// authorization — the /admin layout's requireAdminUser() gate runs before
// it renders, and every mutation still re-checks authorization itself.

import Link from "next/link";
import { designTokens } from "@/lib/design-tokens";
import { AdminNav } from "@/components/admin/admin-nav";

type AdminShellProps = {
  children: React.ReactNode;
};

export function AdminShell({ children }: AdminShellProps) {
  return (
    <div className="admin-shell">
      {/* The combined application frame (Shell Composition Correction
          pass): sidebar and content used to be direct children of
          .admin-shell itself, so the sidebar sat flush at the true
          viewport edge while .admin-content-inner centered ITSELF
          independently within the narrower remainder beside it — opening
          a scenic gap between the two that made the sidebar read as
          detached from the application. Wrapping both in one .admin-frame
          means exactly one box now owns centering and the outer scenic
          gutters; the sidebar and content sit flush against each other
          inside it, with no gap of any kind possible between them. */}
      <div className="admin-frame">
        <aside className="admin-sidebar">
          {/* Brand lockup, deliberately NOT a heading (pages own their h1
              through PageHeader). It links to the public site — the one
              way out of the admin area, mirroring the public shell. */}
          <Link href="/" className="admin-sidebar-brand">
            <span
              style={{
                display: "block",
                color: designTokens.colors.accent,
                fontSize: "18px",
                fontWeight: 700,
                letterSpacing: "0.04em",
              }}
            >
              PokeForce Companion
            </span>
            <span
              style={{
                display: "block",
                marginTop: "4px",
                color: designTokens.colors.textMuted,
                fontSize: "13px",
              }}
            >
              Admin · View public site
            </span>
          </Link>

          <AdminNav />
        </aside>

        {/* min-width: 0 (in the stylesheet) lets wide admin tables shrink
            and scroll inside their own wrappers instead of overflowing the
            shell at narrower desktop widths. */}
        <div className="admin-content">
          <main className="admin-content-inner">{children}</main>
        </div>
      </div>
    </div>
  );
}
