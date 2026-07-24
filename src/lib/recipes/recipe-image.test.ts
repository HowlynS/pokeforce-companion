import { describe, expect, it } from "vitest";
import { resolveRecipeDisplayImage } from "./recipe-image";

describe("resolveRecipeDisplayImage", () => {
  it("uses the recipe's own image when present, even if the item also has one", () => {
    expect(
      resolveRecipeDisplayImage({
        recipeImage: "recipes/custom.png",
        resultingItemImage: "items/result.png",
      })
    ).toBe("recipes/custom.png");
  });

  it("falls back to the resulting item's image when the recipe has none", () => {
    expect(
      resolveRecipeDisplayImage({
        recipeImage: null,
        resultingItemImage: "items/result.png",
      })
    ).toBe("items/result.png");
  });

  it("returns null when neither the recipe nor the item has an image", () => {
    expect(
      resolveRecipeDisplayImage({ recipeImage: null, resultingItemImage: null })
    ).toBeNull();
  });

  it("never lets the recipe name or any other field influence the result", () => {
    // The function only ever sees image values — there is no name parameter
    // to pass, so a caller cannot accidentally wire name-based matching in.
    expect(
      resolveRecipeDisplayImage({
        recipeImage: null,
        resultingItemImage: "items/iron-ingot.png",
      })
    ).toBe("items/iron-ingot.png");
  });
});
