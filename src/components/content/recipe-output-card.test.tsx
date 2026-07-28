import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/content/content-image", () => ({
  ContentImage: ({ alt }: { alt: string }) => (
    <span className="test-content-image">{alt}</span>
  ),
}));

import { RecipeOutputCard } from "@/components/content/recipe-output-card";
import type { RecipeOutputCardValue } from "@/lib/recipes/recipe-output-catalogue";

const recipe: RecipeOutputCardValue = {
  id: "recipe-id",
  slug: "dense-recipe",
  name: "Dense Recipe",
  resultQuantityMin: 2,
  resultQuantityMax: 4,
  profession: { name: "Smithing" },
  requiredLevel: 25,
  resultingItem: {
    name: "Dense Result",
    slug: "dense-result",
    image: null,
    category: { name: "Tools" },
  },
  ingredients: [1, 2, 3, 4].map((number) => ({
    id: `ingredient-${number}`,
    quantity: number,
    item: {
      name: `Ingredient ${number}`,
      slug: `ingredient-${number}`,
      image: null,
    },
  })),
};

describe("RecipeOutputCard", () => {
  it("renders three ingredient links and a contextual disclosure by default", () => {
    const html = renderToStaticMarkup(<RecipeOutputCard recipe={recipe} />);

    expect(html).toContain('href="/recipes/dense-recipe"');
    expect(html).toContain(
      'aria-label="Dense Recipe, produces ×2–4 Dense Result, category Tools, Smithing level 25"'
    );
    expect(html).toContain("×2–4");
    expect(html.match(/class="recipe-output-ingredient"/g)).toHaveLength(3);
    expect(html).toContain("+1 more");
    expect(html).toContain("Smithing");
    expect(html).toContain("Level 25");
    expect(html).toContain(
      'aria-label="Show 1 more ingredients for Dense Recipe"'
    );
    expect(html).not.toContain("Ingredient 4");
  });

  it("hides profession-level metadata when no required level is set", () => {
    const html = renderToStaticMarkup(
      <RecipeOutputCard recipe={{ ...recipe, requiredLevel: null }} />
    );

    expect(html).not.toContain("Level 25");
    expect(html).not.toContain("Smithing level 25");
  });
});
