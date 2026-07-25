import Link from "next/link";
import { MainNav } from "@/components/layout/main-nav";

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="public-site-shell">
      <header className="public-site-header">
        <div className="public-site-container public-site-header-inner">
          {/* This text lockup is deliberately isolated from the shell layout:
              a later approved logo can replace its contents without changing
              the home link, header spacing, or page heading hierarchy. */}
          <Link href="/" className="public-site-brand">
            <span className="public-site-brand-name">PokeForce Companion</span>
            <span className="public-site-brand-description">
              Crafting Wiki Companion
            </span>
          </Link>

          <MainNav />
        </div>
      </header>

      <main className="public-site-container public-site-main">{children}</main>

      <footer className="public-site-footer">
        <div className="public-site-container public-site-footer-inner">
          <span className="public-site-footer-brand">
            PokeForce Companion
          </span>
          <span>
            A crafting wiki companion for items, recipes, professions,
            categories, locations, and shops.
          </span>
        </div>
      </footer>
    </div>
  );
}
