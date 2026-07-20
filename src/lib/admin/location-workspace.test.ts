import { describe, expect, it } from "vitest";
import {
  LOCATION_CREATE_PATH,
  LOCATION_LIST_PATH,
  locationDeleteHref,
  locationEditHref,
  locationEditorTabs,
  locationHierarchyHref,
  normalizeLocationSearchQuery,
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
});

describe("locationEditorTabs", () => {
  it("marks General active and links Hierarchy as a real destination", () => {
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
        href: "",
        active: false,
        disabled: true,
      },
      { label: "Metadata", href: "", active: false, disabled: true },
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
  });

  it("preserves the query on both real tabs' own hrefs", () => {
    const tabs = locationEditorTabs("sunken-cave", "cave", "general");

    expect(tabs[0].href).toBe("/admin/locations/sunken-cave/edit?q=cave");
    expect(tabs[1].href).toBe("/admin/locations/sunken-cave/hierarchy?q=cave");
  });

  it("marks exactly one tab active for every valid key", () => {
    for (const active of ["general", "hierarchy"] as const) {
      const tabs = locationEditorTabs("sunken-cave", "", active);
      expect(tabs.filter((tab) => tab.active)).toHaveLength(1);
    }
  });

  it("renders only Acquisition Sources and Metadata as disabled placeholders", () => {
    for (const active of ["general", "hierarchy"] as const) {
      const tabs = locationEditorTabs("sunken-cave", "", active);

      expect(tabs[2]).toEqual({
        label: "Acquisition Sources",
        href: "",
        active: false,
        disabled: true,
      });
      expect(tabs[3]).toEqual({
        label: "Metadata",
        href: "",
        active: false,
        disabled: true,
      });
      expect(tabs[0].disabled).toBeUndefined();
      expect(tabs[1].disabled).toBeUndefined();
      expect(tabs[0].href).not.toBe("");
      expect(tabs[1].href).not.toBe("");
    }
  });
});
