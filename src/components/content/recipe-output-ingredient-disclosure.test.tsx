import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RecipeOutputIngredientDisclosure } from "@/components/content/recipe-output-ingredient-disclosure";

describe("RecipeOutputIngredientDisclosure", () => {
  it("renders a contextual native button and only the collapsed preview", () => {
    const html = renderToStaticMarkup(
      <RecipeOutputIngredientDisclosure
        listId="recipe-test-ingredients"
        recipeName="Test E2E Dense Gearwork"
        previewIngredients={<span>Preview ingredients</span>}
        remainingIngredients={<span>Hidden ingredients</span>}
        remainingCount={6}
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
  });
});
