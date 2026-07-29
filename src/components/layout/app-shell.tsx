import Link from "next/link";
import { MainNav } from "@/components/layout/main-nav";
import { getPublishedSiteAppearance } from "@/lib/appearance/public";

type AppShellProps = {
  children: React.ReactNode;
  landing?: boolean;
  scenic?: "home" | "catalogue" | "detail";
  wide?: boolean;
};

export async function AppShell({
  children,
  landing = false,
  scenic,
  wide = false,
}: AppShellProps) {
  const appearance = await getPublishedSiteAppearance();
  const scenicAppearance = scenic
    ? appearance[scenic === "detail" ? "itemDetail" : scenic]
    : null;
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
          style={
            scenicAppearance
              ? ({
                  "--public-scenic-image": scenicAppearance.background.url
                    ? `url(${JSON.stringify(scenicAppearance.background.url)})`
                    : "none",
                  "--public-scenic-position-desktop": `${scenicAppearance.desktop.x}% ${scenicAppearance.desktop.y}%`,
                  "--public-scenic-position-mobile": `${scenicAppearance.mobile.x}% ${scenicAppearance.mobile.y}%`,
                } as React.CSSProperties)
              : undefined
          }
        />
      ) : null}

      <header className="public-site-header">
        <div className={`${containerClassName} public-site-header-inner`}>
          <Link
            href="/"
            className="public-site-brand"
            aria-label="Merchants Codex home"
          >
            {/* The intrinsic attributes reserve the saved aspect ratio while
                responsive CSS keeps height automatic, so the mark cannot
                stretch. A plain image supports cache-busted Supabase URLs
                immediately without a repository rebuild. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={
                appearance.headerLogo.url ??
                "/images/branding/merchants-codex-logo.png"
              }
              alt="Merchants Codex"
              width={appearance.headerLogo.width ?? 1394}
              height={appearance.headerLogo.height ?? 486}
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
