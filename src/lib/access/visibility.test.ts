import { describe, expect, it } from "vitest";
import { isForcedPrivate, resolveSiteVisibility } from "./visibility";

describe("site visibility resolution", () => {
  it("fails closed when the database setting is missing", () => {
    expect(resolveSiteVisibility(null, undefined)).toBe("PRIVATE_BETA");
  });

  it("honors either stored mode without an override", () => {
    expect(resolveSiteVisibility("PRIVATE_BETA", undefined)).toBe("PRIVATE_BETA");
    expect(resolveSiteVisibility("PUBLIC", undefined)).toBe("PUBLIC");
  });

  it("allows the environment to force private but never public", () => {
    expect(resolveSiteVisibility("PUBLIC", "true")).toBe("PRIVATE_BETA");
    expect(resolveSiteVisibility("PRIVATE_BETA", "false")).toBe("PRIVATE_BETA");
    expect(isForcedPrivate("TRUE")).toBe(true);
    expect(isForcedPrivate("1")).toBe(false);
  });
});
