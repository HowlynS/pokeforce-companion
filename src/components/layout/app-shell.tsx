import Link from "next/link";
import { MainNav } from "@/components/layout/main-nav";

type AppShellProps = {
  children: React.ReactNode;
  landing?: boolean;
  wide?: boolean;
};

export function AppShell({
  children,
  landing = false,
  wide = false,
}: AppShellProps) {
  const containerClassName =
    "public-site-container" +
    (landing ? " public-site-container--landing" : "") +
    (wide ? " public-site-container--wide" : "");

  return (
    <div
      className={
        "public-site-shell" +
        (landing ? " public-site-shell--landing" : "")
      }
    >
      {landing ? (
        <div className="public-landing-background" aria-hidden="true" />
      ) : null}

      <header className="public-site-header">
        <div className={`${containerClassName} public-site-header-inner`}>
          {/* This text lockup is deliberately isolated from the shell layout:
              a later approved logo can replace its contents without changing
              the home link, header spacing, or page heading hierarchy. */}
          <Link href="/" className="public-site-brand">
            <span className="public-site-brand-name">Merchants Codex</span>
            <span className="public-site-brand-description">
              PokeForce Companion
            </span>
          </Link>

          <MainNav />
        </div>
      </header>

      <main className={`${containerClassName} public-site-main`}>
        {children}
      </main>

      <footer className="public-site-footer">
        <div className={`${containerClassName} public-site-footer-inner`}>
          <span className="public-site-footer-brand">
            {landing ? "Merchants Codex" : "PokeForce Companion"}
          </span>
          <span>
            {landing
              ? "A crafting and trading reference for items, recipes, professions, locations, and shops."
              : "A crafting wiki companion for items, recipes, professions, categories, locations, and shops."}
          </span>
        </div>
      </footer>
    </div>
  );
}
