import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SITE_APPEARANCE,
  clampAppearancePercentage,
  resolveSiteAppearance,
  withAppearanceCacheVersion,
} from "@/lib/appearance/defaults";

describe("appearance defaults", () => {
  it("preserves the committed logo, scenic asset, and existing per-surface crops", () => {
    expect(DEFAULT_SITE_APPEARANCE.headerLogo).toMatchObject({
      url: "/images/branding/merchants-codex-logo.png",
      width: 1394,
      height: 486,
      custom: false,
    });
    expect(DEFAULT_SITE_APPEARANCE.favicon.url).toBeNull();
    expect(DEFAULT_SITE_APPEARANCE.home.desktop).toEqual({ x: 55, y: 50 });
    expect(DEFAULT_SITE_APPEARANCE.catalogue.desktop).toEqual({ x: 55, y: 60 });
    expect(DEFAULT_SITE_APPEARANCE.itemDetail.mobile).toEqual({ x: 82, y: 50 });
  });

  it("returns defaults when no singleton exists or the id is malformed", async () => {
    const resolver = vi.fn();
    expect(await resolveSiteAppearance(null, resolver)).toBe(DEFAULT_SITE_APPEARANCE);
    expect(await resolveSiteAppearance({ id: "other" }, resolver)).toBe(
      DEFAULT_SITE_APPEARANCE
    );
    expect(resolver).not.toHaveBeenCalled();
  });
});

describe("appearance resolution", () => {
  it("clamps stored positions and keeps desktop/mobile values independent", async () => {
    const resolved = await resolveSiteAppearance(
      {
        id: "site",
        updatedAt: new Date("2026-07-29T12:00:00.000Z"),
        homeDesktopPositionX: 120,
        homeDesktopPositionY: -5,
        homeMobilePositionX: 33,
        homeMobilePositionY: 77,
      },
      vi.fn()
    );

    expect(resolved.home.desktop).toEqual({ x: 100, y: 0 });
    expect(resolved.home.mobile).toEqual({ x: 33, y: 77 });
  });

  it("uses a cache-busted custom URL only when required logo dimensions are valid", async () => {
    const publicUrl = vi.fn(async () => "https://cdn.example/logo.png");
    const valid = await resolveSiteAppearance(
      {
        id: "site",
        updatedAt: new Date("2026-07-29T12:00:00.000Z"),
        headerLogoPath: "appearance/header-logo/asset.png",
        headerLogoWidth: 900,
        headerLogoHeight: 300,
      },
      publicUrl
    );

    expect(valid.headerLogo).toEqual({
      url: "https://cdn.example/logo.png?v=1785326400000",
      width: 900,
      height: 300,
      custom: true,
    });

    const malformed = await resolveSiteAppearance(
      {
        id: "site",
        headerLogoPath: "appearance/header-logo/asset.png",
        headerLogoWidth: 0,
        headerLogoHeight: Number.NaN,
      },
      publicUrl
    );
    expect(malformed.headerLogo).toEqual(DEFAULT_SITE_APPEARANCE.headerLogo);
  });

  it("falls back per asset when URL resolution fails", async () => {
    const resolved = await resolveSiteAppearance(
      {
        id: "site",
        homeBackgroundPath: "appearance/home-background/missing.webp",
        homeBackgroundWidth: 1920,
        homeBackgroundHeight: 1080,
      },
      async () => {
        throw new Error("storage unavailable");
      }
    );
    expect(resolved.home.background).toEqual(DEFAULT_SITE_APPEARANCE.home.background);
  });
});

describe("appearance helpers", () => {
  it("clamps finite percentages and rejects malformed values", () => {
    expect(clampAppearancePercentage(45.5, 50)).toBe(45.5);
    expect(clampAppearancePercentage(-1, 50)).toBe(0);
    expect(clampAppearancePercentage(101, 50)).toBe(100);
    expect(clampAppearancePercentage(Number.NaN, 50)).toBe(50);
    expect(clampAppearancePercentage("40", 50)).toBe(50);
  });

  it("appends a version without damaging an existing query string", () => {
    expect(withAppearanceCacheVersion("/asset.png", "123")).toBe(
      "/asset.png?v=123"
    );
    expect(withAppearanceCacheVersion("/asset.png?download=1", "123")).toBe(
      "/asset.png?download=1&v=123"
    );
  });
});
