import Link from "next/link";
import { designTokens } from "@/lib/design-tokens";
import { MainNav } from "@/components/layout/main-nav";

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: designTokens.colors.background,
        color: designTokens.colors.text,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: designTokens.layout.maxWidth,
          margin: "0 auto",
          padding: designTokens.layout.pagePadding,
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "24px",
            padding: "16px 0 32px",
          }}
        >
          {/* Brand lockup, deliberately NOT a heading: each page supplies
              its own h1 through PageHeader, so the shell must not compete
              with it. The lockup links home, as visitors expect. */}
          <Link
            href="/"
            style={{
              display: "block",
              textDecoration: "none",
            }}
          >
            <p
              style={{
                margin: 0,
                color: designTokens.colors.accent,
                fontSize: "20px",
                fontWeight: 700,
                letterSpacing: "0.04em",
              }}
            >
              PokeForce Companion
            </p>
            <p
              style={{
                margin: "4px 0 0",
                color: designTokens.colors.textMuted,
                fontSize: "14px",
              }}
            >
              Crafting Wiki Companion
            </p>
          </Link>

          <MainNav />
        </header>

        <main>{children}</main>

        <footer
          style={{
            borderTop: `1px solid ${designTokens.colors.border}`,
            marginTop: "48px",
            padding: "24px 0 0",
            color: designTokens.colors.textMuted,
            fontSize: "14px",
          }}
        >
          PokeForce Companion — a crafting wiki for PokeForce items,
          recipes, professions, and categories.
        </footer>
      </div>
    </div>
  );
}
