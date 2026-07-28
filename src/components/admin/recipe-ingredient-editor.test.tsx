import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RecipeIngredientEditor } from "@/components/admin/recipe-ingredient-editor";

const OPTIONS = Array.from({ length: 50 }, (_, index) => ({
  value: `item-${index + 1}`,
  label: `Item ${index + 1}`,
  imageUrl: null,
}));

function ingredients(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    itemId: `item-${index + 1}`,
    quantity: index + 1,
  }));
}

describe("RecipeIngredientEditor", () => {
  it("starts a new Recipe with one independent ingredient row", () => {
    const html = renderToStaticMarkup(
      <RecipeIngredientEditor options={OPTIONS} />
    );

    expect(html.match(/name="ingredientItemId\d+"/g)).toHaveLength(1);
    expect(html).toContain('name="ingredientRowIds" value="1"');
    expect(html).toContain("+ Ingredient");
  });

  it("renders every saved ingredient beyond the former five-row ceiling", () => {
    const html = renderToStaticMarkup(
      <RecipeIngredientEditor
        options={OPTIONS}
        initialIngredients={ingredients(6)}
      />
    );

    expect(html.match(/name="ingredientItemId\d+"/g)).toHaveLength(6);
    expect(html).toContain(
      'name="ingredientRowIds" value="1,2,3,4,5,6"'
    );
    expect(html).toContain(">Item 6<");
  });

  it("marks only the later duplicate selector invalid with the exact message", () => {
    const html = renderToStaticMarkup(
      <RecipeIngredientEditor
        options={OPTIONS}
        initialIngredients={[
          { itemId: "item-1", quantity: 1 },
          { itemId: "item-1", quantity: 2 },
        ]}
      />
    );

    expect(html.match(/aria-invalid="true"/g)).toHaveLength(1);
    expect(html).toContain(
      "This item is already used as an ingredient."
    );
    expect(html).toContain(
      'aria-describedby="recipe-ingredient-2-error"'
    );
  });

  it("replaces the add action with the exact restrained cap copy at 50 rows", () => {
    const html = renderToStaticMarkup(
      <RecipeIngredientEditor
        options={OPTIONS}
        initialIngredients={ingredients(50)}
      />
    );

    expect(html.match(/name="ingredientItemId\d+"/g)).toHaveLength(50);
    expect(html).toContain("Maximum of 50 ingredients reached.");
    expect(html).not.toContain("+ Ingredient");
  });
});
