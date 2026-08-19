import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RecipeOutputIngredientDisclosure } from "@/components/content/recipe-output-ingredient-disclosure";

/** Seven preview chips, of which the server shows one — six remain. */
const previews = Array.from({ length: 7 }, (_, index) => (
  <span key={index}>{index === 0 ? "Preview ingredients" : `Chip ${index}`}</span>
));

describe("RecipeOutputIngredientDisclosure", () => {
  it("renders a contextual native button and only the collapsed preview", () => {
    const html = renderToStaticMarkup(
      <RecipeOutputIngredientDisclosure
        listId="recipe-test-ingredients"
        recipeName="Test E2E Dense Gearwork"
        previewIngredients={previews}
        expandedIngredients={<span>Hidden ingredients</span>}
        initialVisibleCount={1}
      />
    );

    expect(html).toContain("<button");
    expect(html).toContain('type="button"');
    expect(html).toContain('aria-controls="recipe-test-ingredients"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain(
      'aria-label="Show 6 more ingredients for Test E2E Dense Gearwork"'
    );
    expect(html).toContain("recipe-output-ingredient-toggle-chevron");
    expect(html).not.toContain("+6 more");
    expect(html).toContain("Preview ingredients");
    expect(html).not.toContain("Hidden ingredients");
    // Only the server budget is rendered, never the whole set.
    expect(html).not.toContain("Chip 1");
  });

  it("renders the server budget in adaptive mode so hydration has a stable floor", () => {
    const html = renderToStaticMarkup(
      <RecipeOutputIngredientDisclosure
        listId="recipe-adaptive"
        recipeName="Adaptive Recipe"
        previewIngredients={previews}
        expandedIngredients={<span>Hidden ingredients</span>}
        initialVisibleCount={3}
        adaptive
      />
    );

    expect(html).toContain("Preview ingredients");
    expect(html).toContain("Chip 1");
    expect(html).toContain("Chip 2");
    expect(html).not.toContain("Chip 3");
    // Overflow exists at the server budget, so the trigger ships with it.
    expect(html).toContain(
      'aria-label="Show 4 more ingredients for Adaptive Recipe"'
    );
  });

  it("omits the trigger entirely when the server budget already covers every ingredient", () => {
    const html = renderToStaticMarkup(
      <RecipeOutputIngredientDisclosure
        listId="recipe-small"
        recipeName="Small Recipe"
        previewIngredients={previews.slice(0, 2)}
        expandedIngredients={<span>Hidden ingredients</span>}
        initialVisibleCount={3}
        adaptive
      />
    );

    expect(html).toContain("Preview ingredients");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("recipe-output-ingredient-toggle");
  });
});
