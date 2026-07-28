import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RichDescriptionEditor } from "@/components/admin/rich-description-editor";

describe("RichDescriptionEditor", () => {
  it("renders one labelled form field with the approved toolbar controls", () => {
    const html = renderToStaticMarkup(
      <RichDescriptionEditor
        label="Description"
        fallbackText="Existing plain description"
      />
    );

    for (const label of [
      "Bold",
      "Italic",
      "Underline",
      "Section heading",
      "Subsection heading",
      "Bulleted list",
      "Link",
      "Undo",
      "Redo",
    ]) {
      expect(html).toContain(`aria-label="${label}"`);
    }
    expect(html).toContain('role="toolbar"');
    expect(html).toContain('name="descriptionRich"');
    expect(html).toContain("Existing plain description");
  });

  it("connects an inline validation error to the editable region", () => {
    const html = renderToStaticMarkup(
      <RichDescriptionEditor error="Enter a valid formatted description." />
    );

    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="');
    expect(html).toContain('role="alert"');
    expect(html).toContain("Enter a valid formatted description.");
  });

  it("does not expose unsupported authoring controls", () => {
    const html = renderToStaticMarkup(<RichDescriptionEditor />);

    expect(html).not.toContain('aria-label="Page heading"');
    expect(html).not.toContain('aria-label="Numbered list"');
    expect(html).not.toContain('aria-label="Image"');
    expect(html).not.toContain('aria-label="Text color"');
    expect(html).not.toContain('aria-label="Code block"');
  });
});
