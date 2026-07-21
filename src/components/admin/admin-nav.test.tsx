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
// prescribes, and hrefs stay exactly the six approved targets.

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const nav = vi.hoisted(() => ({ pathname: "/admin" }));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
}));

import { AdminNav } from "@/components/admin/admin-nav";

const APPROVED_LABELS = [
  "Dashboard",
  "Items",
  "Recipes",
  "Professions",
  "Categories",
  "Locations",
];

const APPROVED_HREFS = [
  "/admin",
  "/admin/items",
  "/admin/recipes",
  "/admin/professions",
  "/admin/categories",
  "/admin/locations",
];

function renderNav(pathname: string): string {
  nav.pathname = pathname;
  return renderToStaticMarkup(<AdminNav />);
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
  it("renders exactly the six approved labels", () => {
    const html = renderNav("/admin/some-unmatched-route");

    for (const label of APPROVED_LABELS) {
      expect(html).toContain(label);
    }
  });

  it("preserves the labeled primary-navigation landmark", () => {
    const html = renderNav("/admin");

    expect(html).toMatch(/<nav [^>]*aria-label="Admin navigation"[^>]*>/);
  });

  it("renders every link's href exactly as approved, in order", () => {
    const html = renderNav("/admin/some-unmatched-route");

    const hrefs = [...html.matchAll(/<a [^>]*href="([^"]+)"/g)].map(
      (match) => match[1]
    );
    expect(hrefs).toEqual(APPROVED_HREFS);
  });
});

describe("AdminNav decorative icons", () => {
  it("renders exactly six decorative, aria-hidden icons, each inside a link", () => {
    const html = renderNav("/admin/some-unmatched-route");

    const svgs = svgTags(html);
    expect(svgs).toHaveLength(6);
    for (const svg of svgs) {
      expect(svg).toContain('class="lucide');
      expect(svg).toContain("admin-nav-icon");
      expect(svg).toContain('aria-hidden="true"');
    }
  });

  it("never gives an icon its own accessible name", () => {
    const html = renderNav("/admin");

    // The <nav> landmark itself carries the page's own aria-label; the
    // icons must carry none of their own — no aria-label, no <title>.
    for (const svg of svgTags(html)) {
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

  it("marks exactly the Locations link active on a Locations child route", () => {
    const html = renderNav("/admin/locations/route-1/edit");

    const active = linkTags(html).filter((tag) =>
      tag.includes('aria-current="page"')
    );
    expect(active).toHaveLength(1);
    expect(active[0]).toContain('href="/admin/locations"');
  });

  it("marks nothing active on a secondary settings route", () => {
    const html = renderNav("/admin/settings/game-versions");

    expect(html).not.toContain("aria-current");
  });
});
