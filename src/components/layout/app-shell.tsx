import Link from "next/link";
import { MainNav } from "@/components/layout/main-nav";
import { PublicLogo } from "@/components/layout/public-logo";
import {
  DEFAULT_HEADER_LOGO_HEIGHT,
  DEFAULT_HEADER_LOGO_URL,
  DEFAULT_HEADER_LOGO_WIDTH,
} from "@/lib/appearance/defaults";
import { getPublishedSiteAppearance } from "@/lib/appearance/public";
import { requireOrdinarySiteAccess } from "@/lib/access/require-site-access";
import { PUBLIC_NAV_ITEMS } from "@/lib/public-nav";

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
  // The proxy improves anonymous redirects, but this server boundary is the
  // authority protecting every real public route and its rendered content.
  await requireOrdinarySiteAccess();
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
            className="public-site-brand cx-logo-breathe"
            aria-label="Merchants Codex home"
          >
            <PublicLogo
              key={appearance.headerLogo.url ?? DEFAULT_HEADER_LOGO_URL}
              src={appearance.headerLogo.url ?? DEFAULT_HEADER_LOGO_URL}
              width={
                appearance.headerLogo.width ?? DEFAULT_HEADER_LOGO_WIDTH
              }
              height={
                appearance.headerLogo.height ?? DEFAULT_HEADER_LOGO_HEIGHT
              }
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
          <span className="public-site-footer-credit">
            <span className="public-site-footer-brand">
              {landing ? "Merchants Codex" : "PokeForce Companion"}
            </span>{" "}
            — A crafting wiki companion for items, recipes, professions,
            classes, categories, locations, and shops.
          </span>

          <nav aria-label="Footer" className="public-site-footer-nav">
            {PUBLIC_NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="breadcrumb-link"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
