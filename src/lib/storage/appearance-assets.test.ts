import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => {
    throw new Error("Storage must not be called by validation tests.");
  }),
}));

import {
  generateAppearanceAssetPath,
  isSafeAppearanceAssetPath,
  validateAppearanceAsset,
} from "@/lib/storage/appearance-assets";

function pngFile(width: number, height: number, type = "image/png") {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return new File([bytes], "asset.png", { type });
}

describe("appearance asset validation", () => {
  it("reads dimensions from the actual bytes instead of trusting a filename", async () => {
    await expect(validateAppearanceAsset(pngFile(1394, 486), "header-logo")).resolves.toEqual({
      ok: true,
      mimeType: "image/png",
      extension: "png",
      dimensions: { width: 1394, height: 486 },
    });
  });

  it("rejects a MIME-spoofed or malformed image", async () => {
    const fake = new File([new Uint8Array([1, 2, 3, 4])], "fake.png", {
      type: "image/png",
    });
    const result = await validateAppearanceAsset(fake, "header-logo");
    expect(result).toMatchObject({ ok: false, error: "invalid_asset_file" });
  });

  it("enforces role-specific types and dimensions", async () => {
    expect(
      await validateAppearanceAsset(pngFile(32, 32), "home-background")
    ).toMatchObject({ ok: false, error: "invalid_asset_dimensions" });
    expect(
      await validateAppearanceAsset(pngFile(1024, 768), "favicon")
    ).toMatchObject({ ok: false, error: "invalid_asset_dimensions" });
    const jpegFavicon = new File([new Uint8Array(32)], "icon.jpg", {
      type: "image/jpeg",
    });
    expect(await validateAppearanceAsset(jpegFavicon, "favicon")).toMatchObject({
      ok: false,
      error: "invalid_asset_type",
    });
  });
});

describe("appearance object paths", () => {
  it("generates unique, kind-scoped immutable paths accepted by its own guard", () => {
    const first = generateAppearanceAssetPath("header-logo", "png");
    const second = generateAppearanceAssetPath("header-logo", "png");
    expect(first).not.toBe(second);
    expect(first).toMatch(/^appearance\/header-logo\/[0-9a-f-]+\.png$/);
    expect(isSafeAppearanceAssetPath(first)).toBe(true);

    const admin = generateAppearanceAssetPath("admin-background", "webp");
    expect(admin).toMatch(
      /^appearance\/admin-background\/[0-9a-f-]+\.webp$/
    );
    expect(isSafeAppearanceAssetPath(admin)).toBe(true);
  });

  it.each([
    "../appearance/header-logo/file.png",
    "appearance/header-logo/nested/file.png",
    "appearance/unknown/file.png",
    "/appearance/favicon/file.ico",
    "https://example.com/appearance/favicon/file.ico",
    "appearance/favicon/file.svg",
  ])("rejects unsafe path %j", (path) => {
    expect(isSafeAppearanceAssetPath(path)).toBe(false);
  });
});
