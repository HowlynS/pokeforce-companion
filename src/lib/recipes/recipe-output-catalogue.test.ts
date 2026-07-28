import { describe, expect, it } from "vitest";
import {
  recipeOutputPageHref,
  resolveRecipeOutputPage,
} from "@/lib/recipes/recipe-output-catalogue";

describe("recipe output catalogue pagination", () => {
  it("uses a deterministic 12-Recipe page and clamps invalid input", () => {
    expect(resolveRecipeOutputPage(undefined, 0)).toEqual({
      currentPage: 1,
      pageCount: 1,
      skip: 0,
    });
    expect(resolveRecipeOutputPage("not-a-page", 13)).toEqual({
      currentPage: 1,
      pageCount: 2,
      skip: 0,
    });
    expect(resolveRecipeOutputPage("99", 13)).toEqual({
      currentPage: 2,
      pageCount: 2,
      skip: 12,
    });
  });

  it("keeps page one canonical and adds a query only for later pages", () => {
    expect(recipeOutputPageHref("/recipes", 1)).toBe("/recipes");
    expect(recipeOutputPageHref("/recipes", 2)).toBe("/recipes?page=2");
    expect(
      recipeOutputPageHref("/recipes", 1, { profession: "smithing" })
    ).toBe("/recipes?profession=smithing");
    expect(
      recipeOutputPageHref("/recipes", 2, { profession: "smithing" })
    ).toBe("/recipes?profession=smithing&page=2");
  });
});
