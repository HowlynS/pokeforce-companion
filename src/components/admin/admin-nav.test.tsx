// Component tests for the admin sidebar's primary navigation, rendered to
// static HTML with react-dom/server (Node-only, no DOM library — the
// established component-test approach). AdminNav is a "use client"
// component only because active-state needs the current pathname
// (next/navigation's usePathname), so that hook is mocked here — a plain
// module mock, not a new testing framework — letting the real component
// render deterministically for a given route. The contract under test:
// every approved destination renders with its label and a decorative
// icon, aria-current follows the mocked pathname exactly as
// isAdminNavItemActive (already unit-tested in admin-nav.test.ts)
// prescribes, and hrefs stay exactly the approved targets.

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const nav = vi.hoisted(() => ({ pathname: "/admin" }));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
}));

import { AdminNav } from "@/components/admin/admin-nav";
import { AdminAuthorizationProvider } from "@/components/admin/admin-authorization";

const APPROVED_LABELS = [
  "Dashboard",
  "Items",
  "Categories",
  "Recipes",
  "Professions",
  "Classes",
  "Locations",
  "Shops",
  "Game Versions",
  "Currencies",
  "Appearance",
  "Design review",
  "Users &amp; access",
];

const APPROVED_HREFS = [
  "/admin",
  "/admin/items",
  "/admin/categories",
  "/admin/recipes",
  "/admin/professions",
  "/admin/classes",
  "/admin/locations",
  "/admin/shops",
  "/admin/settings/game-versions",
  "/admin/settings/currencies",
  "/admin/appearance",
  "/admin/design-review",
  "/admin/users",
];

function renderNav(pathname: string, role: "OWNER" | "CONTRIBUTOR" = "OWNER"): string {
  nav.pathname = pathname;
  return renderToStaticMarkup(
    <AdminAuthorizationProvider role={role}>
      <AdminNav />
    </AdminAuthorizationProvider>
  );
}

// Every opening <a ...> tag's own attribute string, order-independent —
// so assertions can check for href/aria-current as substrings without
// depending on the exact order Next's Link component happens to render
// its attributes in.
function linkTags(html: string): string[] {
  return [...html.matchAll(/<a\s[^>]*>/g)].map((match) => match[0]);
}

// Every opening <svg ...> tag's own attribute string, same rationale.
function svgTags(html: string): string[] {
  return [...html.matchAll(/<svg\s[^>]*>/g)].map((match) => match[0]);
}

describe("AdminNav structure and labels", () => {
  it("renders exactly the approved labels", () => {
    const html = renderNav("/admin/items");

    for (const label of APPROVED_LABELS) {
      expect(html).toContain(label);
    }
  });

  it("preserves the labeled primary-navigation landmark", () => {
    const html = renderNav("/admin");

    expect(html).toMatch(/<nav [^>]*aria-label="Admin navigation"[^>]*>/);
  });

  it("renders Appearance and Design review in the separated Site administration group", () => {
    const html = renderNav("/admin/appearance");

    expect(html).toContain("Site administration");
    expect(html).toMatch(
      /class="admin-nav-site-group"[\s\S]*href="\/admin\/appearance"/
    );
    expect(html).toMatch(
      /class="admin-nav-site-group"[\s\S]*href="\/admin\/design-review"/
    );
  });

  it("omits restricted Site administration and Game Versions for Contributors", () => {
    const html = renderNav("/admin/items", "CONTRIBUTOR");
    expect(html).not.toContain("Site administration");
    expect(html).not.toContain("Appearance");
    expect(html).not.toContain("Design review");
    expect(html).not.toContain("Game Versions");
    expect(html).not.toContain("Users & access");
    expect(html).toContain("Items");
    expect(html).toContain("Currencies");
  });

  it("renders every link's href exactly as approved, in order", () => {
    const html = renderNav("/admin/items");

    const hrefs = [...html.matchAll(/<a [^>]*href="([^"]+)"/g)].map(
      (match) => match[1]
    );
    expect(hrefs).toEqual(APPROVED_HREFS);
  });

  it("renders Categories only inside the expanded Items group", () => {
    const collapsed = renderNav("/admin");
    expect(collapsed).toContain('aria-label="Expand Items navigation"');
    expect(collapsed).toMatch(
      /id="admin-nav-items-children"[^>]*hidden=""[^>]*>[\s\S]*href="\/admin\/categories"/
    );

    const expanded = renderNav("/admin/categories/materials/edit");
    expect(expanded).toContain('aria-label="Collapse Items navigation"');
    expect(expanded).toMatch(
      /class="admin-nav-children"[^>]*>[\s\S]*href="\/admin\/categories"/
    );
    expect(expanded.match(/href="\/admin\/categories"/g)).toHaveLength(1);
  });
});

