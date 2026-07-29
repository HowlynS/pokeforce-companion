import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  DEFAULT_SITE_APPEARANCE,
  type ResolvedSiteAppearance,
} from "@/lib/appearance/defaults";

const state = vi.hoisted(() => ({
  appearance: null as ResolvedSiteAppearance | null,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/items",
}));

vi.mock("@/lib/appearance/public", () => ({
  getPublishedSiteAppearance: vi.fn(async () => state.appearance),
}));

import { AppShell } from "@/components/layout/app-shell";

describe("AppShell managed appearance", () => {
  it("keeps the shared brand link accessible and applies managed scenic values", async () => {
    state.appearance = {
      ...DEFAULT_SITE_APPEARANCE,
      headerLogo: {
        url: "https://cdn.example/logo.png?v=123",
        width: 900,
        height: 300,
        custom: true,
      },
      catalogue: {
        ...DEFAULT_SITE_APPEARANCE.catalogue,
        background: {
          url: "https://cdn.example/catalogue.webp?v=123",
          width: 2400,
          height: 1600,
          custom: true,
        },
        desktop: { x: 41, y: 63 },
        mobile: { x: 78, y: 44 },
      },
    };

    const html = renderToStaticMarkup(
      await AppShell({ scenic: "catalogue", children: <p>Catalogue</p> })
    );

    expect(html).toContain('aria-label="Merchants Codex home"');
    expect(html).toContain('src="https://cdn.example/logo.png?v=123"');
    expect(html).toContain('width="900"');
    expect(html).toContain('height="300"');
    expect(html).toContain("--public-scenic-position-desktop:41% 63%");
    expect(html).toContain("--public-scenic-position-mobile:78% 44%");
    expect(html).toContain("catalogue.webp");
    expect(html).toContain('aria-hidden="true"');
  });

  it("retains committed defaults when the resolver returns defaults", async () => {
    state.appearance = DEFAULT_SITE_APPEARANCE;
    const html = renderToStaticMarkup(
      await AppShell({ scenic: "home", children: <p>Home</p> })
    );
    expect(html).toContain(
      'src="/images/branding/merchants-codex-logo.png"'
    );
    expect(html).toContain("--public-scenic-position-desktop:55% 50%");
    expect(html).toContain("--public-scenic-position-mobile:82% 50%");
  });
});
