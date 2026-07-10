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
          <div>
            <p
              style={{
                margin: 0,
                color: designTokens.colors.accent,
                fontSize: "14px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              PokeForce Companion
            </p>
            <h1
              style={{
                margin: "8px 0 0",
                fontSize: "32px",
                lineHeight: 1.1,
              }}
            >
              Crafting Wiki Companion
            </h1>
          </div>

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
          PokeForce Companion - Design Foundation
        </footer>
      </div>
    </div>
  );
}
