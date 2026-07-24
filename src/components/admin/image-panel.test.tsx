// Structural component tests for ImagePanel, rendered to static HTML with
// react-dom/server — the established Node-only approach. A static render
// proves the INITIAL shape only (useEffect never runs during SSR, so the
// live preview-swap/revoke behavior added in Admin Polish Pass 1 needs a
// real DOM and is covered by e2e/admin-image-preview.spec.ts instead).

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ImagePanel } from "@/components/admin/image-panel";

describe("ImagePanel: initial render with a persisted image", () => {
  it("shows the persisted image and the remove checkbox/trash button", () => {
    const html = renderToStaticMarkup(
      <ImagePanel
        imageUrl="https://example.com/iron-ore.png"
        imageAlt="Current image for Iron Ore"
        formId="item-edit-form"
      />
    );
    expect(html).toContain('src="https://example.com/iron-ore.png"');
    expect(html).toContain('alt="Current image for Iron Ore"');
    expect(html).toContain("admin-image-preview-lg");
    expect(html).toContain('name="removeImage"');
    expect(html).toContain("Change Image");
    expect(html).toContain("Remove image");
    expect(html).not.toContain("No image uploaded.");
  });
});

describe("ImagePanel: initial render with no image", () => {
  it("shows the empty placeholder and no remove control", () => {
    const html = renderToStaticMarkup(
      <ImagePanel imageUrl={null} formId="item-create-form" />
    );
    expect(html).not.toContain("<img");
    expect(html).toContain("No image uploaded.");
    expect(html).toContain("Choose Image");
    expect(html).not.toContain('name="removeImage"');
    expect(html).not.toContain("Remove image");
  });
});

describe("ImagePanel: inherited image (Recipe Image Inheritance follow-up)", () => {
  it("shows the inherited image and note when the record has no image of its own", () => {
    const html = renderToStaticMarkup(
      <ImagePanel
        imageUrl={null}
        formId="recipe-create-form"
        inheritedImageUrl="https://example.com/copper-ingot.png"
        inheritedImageAlt="Copper Ingot's resulting item image"
        inheritedNote="Using the resulting item's image. Upload a Recipe image only to override it."
        overrideNote="This Recipe uses a custom image override. Removing it will restore the resulting item's image."
      />
    );
    expect(html).toContain('src="https://example.com/copper-ingot.png"');
    expect(html).toContain('alt="Copper Ingot&#x27;s resulting item image"');
    expect(html).toContain(
      "Using the resulting item&#x27;s image. Upload a Recipe image only to override it."
    );
    expect(html).not.toContain("custom image override");
    expect(html).not.toContain("No image uploaded.");
    // No persisted image, so no remove checkbox — matching the plain
    // no-image case exactly.
    expect(html).not.toContain('name="removeImage"');
  });

  it("shows the record's own persisted image and the override note when both exist", () => {
    const html = renderToStaticMarkup(
      <ImagePanel
        imageUrl="https://example.com/custom-recipe.png"
        imageAlt="Current image for Smelt Copper"
        formId="recipe-edit-form"
        inheritedImageUrl="https://example.com/copper-ingot.png"
        inheritedNote="Using the resulting item's image. Upload a Recipe image only to override it."
        overrideNote="This Recipe uses a custom image override. Removing it will restore the resulting item's image."
      />
    );
    expect(html).toContain('src="https://example.com/custom-recipe.png"');
    expect(html).toContain('alt="Current image for Smelt Copper"');
    expect(html).toContain("custom image override");
    expect(html).not.toContain("Upload a Recipe image only to override it.");
  });

  it("shows the plain empty fallback, with no inheritance note, when neither image exists", () => {
    const html = renderToStaticMarkup(
      <ImagePanel
        imageUrl={null}
        formId="recipe-create-form"
        inheritedImageUrl={null}
        inheritedNote="Using the resulting item's image. Upload a Recipe image only to override it."
        overrideNote="This Recipe uses a custom image override. Removing it will restore the resulting item's image."
      />
    );
    expect(html).toContain("No image uploaded.");
    expect(html).not.toContain("admin-image-inherit-note");
  });

  it("leaves every non-Recipe caller's behavior unchanged when inheritedImageUrl is omitted", () => {
    const html = renderToStaticMarkup(
      <ImagePanel
        imageUrl={null}
        formId="item-create-form"
        inheritedNote="This text must never render for Items."
      />
    );
    expect(html).toContain("No image uploaded.");
    expect(html).not.toContain("This text must never render for Items.");
    expect(html).not.toContain("admin-image-inherit-note");
  });
});

describe("ImagePanel: the file input", () => {
  it("associates with the given form and carries the given field name", () => {
    const html = renderToStaticMarkup(
      <ImagePanel imageUrl={null} formId="recipe-create-form" fieldName="image" />
    );
    expect(html).toMatch(/<input[^>]*type="file"[^>]*form="recipe-create-form"/);
    expect(html).toMatch(/<input[^>]*type="file"[^>]*name="image"/);
    expect(html).toMatch(/<input[^>]*type="file"[^>]*accept="image\/png,image\/jpeg,image\/webp"/);
  });

  it("is excluded from the tab order (the visible Choose/Change button is the real trigger)", () => {
    const html = renderToStaticMarkup(
      <ImagePanel imageUrl={null} formId="item-create-form" />
    );
    expect(html).toMatch(/<input[^>]*type="file"[^>]*tabindex="-1"/);
  });
});
