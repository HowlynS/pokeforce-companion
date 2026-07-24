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
import { Suspense } from "react";
import { UserRound } from "lucide-react";
import { designTokens } from "@/lib/design-tokens";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminSuccessToast } from "@/components/admin/admin-success-toast";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { signOutAction } from "@/app/admin/actions";

type AdminShellProps = {
  children: React.ReactNode;
};

export async function AdminShell({ children }: AdminShellProps) {
  // Cached (React cache()) so this repeats no Supabase lookup beyond the
  // one the /admin layout's own gate already performs for this request.
  const user = await requireAdminUser();

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

          {/* Visual Pass II Section 8: the signed-in account context, moved
              here from the Dashboard's own main content — a compact card
              between the brand lockup and primary navigation, so it reads
              as shell chrome rather than a piece of Dashboard content. */}
          <div className="admin-sidebar-account">
            <UserRound aria-hidden="true" className="admin-sidebar-account-icon" />
            <p className="admin-sidebar-account-email">{user.email}</p>
            <form action={signOutAction}>
              <button type="submit" className="btn btn-secondary btn-compact admin-sidebar-account-signout">
                Sign out
              </button>
            </form>
          </div>

          <AdminNav />
        </aside>

        {/* min-width: 0 (in the stylesheet) lets wide admin tables shrink
            and scroll inside their own wrappers instead of overflowing the
            shell at narrower desktop widths. */}
        <div className="admin-content">
          <main className="admin-content-inner">
            {/* Admin Polish Pass 2, Part 3: the shared success toast lives
                here, once, rather than per-page — every admin route (list,
                create, edit, delete-confirm) gets flash-message feedback
                for free. Suspense is required by useSearchParams(); a null
                fallback is correct since the toast has nothing to show
                until its own effect reads the URL anyway. */}
            <Suspense fallback={null}>
              <AdminSuccessToast />
            </Suspense>
            {children}
          </main>
        </div>
      </div>

      {/* AdminSelect's open panel portals here rather than to
          document.body: the admin dark-mode color tokens (--color-surface-
          raised, --color-border, etc.) are scoped to .admin-shell, not
          :root, so a panel appended directly under <body> would inherit
          none of them and render fully transparent. This div is a plain,
          unstyled descendant of .admin-shell — position: fixed children
          still anchor to the viewport exactly as they did under
          document.body, since nothing here or in .admin-shell applies a
          transform/filter/perspective that would create a containing
          block. */}
      <div id="admin-select-portal-root" />
    </div>
  );
}
