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
  experienceReward: 120,
  resultingItem: {
    name: "Dense Result",
    slug: "dense-result",
    image: null,
    category: { name: "Tools" },
  },
  ingredients: [1, 2, 3, 4, 5].map((number) => ({
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
  it("renders four ingredient links and discloses the fifth", () => {
    const html = renderToStaticMarkup(<RecipeOutputCard recipe={recipe} />);

    expect(html).toContain('href="/recipes/dense-recipe"');
    expect(html).toContain(
      'aria-label="Dense Recipe, produces ×2–4 Dense Result, category Tools, Smithing level 25"'
    );
    expect(html).toContain("×2–4");
    expect(html.match(/class="recipe-output-ingredient"/g)).toHaveLength(4);
    expect(html).toContain("Smithing");
    expect(html).toContain("Level 25");
    expect(html).toContain("recipe-output-ingredient-toggle-chevron");
    expect(html).not.toContain("+1 more");
    expect(html).toContain("Ingredient 4");
    expect(html).toContain(
      'aria-label="Show 1 more ingredients for Dense Recipe"'
    );
    expect(html).not.toContain("Ingredient 5");
  });

  it("keeps the profession visible when no required level is set", () => {
    const html = renderToStaticMarkup(
      <RecipeOutputCard recipe={{ ...recipe, requiredLevel: null }} />
    );

    expect(html).not.toContain("Level 25");
    expect(html).not.toContain("Smithing level 25");
    expect(html).toContain("Smithing");
    expect(html).toContain(
      'aria-label="Dense Recipe, produces ×2–4 Dense Result, category Tools, Smithing"'
    );
  });

  it("uses the Claude Design list columns without changing links or labels", () => {
    const html = renderToStaticMarkup(
      <RecipeOutputCard recipe={recipe} variant="directory-list" />
    );

    expect(html).toContain("recipe-output-card--directory-list");
    expect(html).toContain("recipe-output-list-identity");
    expect(html).toContain("recipe-output-list-profession");
    expect(html).toContain("recipe-output-experience");
    expect(html).toContain("+120 EXP");
    expect(html).toContain('href="/recipes/dense-recipe"');
    expect(html.match(/class="recipe-output-ingredient"/g)).toHaveLength(5);
  });

  it("caps the directory grid preview at three ingredients", () => {
    const html = renderToStaticMarkup(
      <RecipeOutputCard recipe={recipe} variant="directory-grid" />
    );

    expect(html.match(/class="recipe-output-ingredient"/g)).toHaveLength(3);
    expect(html).toContain("recipe-output-ingredient-toggle-chevron");
    expect(html).not.toContain(">+2<");
    expect(html).toContain("recipe-output-ingredient-quantity-badge");
    expect(html).toContain(
      'aria-label="Show 2 more ingredients for Dense Recipe"'
    );
  });
});
