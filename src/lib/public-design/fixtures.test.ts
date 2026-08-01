import { describe, expect, it } from "vitest";
import {
  PUBLIC_DESIGN_FIXTURES,
  PUBLIC_DESIGN_GAME_VERSION_NAME,
  PUBLIC_DESIGN_IMAGE_PATH,
  PUBLIC_DESIGN_RECORD_MANIFEST,
  PUBLIC_DESIGN_SLUG_PREFIX,
} from "@/lib/public-design/fixtures";

describe("public design fixture manifest", () => {
  it("uses unique deterministic paths and safe cleanup prefixes", () => {
    expect(PUBLIC_DESIGN_SLUG_PREFIX).toBe("design-review-");
    expect(PUBLIC_DESIGN_GAME_VERSION_NAME).toMatch(/^Design Review - /);
    expect(PUBLIC_DESIGN_IMAGE_PATH).toMatch(
      /^items\/test-service-public-design-[a-z0-9-]+\.png$/
    );
    expect(new Set(PUBLIC_DESIGN_FIXTURES.map(({ key }) => key)).size).toBe(
      PUBLIC_DESIGN_FIXTURES.length
    );
    expect(new Set(PUBLIC_DESIGN_RECORD_MANIFEST.map(({ slug }) => slug)).size).toBe(
      PUBLIC_DESIGN_RECORD_MANIFEST.length
    );
    for (const record of PUBLIC_DESIGN_RECORD_MANIFEST) {
      expect(record.slug).toMatch(/^design-review-[a-z0-9-]+$/);
      expect(record.states.length).toBeGreaterThan(0);
    }
  });

  it("documents the required pathological fixture families", () => {
    const states = PUBLIC_DESIGN_RECORD_MANIFEST.flatMap(({ states }) => states).join(" ");
    for (const required of [
      "rich description",
      "very long name",
      "no image",
      "verified",
      "unverified",
      "more than four ingredients",
      "more than one catalogue page",
      "deep breadcrumb",
      "many listings",
      "multiple currencies",
      "no inventory",
    ]) {
      expect(states).toContain(required);
    }
  });
});
