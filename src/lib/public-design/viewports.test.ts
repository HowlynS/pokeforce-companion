import { describe, expect, it } from "vitest";
import {
  PRIMARY_PUBLIC_DESIGN_VIEWPORTS,
  PUBLIC_DESIGN_VIEWPORTS,
  PUBLIC_DESIGN_VIEWPORT_CATEGORIES,
  getPublicDesignViewport,
} from "@/lib/public-design/viewports";

describe("public design viewport registry", () => {
  it("contains unique, valid viewport definitions", () => {
    expect(new Set(PUBLIC_DESIGN_VIEWPORTS.map(({ id }) => id)).size).toBe(
      PUBLIC_DESIGN_VIEWPORTS.length
    );

    for (const viewport of PUBLIC_DESIGN_VIEWPORTS) {
      expect(viewport.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(viewport.label.trim()).not.toBe("");
      expect(viewport.width).toBeGreaterThan(0);
      expect(viewport.height).toBeGreaterThan(0);
      expect(PUBLIC_DESIGN_VIEWPORT_CATEGORIES).toContain(viewport.category);
      expect(viewport.expectedLayout.trim()).not.toBe("");
    }
  });

  it("exposes the required primary acceptance matrix", () => {
    expect(PRIMARY_PUBLIC_DESIGN_VIEWPORTS.map(({ id }) => id)).toEqual([
      "desktop-1920",
      "desktop-2560",
      "ultrawide-3440",
      "intermediate-1000",
      "mobile-390",
    ]);
    expect(getPublicDesignViewport("tablet-768")).toMatchObject({
      width: 768,
      height: 1024,
      primary: false,
    });
  });
});
