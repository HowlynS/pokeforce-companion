import Image from "next/image";
import Link from "next/link";
import { MainNav } from "@/components/layout/main-nav";

type AppShellProps = {
  children: React.ReactNode;
  landing?: boolean;
  scenic?: "home" | "catalogue" | "detail";
  wide?: boolean;
};

export function AppShell({
  children,
  landing = false,
  scenic,
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
        (landing ? " public-site-shell--landing" : "") +
        (scenic
          ? ` public-site-shell--scenic public-site-shell--scenic-${scenic}`
          : "")
      }
    >
      {scenic ? (
        <div
          className={`public-scenic-background public-scenic-background--${scenic}`}
          aria-hidden="true"
        />
      ) : null}

      <header className="public-site-header">
        <div className={`${containerClassName} public-site-header-inner`}>
          <Link
            href="/"
            className="public-site-brand"
            aria-label="Merchants Codex home"
          >
            <Image
              src="/images/branding/merchants-codex-logo.png"
              alt="Merchants Codex"
              width={1246}
              height={384}
              priority
              className="public-site-logo"
            />
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
            A crafting wiki companion for items, recipes, professions,
            classes, categories, locations, and shops.
          </span>
        </div>
      </footer>
    </div>
  );
}
