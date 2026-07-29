import { afterEach, describe, expect, it } from "vitest";
import { getAppearanceAssetPublicUrl } from "@/lib/appearance/public";

const originalProjectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

afterEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = originalProjectUrl;
});

describe("getAppearanceAssetPublicUrl", () => {
  it("constructs a portable public URL without a request-bound Supabase client", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test-project.supabase.co/";
    await expect(
      getAppearanceAssetPublicUrl("appearance/header-logo/example file.png")
    ).resolves.toBe(
      "https://test-project.supabase.co/storage/v1/object/public/game-images/appearance/header-logo/example%20file.png"
    );
  });

  it("fails closed when public project configuration is absent", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    await expect(
      getAppearanceAssetPublicUrl("appearance/header-logo/example.png")
    ).resolves.toBeNull();
  });
});