describe("AdminNav decorative icons", () => {
  it("renders one decorative, aria-hidden icon inside every link", () => {
    const html = renderNav("/admin/items");

    const svgs = svgTags(html).filter((svg) =>
      svg.includes("admin-nav-icon")
    );
    expect(svgs).toHaveLength(APPROVED_LABELS.length);
    for (const svg of svgs) {
      expect(svg).toContain('class="lucide');
      expect(svg).toContain("admin-nav-icon");
      expect(svg).toContain('aria-hidden="true"');
    }
  });

  it("never gives an icon its own accessible name", () => {
    const html = renderNav("/admin/items");

    // The <nav> landmark itself carries the page's own aria-label; the
    // icons must carry none of their own — no aria-label, no <title>.
    for (const svg of svgTags(html).filter((tag) =>
      tag.includes("admin-nav-icon")
    )) {
      expect(svg).not.toContain("aria-label");
    }
    expect(html).not.toMatch(/<svg[^>]*>\s*<title>/);
  });
});

describe("AdminNav active-state wiring", () => {
  it("marks exactly the Dashboard link active on /admin", () => {
    const html = renderNav("/admin");

    const active = linkTags(html).filter((tag) =>
      tag.includes('aria-current="page"')
    );
    expect(active).toHaveLength(1);
    expect(active[0]).toContain('href="/admin"');
  });

  it("marks exactly the Classes link active on a Classes child route", () => {
    const html = renderNav("/admin/classes/artisan/recipes");

    const active = linkTags(html).filter((tag) =>
      tag.includes('aria-current="page"')
    );
    expect(active).toHaveLength(1);
    expect(active[0]).toContain('href="/admin/classes"');
  });

  it("marks exactly the nested Categories link active on a Category route", () => {
    const html = renderNav("/admin/categories/materials/edit");

    const active = linkTags(html).filter((tag) =>
      tag.includes('aria-current="page"')
    );
    expect(active).toHaveLength(1);
    expect(active[0]).toContain('href="/admin/categories"');
  });

  it("marks exactly the Locations link active on a Locations child route", () => {
    const html = renderNav("/admin/locations/route-1/edit");

    const active = linkTags(html).filter((tag) =>
      tag.includes('aria-current="page"')
    );
    expect(active).toHaveLength(1);
    expect(active[0]).toContain('href="/admin/locations"');
  });

  it("marks exactly the Game Versions link active on its own primary route", () => {
    const html = renderNav("/admin/settings/game-versions");

    const active = linkTags(html).filter((tag) =>
      tag.includes('aria-current="page"')
    );
    expect(active).toHaveLength(1);
    expect(active[0]).toContain('href="/admin/settings/game-versions"');
  });

  it("marks exactly the Game Versions link active on a nested settings route", () => {
    const html = renderNav("/admin/settings/game-versions/abc123/edit");

    const active = linkTags(html).filter((tag) =>
      tag.includes('aria-current="page"')
    );
    expect(active).toHaveLength(1);
    expect(active[0]).toContain('href="/admin/settings/game-versions"');
  });
});
