import { describe, expect, it } from "vitest";
import {
  LOCATION_CREATE_PATH,
  LOCATION_LIST_PATH,
  locationDeleteHref,
  locationEditHref,
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
});
