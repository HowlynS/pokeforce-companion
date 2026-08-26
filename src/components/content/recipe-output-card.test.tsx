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
      category: { name: "Materials" },
    },
  })),
};

/** The same Recipe, trimmed to the canonical grid's preview budget. */
const sparseRecipe: RecipeOutputCardValue = {
  ...recipe,
  ingredients: recipe.ingredients.slice(0, 3),
};

/** Preview chips only. The chip carries the Item-hue marker alongside its
    own class, so the name is matched at a token boundary rather than as the
    entire attribute value. */
const CHIP_CLASS = /class="recipe-output-ingredient[ "]/g;

const countIngredients = (html: string) =>
  html.match(CHIP_CLASS)?.length ?? 0;

describe("RecipeOutputCard", () => {
  it("renders four ingredient links and discloses the fifth", () => {
    const html = renderToStaticMarkup(<RecipeOutputCard recipe={recipe} />);

    expect(html).toContain('href="/recipes/dense-recipe"');
    expect(html).toContain(
      'aria-label="Dense Recipe, produces ×2–4 Dense Result, category Tools, Smithing level 25"'
    );
    expect(html).toContain("×2–4");
    expect(html.match(CHIP_CLASS)).toHaveLength(4);
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
    expect(html.match(CHIP_CLASS)).toHaveLength(5);
  });

  it("caps the directory grid preview at three ingredients", () => {
    const html = renderToStaticMarkup(
      <RecipeOutputCard recipe={recipe} variant="directory-grid" />
    );

    expect(html.match(CHIP_CLASS)).toHaveLength(3);
    expect(html).toContain("recipe-output-ingredient-toggle-chevron");
    expect(html).not.toContain(">+2<");
    expect(html).toContain("recipe-output-ingredient-quantity-badge");
    expect(html).toContain(
      'aria-label="Show 2 more ingredients for Dense Recipe"'
    );
  });
});

describe("RecipeOutputCard Profession metadata", () => {
  // Every variant routes the Profession NAME through the one shared
  // semantic class, so no card can carry a private copy of the treatment
  // and no rule can key it on how many siblings the cell happens to render.
  const VARIANTS = [
    "standard",
    "directory-grid",
    "directory-list",
    "grid",
    "list",
  ] as const;

  for (const variant of VARIANTS) {
    it(`marks the profession as shared meta in the ${variant} variant`, () => {
      const html = renderToStaticMarkup(
        <RecipeOutputCard recipe={recipe} variant={variant} />
      );

      expect(html).toContain('class="public-meta-profession"');
      // The unused `standard` variant still renders its level as inline
      // prose rather than a cell of its own; every production variant uses
      // the named level class.
      if (variant !== "standard") {
        expect(html).toContain("recipe-output-requirement-level");
      }
    });

    it(`keeps the shared meta class with no required level in the ${variant} variant`, () => {
      const html = renderToStaticMarkup(
        <RecipeOutputCard
          recipe={{ ...recipe, requiredLevel: null }}
          variant={variant}
        />
      );

      expect(html).toContain('class="public-meta-profession"');
      expect(html).not.toContain("recipe-output-requirement-level");
    });
  }
});

describe("RecipeOutputCard, canonical grid variant", () => {
  it("previews three ingredients and offers the chevron past that", () => {
    const html = renderToStaticMarkup(
      <RecipeOutputCard recipe={recipe} variant="grid" />
    );

    expect(html).toContain("recipe-output-card--grid");
    expect(countIngredients(html)).toBe(3);
    expect(html).toContain("recipe-output-ingredient-toggle-chevron");
    expect(html).toContain(
      'aria-label="Show 2 more ingredients for Dense Recipe"'
    );
    // The labelled yield plate, and never the list row's bare value.
    expect(html).toContain("Yields");
  });

  it("omits the chevron entirely at or below the preview budget", () => {
    const html = renderToStaticMarkup(
      <RecipeOutputCard recipe={sparseRecipe} variant="grid" />
    );

    expect(countIngredients(html)).toBe(3);
    expect(html).not.toContain("recipe-output-ingredient-toggle");
    expect(html).not.toContain("recipe-output-ingredient-panel");
  });
});

describe("RecipeOutputCard, canonical list variant", () => {
  it("renders every ingredient inline, with EXP and the yield badge", () => {
    const html = renderToStaticMarkup(
      <RecipeOutputCard recipe={recipe} variant="list" />
    );

    expect(html).toContain("recipe-output-card--list");
    expect(countIngredients(html)).toBe(recipe.ingredients.length);
    expect(html).toContain("Ingredient 5");
    expect(html).toContain("+120 EXP");
    expect(html).toContain("recipe-output-yield");
    // The compact row shows the yield value alone — no "Yields" label.
    expect(html).not.toContain("Yields");
  });

  it("never renders a chevron or an ingredient panel, at any length", () => {
    for (const value of [recipe, sparseRecipe]) {
      const html = renderToStaticMarkup(
        <RecipeOutputCard recipe={value} variant="list" />
      );

      expect(html).not.toContain("recipe-output-ingredient-toggle");
      expect(html).not.toContain("recipe-output-ingredient-panel");
      expect(html).not.toContain("recipe-output-ingredient-disclosure");
      expect(html).not.toContain("more ingredients");
      expect(countIngredients(html)).toBe(value.ingredients.length);
    }
  });
});
