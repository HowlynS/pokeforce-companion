import { describe, expect, it } from "vitest";
import {
  DASHBOARD_RESOURCE_ROUTES,
  describeCurrentGameVersion,
  pluralize,
} from "@/lib/admin/dashboard";

describe("DASHBOARD_RESOURCE_ROUTES", () => {
  it("contains exactly the five completed reference workspaces, in order", () => {
    expect(DASHBOARD_RESOURCE_ROUTES.map((route) => route.label)).toEqual([
      "Items",
      "Recipes",
      "Professions",
      "Categories",
      "Locations",
    ]);
  });

  it("maps each resource to its canonical list and create routes", () => {
    expect(DASHBOARD_RESOURCE_ROUTES).toEqual([
      {
        key: "items",
        label: "Items",
        listHref: "/admin/items",
        createHref: "/admin/items/new",
        createLabel: "Create item",
      },
      {
        key: "recipes",
        label: "Recipes",
        listHref: "/admin/recipes",
        createHref: "/admin/recipes/new",
        createLabel: "Create recipe",
      },
      {
        key: "professions",
        label: "Professions",
        listHref: "/admin/professions",
        createHref: "/admin/professions/new",
        createLabel: "Create profession",
      },
      {
        key: "categories",
        label: "Categories",
        listHref: "/admin/categories",
        createHref: "/admin/categories/new",
        createLabel: "Create category",
      },
      {
        key: "locations",
        label: "Locations",
        listHref: "/admin/locations",
        createHref: "/admin/locations/new",
        createLabel: "Create location",
      },
    ]);
  });

  it("never includes aliases, redirects, or excluded destinations", () => {
    const hrefs = [
      ...DASHBOARD_RESOURCE_ROUTES.map((route) => route.listHref),
      ...DASHBOARD_RESOURCE_ROUTES.map((route) => route.createHref),
    ];

    for (const excluded of ["settings", "sources", "route-hub", "dashboard"]) {
      expect(hrefs.some((href) => href.includes(excluded))).toBe(false);
    }
  });
});

describe("pluralize", () => {
  it("uses the plural form for zero", () => {
    expect(pluralize(0, "item")).toBe("items");
    expect(pluralize(0, "category", "categories")).toBe("categories");
  });

  it("uses the singular form for exactly one", () => {
    expect(pluralize(1, "item")).toBe("item");
    expect(pluralize(1, "category", "categories")).toBe("category");
  });

  it("uses the plural form for any count greater than one", () => {
    expect(pluralize(2, "item")).toBe("items");
    expect(pluralize(42, "item")).toBe("items");
  });

  it("defaults the plural to the singular plus s when not supplied", () => {
    expect(pluralize(3, "location")).toBe("locations");
    expect(pluralize(3, "acquisition source")).toBe("acquisition sources");
  });

  it("uses an explicit irregular plural when supplied", () => {
    expect(pluralize(3, "category", "categories")).toBe("categories");
  });
});

describe("describeCurrentGameVersion", () => {
  it("returns the version's own name when one is configured", () => {
    expect(describeCurrentGameVersion({ name: "Version 1.2" })).toBe(
      "Version 1.2"
    );
  });

  it("returns a restrained administrative status when none is current", () => {
    expect(describeCurrentGameVersion(null)).toBe(
      "No current game version selected"
    );
  });
});
