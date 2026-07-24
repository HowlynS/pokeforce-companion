// Structural component tests for RecipeImagePanel, rendered to static HTML
// with react-dom/server — the established Node-only approach (see
// image-panel.test.tsx). A static render proves the INITIAL wiring only:
// that RecipeImagePanel passes its own props straight through to the
// shared ImagePanel with the Recipe-specific copy attached. The live
// document-event-driven update when the Resulting Item selection changes
// needs a real DOM and is covered by e2e instead, exactly like ImagePanel's
// own live preview-swap behavior.

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RecipeImagePanel } from "@/components/admin/recipe-image-panel";

describe("RecipeImagePanel: initial render", () => {
  it("shows the inherited item image and its note when the recipe has no custom image", () => {
    const html = renderToStaticMarkup(
      <RecipeImagePanel
        imageUrl={null}
        formId="recipe-create-form"
        initialInheritedImageUrl="https://example.com/copper-ingot.png"
        inheritedImageAlt="Copper Ingot's resulting item image"
      />
    );
    expect(html).toContain('src="https://example.com/copper-ingot.png"');
    expect(html).toContain(
      "Using the resulting item&#x27;s image. Upload a Recipe image only to override it."
    );
  });

  it("shows the empty fallback when no Resulting Item is selected yet", () => {
    const html = renderToStaticMarkup(
      <RecipeImagePanel
        imageUrl={null}
        formId="recipe-create-form"
        initialInheritedImageUrl={null}
      />
    );
    expect(html).toContain("No image uploaded.");
    expect(html).not.toContain("Using the resulting item");
  });

  it("shows the recipe's own persisted image and the override note, ignoring the inherited fallback", () => {
    const html = renderToStaticMarkup(
      <RecipeImagePanel
        imageUrl="https://example.com/custom-recipe.png"
        imageAlt="Current image for Smelt Copper"
        formId="recipe-edit-form"
        initialInheritedImageUrl="https://example.com/copper-ingot.png"
      />
    );
    expect(html).toContain('src="https://example.com/custom-recipe.png"');
    expect(html).toContain("custom image override");
    expect(html).not.toContain('src="https://example.com/copper-ingot.png"');
  });
});
