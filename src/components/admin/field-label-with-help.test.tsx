// Component tests for the shared FieldLabelWithHelp row (Opus Pass 1),
// rendered to static HTML with react-dom/server — the same Node-only
// approach the other admin component tests use. What a static render
// fully proves: the visible text renders inside a real <label> explicitly
// associated with the field (htmlFor), the info trigger renders alongside
// it carrying the supplied accessible name and the exact help copy, and —
// importantly — the trigger <button> is a SIBLING of the <label>, never
// nested inside it (nesting would make clicking the icon also focus the
// field). The tooltip's own interactive behavior is covered by
// e2e/admin-recipe-quantity-help.spec.ts.

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FieldLabelWithHelp } from "@/components/admin/field-label-with-help";

const COPY = "The smallest number of items this recipe can produce.";

function render() {
  return renderToStaticMarkup(
    <FieldLabelWithHelp
      htmlFor="recipe-result-quantity-min"
      helpLabel="More information about Minimum quantity"
      helpContent={COPY}
    >
      Minimum quantity
    </FieldLabelWithHelp>
  );
}

describe("FieldLabelWithHelp: label association", () => {
  it("renders the visible text inside a <label> tied to the field via htmlFor", () => {
    const html = render();
    expect(html).toMatch(
      /<label[^>]*for="recipe-result-quantity-min"[^>]*>Minimum quantity<\/label>/
    );
  });
});

describe("FieldLabelWithHelp: info trigger", () => {
  it("renders the info trigger with the supplied accessible name", () => {
    const html = render();
    expect(html).toContain(
      'aria-label="More information about Minimum quantity"'
    );
  });

  it("carries the exact help copy in the tooltip content", () => {
    const html = render();
    expect(html).toContain(COPY);
  });

  it("renders the trigger button as a SIBLING of the label, never nested inside it", () => {
    const html = render();
    // The label closes before the button opens — proving the button is not
    // a descendant of the <label> (which would hijack clicks on the icon
    // into focusing the field).
    const labelEnd = html.indexOf("</label>");
    const buttonStart = html.indexOf("<button");
    expect(labelEnd).toBeGreaterThan(-1);
    expect(buttonStart).toBeGreaterThan(labelEnd);
  });
});
