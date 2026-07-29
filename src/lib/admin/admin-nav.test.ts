import { describe, expect, it } from "vitest";
import {
  ADMIN_NAV_DESTINATIONS,
  ADMIN_NAV_ITEMS,
  ITEM_ADMIN_NAV_CHILDREN,
  isAdminNavItemActive,
} from "@/lib/admin/admin-nav";

// Which single nav item (by href) is active for a pathname — or null.
// Mirrors how the sidebar consumes the rule, so these tests also prove at
// most one item can ever be active at a time.
function activeHrefFor(pathname: string): string | null {
  const active = ADMIN_NAV_DESTINATIONS.filter((item) =>
    isAdminNavItemActive(item.href, pathname)
  );
  expect(active.length).toBeLessThanOrEqual(1);
  return active[0]?.href ?? null;
}

describe("ADMIN_NAV_ITEMS", () => {
  it("contains the approved destinations in order", () => {
    expect(ADMIN_NAV_ITEMS.map((item) => item.label)).toEqual([
      "Dashboard",
      "Appearance",
      "Items",
      "Recipes",
      "Professions",
      "Classes",
      "Locations",
      "Shops",
      "Game Versions",
      "Currencies",
    ]);
    expect(ADMIN_NAV_ITEMS.map((item) => item.href)).toEqual([
      "/admin",
      "/admin/appearance",
      "/admin/items",
      "/admin/recipes",
      "/admin/professions",
      "/admin/classes",
      "/admin/locations",
      "/admin/shops",
      "/admin/settings/game-versions",
      "/admin/settings/currencies",
    ]);
    expect(ADMIN_NAV_ITEMS.map((item) => item.icon)).toEqual([
      "dashboard",
      "appearance",
      "items",
      "recipes",
      "professions",
      "playerClasses",
      "locations",
      "shops",
      "gameVersions",
      "currencies",
    ]);
  });

  it("keeps Categories as the sole Items child destination", () => {
    expect(ITEM_ADMIN_NAV_CHILDREN).toEqual([
      {
        label: "Categories",
        href: "/admin/categories",
        icon: "categories",
      },
    ]);
    expect(
      ADMIN_NAV_ITEMS.some((item) => item.href === "/admin/categories")
    ).toBe(false);
  });

  it("never includes Acquisition Sources or other excluded destinations", () => {
    const labels = ADMIN_NAV_DESTINATIONS.map((item) =>
      item.label.toLowerCase()
    );
    const hrefs = ADMIN_NAV_DESTINATIONS.map((item) => item.href);

    for (const excluded of ["acquisition", "user", "role", "audit", "route hub"]) {
      expect(labels.some((label) => label.includes(excluded))).toBe(false);
    }
    expect(hrefs.some((href) => href.includes("sources"))).toBe(false);
    // Supporting resources share the settings route group.
    expect(hrefs.filter((href) => href.includes("settings"))).toEqual([
      "/admin/settings/game-versions",
      "/admin/settings/currencies",
    ]);
  });
});

describe("isAdminNavItemActive", () => {
  it("marks Dashboard active only on exactly /admin", () => {
    expect(activeHrefFor("/admin")).toBe("/admin");
    expect(activeHrefFor("/admin/items")).not.toBe("/admin");
    expect(activeHrefFor("/admin/appearance")).not.toBe("/admin");
    expect(activeHrefFor("/admin/settings/game-versions")).not.toBe("/admin");
  });

  it("marks Items active on the item list and every item child route", () => {
    expect(activeHrefFor("/admin/items")).toBe("/admin/items");
    expect(activeHrefFor("/admin/items/iron-ore/edit")).toBe("/admin/items");
    expect(activeHrefFor("/admin/items/iron-ore/delete")).toBe("/admin/items");
    // Acquisition sources are contextual under their owning item, so their
    // routes light up Items — they have no destination of their own.
    expect(activeHrefFor("/admin/items/iron-ore/sources")).toBe("/admin/items");
    expect(activeHrefFor("/admin/items/iron-ore/sources/abc123/edit")).toBe(
      "/admin/items"
    );
  });

  it("marks each remaining resource active on its list and child routes", () => {
    expect(activeHrefFor("/admin/appearance")).toBe("/admin/appearance");

    expect(activeHrefFor("/admin/recipes")).toBe("/admin/recipes");
    expect(activeHrefFor("/admin/recipes/iron-sword/edit")).toBe("/admin/recipes");
    expect(activeHrefFor("/admin/recipes/iron-sword/delete")).toBe("/admin/recipes");

    expect(activeHrefFor("/admin/professions")).toBe("/admin/professions");
    expect(activeHrefFor("/admin/professions/smithing/edit")).toBe(
      "/admin/professions"
    );

    expect(activeHrefFor("/admin/classes")).toBe("/admin/classes");
    expect(activeHrefFor("/admin/classes/artisan/edit")).toBe(
      "/admin/classes"
    );
    expect(activeHrefFor("/admin/classes/artisan/recipes")).toBe(
      "/admin/classes"
    );

    expect(activeHrefFor("/admin/categories")).toBe("/admin/categories");
    expect(activeHrefFor("/admin/categories/materials/delete")).toBe(
      "/admin/categories"
    );

    expect(activeHrefFor("/admin/locations")).toBe("/admin/locations");
    expect(activeHrefFor("/admin/locations/route-1/edit")).toBe(
      "/admin/locations"
    );
    expect(activeHrefFor("/admin/locations/route-1/delete")).toBe(
      "/admin/locations"
    );

    expect(activeHrefFor("/admin/shops")).toBe("/admin/shops");
    expect(activeHrefFor("/admin/shops/blackthorn-supply/edit")).toBe(
      "/admin/shops"
    );

    // Game Versions (Visual Pass sub-slice 8): now a primary entry too,
    // active on its own list route and every nested route.
    expect(activeHrefFor("/admin/settings/game-versions")).toBe(
      "/admin/settings/game-versions"
    );
    expect(activeHrefFor("/admin/settings/game-versions/abc123/edit")).toBe(
      "/admin/settings/game-versions"
    );
    expect(activeHrefFor("/admin/settings/game-versions/abc123/delete")).toBe(
      "/admin/settings/game-versions"
    );

    expect(activeHrefFor("/admin/settings/currencies")).toBe(
      "/admin/settings/currencies"
    );
    expect(activeHrefFor("/admin/settings/currencies/pokeyen/edit")).toBe(
      "/admin/settings/currencies"
    );
  });

  it("matches on path-segment boundaries, never on name prefixes", () => {
    expect(activeHrefFor("/admin/itemsomething")).toBeNull();
    expect(activeHrefFor("/admin/recipes-archive")).toBeNull();
  });

  it("marks nothing active on public routes", () => {
    expect(activeHrefFor("/")).toBeNull();
    expect(activeHrefFor("/items")).toBeNull();
    expect(activeHrefFor("/items/iron-ore")).toBeNull();
  });
});
