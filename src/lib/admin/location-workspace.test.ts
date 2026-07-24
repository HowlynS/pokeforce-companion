import { describe, expect, it } from "vitest";
import {
  LOCATION_CREATE_PATH,
  LOCATION_LIST_PATH,
  describeLinkedLocations,
  hierarchyRelationshipCount,
  locationCanDelete,
  locationDeleteHref,
  locationEditHref,
  locationEditorTabs,
  locationHierarchyHref,
  locationSourcesHref,
  normalizeLocationSearchQuery,
  sortLocationAcquisitionSourcesByType,
  withLocationSearchQuery,
} from "@/lib/admin/location-workspace";

// Admin Polish Pass 1, Part 5: shared between the dedicated /delete route
// and the in-editor delete dialog — pinned here so the two surfaces can
// never silently drift apart.
describe("locationCanDelete", () => {
  it("allows deletion when the location has no sub-locations", () => {
    expect(locationCanDelete(0)).toBe(true);
  });

  it("blocks deletion when the location has at least one sub-location", () => {
    expect(locationCanDelete(1)).toBe(false);
    expect(locationCanDelete(4)).toBe(false);
  });
});

describe("describeLinkedLocations", () => {
  it("uses singular phrasing for exactly one sub-location", () => {
    expect(describeLinkedLocations(1)).toBe("1 sub-location");
  });

  it("uses plural phrasing for zero or more than one sub-location", () => {
    expect(describeLinkedLocations(0)).toBe("0 sub-locations");
    expect(describeLinkedLocations(5)).toBe("5 sub-locations");
  });
});

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

  describe("relationship-count badges", () => {
    it("omits count entirely when no counts are supplied", () => {
      const tabs = locationEditorTabs("sunken-cave", "", "general");

      expect(tabs[0].count).toBeUndefined();
      expect(tabs[1].count).toBeUndefined();
      expect(tabs[2].count).toBeUndefined();
    });

    it("threads Hierarchy and Acquisition Sources counts onto their own tabs only, never General", () => {
      const tabs = locationEditorTabs("sunken-cave", "", "general", {
        hierarchy: 2,
        acquisitionSources: 5,
      });

      expect(tabs[0].count).toBeUndefined();
      expect(tabs[1].count).toBe(2);
      expect(tabs[2].count).toBe(5);
    });

    it("preserves an explicit zero count rather than treating it as absent", () => {
      const tabs = locationEditorTabs("sunken-cave", "", "hierarchy", {
        hierarchy: 0,
        acquisitionSources: 0,
      });

      expect(tabs[1].count).toBe(0);
      expect(tabs[2].count).toBe(0);
    });
  });
});

describe("hierarchyRelationshipCount", () => {
  it("counts direct children only when there is no parent", () => {
    expect(
      hierarchyRelationshipCount({ parentId: null, childrenCount: 3 })
    ).toBe(3);
  });

  it("adds exactly one for an existing parent, regardless of child count", () => {
    expect(
      hierarchyRelationshipCount({ parentId: "loc_1", childrenCount: 0 })
    ).toBe(1);
    expect(
      hierarchyRelationshipCount({ parentId: "loc_1", childrenCount: 4 })
    ).toBe(5);
  });

  it("is zero for a root location with no children", () => {
    expect(
      hierarchyRelationshipCount({ parentId: null, childrenCount: 0 })
    ).toBe(0);
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
