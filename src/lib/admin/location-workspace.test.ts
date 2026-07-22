import { describe, expect, it } from "vitest";
import {
  LOCATION_CREATE_PATH,
  LOCATION_LIST_PATH,
  locationDeleteHref,
  locationEditHref,
  locationEditorTabs,
  locationHierarchyHref,
  locationSourcesHref,
  normalizeLocationSearchQuery,
  sortLocationAcquisitionSourcesByType,
  withLocationSearchQuery,
} from "@/lib/admin/location-workspace";

describe("normalizeLocationSearchQuery", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeLocationSearchQuery("  cave  ")).toBe("cave");
  });

  it("treats absent, blank, and non-string values as no query", () => {
    expect(normalizeLocationSearchQuery(undefined)).toBe("");
    expect(normalizeLocationSearchQuery("   ")).toBe("");
    expect(normalizeLocationSearchQuery(["cave", "town"])).toBe("");
    expect(normalizeLocationSearchQuery(42)).toBe("");
  });
});

describe("withLocationSearchQuery", () => {
  it("appends the encoded query as the q parameter", () => {
    expect(withLocationSearchQuery(LOCATION_LIST_PATH, "sunken cave")).toBe(
      "/admin/locations?q=sunken%20cave"
    );
  });

  it("leaves the path untouched when no query is active", () => {
    expect(withLocationSearchQuery(LOCATION_LIST_PATH, "")).toBe(
      "/admin/locations"
    );
    expect(withLocationSearchQuery(LOCATION_CREATE_PATH, "")).toBe(
      "/admin/locations/new"
    );
  });

  it("encodes characters that would corrupt the URL", () => {
    expect(withLocationSearchQuery(LOCATION_LIST_PATH, "a&b=c")).toBe(
      "/admin/locations?q=a%26b%3Dc"
    );
  });
});

describe("location workspace hrefs", () => {
  it("builds slug-based edit and delete routes", () => {
    expect(locationEditHref("sunken-cave", "")).toBe(
      "/admin/locations/sunken-cave/edit"
    );
    expect(locationDeleteHref("sunken-cave", "")).toBe(
      "/admin/locations/sunken-cave/delete"
    );
  });

  it("preserves the active query for quick switching and deletion", () => {
    expect(locationEditHref("sunken-cave", "cave")).toBe(
      "/admin/locations/sunken-cave/edit?q=cave"
    );
    expect(locationDeleteHref("sunken-cave", "cave")).toBe(
      "/admin/locations/sunken-cave/delete?q=cave"
    );
  });

  it("builds the Hierarchy tab route, preserving the query", () => {
    expect(locationHierarchyHref("sunken-cave", "")).toBe(
      "/admin/locations/sunken-cave/hierarchy"
    );
    expect(locationHierarchyHref("sunken-cave", "cave")).toBe(
      "/admin/locations/sunken-cave/hierarchy?q=cave"
    );
  });

  it("builds the Acquisition Sources tab route, preserving the query", () => {
    expect(locationSourcesHref("sunken-cave", "")).toBe(
      "/admin/locations/sunken-cave/sources"
    );
    expect(locationSourcesHref("sunken-cave", "cave")).toBe(
      "/admin/locations/sunken-cave/sources?q=cave"
    );
  });
});

describe("locationEditorTabs", () => {
  it("marks General active and links every other tab as a real destination", () => {
    const tabs = locationEditorTabs("sunken-cave", "", "general");

    expect(tabs).toEqual([
      {
        label: "General",
        href: "/admin/locations/sunken-cave/edit",
        active: true,
      },
      {
        label: "Hierarchy",
        href: "/admin/locations/sunken-cave/hierarchy",
        active: false,
      },
      {
        label: "Acquisition Sources",
        href: "/admin/locations/sunken-cave/sources",
        active: false,
      },
    ]);
  });

  it("marks Hierarchy active when that is the current tab", () => {
    const tabs = locationEditorTabs("sunken-cave", "cave", "hierarchy");

    expect(tabs[0]).toEqual({
      label: "General",
      href: "/admin/locations/sunken-cave/edit?q=cave",
      active: false,
    });
    expect(tabs[1]).toEqual({
      label: "Hierarchy",
      href: "/admin/locations/sunken-cave/hierarchy?q=cave",
      active: true,
    });
    expect(tabs[2].active).toBe(false);
  });

  it("marks Acquisition Sources active when that is the current tab", () => {
    const tabs = locationEditorTabs("sunken-cave", "cave", "sources");

    expect(tabs[2]).toEqual({
      label: "Acquisition Sources",
      href: "/admin/locations/sunken-cave/sources?q=cave",
      active: true,
    });
    expect(tabs[0].active).toBe(false);
    expect(tabs[1].active).toBe(false);
  });

  it("preserves the query on every tab's own href", () => {
    const tabs = locationEditorTabs("sunken-cave", "cave", "general");

    expect(tabs[0].href).toBe("/admin/locations/sunken-cave/edit?q=cave");
    expect(tabs[1].href).toBe("/admin/locations/sunken-cave/hierarchy?q=cave");
    expect(tabs[2].href).toBe("/admin/locations/sunken-cave/sources?q=cave");
  });

  it("marks exactly one tab active for every valid key", () => {
    for (const active of ["general", "hierarchy", "sources"] as const) {
      const tabs = locationEditorTabs("sunken-cave", "", active);
      expect(tabs.filter((tab) => tab.active)).toHaveLength(1);
    }
  });

  it("renders no disabled tabs — every Location tab is now a real destination", () => {
    for (const active of ["general", "hierarchy", "sources"] as const) {
      const tabs = locationEditorTabs("sunken-cave", "", active);
      expect(tabs.every((tab) => !tab.disabled)).toBe(true);
      expect(tabs.every((tab) => tab.href !== "")).toBe(true);
    }
  });
});

describe("sortLocationAcquisitionSourcesByType", () => {
  it("orders sources by the AcquisitionType enum's declared order", () => {
    const sources = [
      { id: "a", type: "ENEMY_DROP" as const },
      { id: "b", type: "FORAGING" as const },
      { id: "c", type: "MINING" as const },
    ];

    expect(sortLocationAcquisitionSourcesByType(sources).map((s) => s.id)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });

  it("preserves the caller's own order within the same type (stable sort)", () => {
    const sources = [
      { id: "first", type: "MINING" as const },
      { id: "second", type: "MINING" as const },
      { id: "third", type: "MINING" as const },
    ];

    expect(
      sortLocationAcquisitionSourcesByType(sources).map((s) => s.id)
    ).toEqual(["first", "second", "third"]);
  });

  it("does not mutate the input array", () => {
    const sources = [
      { id: "a", type: "OTHER" as const },
      { id: "b", type: "FORAGING" as const },
    ];
    const original = [...sources];

    sortLocationAcquisitionSourcesByType(sources);

    expect(sources).toEqual(original);
  });
});
