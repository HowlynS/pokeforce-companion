import { describe, expect, it } from "vitest";
import { resolveImagePanelDisplay } from "./image-panel-display";

describe("resolveImagePanelDisplay: no inheritance (Item/Profession/Category/Location)", () => {
  it("shows nothing when there is no image at all", () => {
    const result = resolveImagePanelDisplay({
      previewUrl: null,
      imageUrl: null,
      removed: false,
    });
    expect(result).toEqual({
      displayImageUrl: null,
      isPendingRemoval: false,
      isShowingInherited: false,
      isShowingOverride: false,
    });
  });

  it("shows the persisted image normally when nothing is pending", () => {
    const result = resolveImagePanelDisplay({
      previewUrl: null,
      imageUrl: "items/iron-ore.png",
      removed: false,
    });
    expect(result.displayImageUrl).toBe("items/iron-ore.png");
    expect(result.isPendingRemoval).toBe(false);
  });

  it("keeps showing the persisted image, muted, while removal is pending — never the empty fallback", () => {
    const result = resolveImagePanelDisplay({
      previewUrl: null,
      imageUrl: "items/iron-ore.png",
      removed: true,
    });
    expect(result.displayImageUrl).toBe("items/iron-ore.png");
    expect(result.isPendingRemoval).toBe(true);
  });

  it("reversing removal restores the normal (non-muted) persisted image immediately", () => {
    const pending = resolveImagePanelDisplay({
      previewUrl: null,
      imageUrl: "items/iron-ore.png",
      removed: true,
    });
    const reversed = resolveImagePanelDisplay({
      previewUrl: null,
      imageUrl: "items/iron-ore.png",
      removed: false,
    });
    expect(pending.isPendingRemoval).toBe(true);
    expect(reversed.isPendingRemoval).toBe(false);
    expect(reversed.displayImageUrl).toBe("items/iron-ore.png");
  });

  it("after the removal is actually persisted (remount with imageUrl null), shows the empty fallback", () => {
    const result = resolveImagePanelDisplay({
      previewUrl: null,
      imageUrl: null,
      removed: false,
    });
    expect(result.displayImageUrl).toBeNull();
    expect(result.isPendingRemoval).toBe(false);
  });

  it("a freshly selected local file always wins, even while removal is simultaneously checked, and is never muted", () => {
    const result = resolveImagePanelDisplay({
      previewUrl: "blob:local-file",
      imageUrl: "items/iron-ore.png",
      removed: true,
    });
    expect(result.displayImageUrl).toBe("blob:local-file");
    expect(result.isPendingRemoval).toBe(false);
  });

  it("never reports isShowingInherited/isShowingOverride when inheritedImageUrl is not provided", () => {
    const result = resolveImagePanelDisplay({
      previewUrl: null,
      imageUrl: "items/iron-ore.png",
      removed: false,
    });
    expect(result.isShowingInherited).toBe(false);
    expect(result.isShowingOverride).toBe(false);
  });
});

describe("resolveImagePanelDisplay: with inheritance (Recipe)", () => {
  it("shows the inherited fallback when the recipe has no custom image", () => {
    const result = resolveImagePanelDisplay({
      previewUrl: null,
      imageUrl: null,
      inheritedImageUrl: "items/copper-ingot.png",
      removed: false,
    });
    expect(result.displayImageUrl).toBe("items/copper-ingot.png");
    expect(result.isShowingInherited).toBe(true);
    expect(result.isShowingOverride).toBe(false);
  });

  it("shows the custom recipe image (override) when both exist, ignoring the inherited fallback", () => {
    const result = resolveImagePanelDisplay({
      previewUrl: null,
      imageUrl: "recipes/custom.png",
      inheritedImageUrl: "items/copper-ingot.png",
      removed: false,
    });
    expect(result.displayImageUrl).toBe("recipes/custom.png");
    expect(result.isShowingOverride).toBe(true);
    expect(result.isShowingInherited).toBe(false);
  });

  it("keeps showing the custom recipe image, muted, while its removal is pending — never the inherited item image yet", () => {
    const result = resolveImagePanelDisplay({
      previewUrl: null,
      imageUrl: "recipes/custom.png",
      inheritedImageUrl: "items/copper-ingot.png",
      removed: true,
    });
    expect(result.displayImageUrl).toBe("recipes/custom.png");
    expect(result.isPendingRemoval).toBe(true);
    expect(result.isShowingInherited).toBe(false);
    expect(result.isShowingOverride).toBe(false);
  });

  it("after the custom image removal is actually persisted (remount with imageUrl null), reveals the inherited item image", () => {
    const result = resolveImagePanelDisplay({
      previewUrl: null,
      imageUrl: null,
      inheritedImageUrl: "items/copper-ingot.png",
      removed: false,
    });
    expect(result.displayImageUrl).toBe("items/copper-ingot.png");
    expect(result.isShowingInherited).toBe(true);
  });

  it("returns null when neither a custom nor an inherited image exists", () => {
    const result = resolveImagePanelDisplay({
      previewUrl: null,
      imageUrl: null,
      inheritedImageUrl: null,
      removed: false,
    });
    expect(result.displayImageUrl).toBeNull();
    expect(result.isShowingInherited).toBe(false);
  });
});
