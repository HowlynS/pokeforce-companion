// Component tests for the shared AutosizeTextarea (Admin Visual/UX
// Correction pass, follow-up #2), rendered to static HTML with
// react-dom/server — the established Node-only component-test approach
// this codebase already uses (see RecordSlugField, DateField). A static
// render never runs effects, so the actual resize behavior (measuring
// scrollHeight, growing/shrinking on change, the max-height cap and its
// overflow switch) is real-browser territory, covered instead by
// e2e/admin-autosize-textarea.spec.ts — matching the same split this
// codebase already uses for RecordSlugField's own interactive behavior.
// What IS fully verifiable from a single static render: every prop is
// forwarded to the underlying <textarea> unchanged (name, defaultValue,
// required, aria-*, ...), the shared class is always applied alongside
// any caller-supplied className, and the component introduces no value
// transformation or extra markup that could change what a form actually
// submits.

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AutosizeTextarea } from "@/components/admin/autosize-textarea";

describe("AutosizeTextarea: renders a plain, uncontrolled textarea", () => {
  it("renders exactly one textarea element", () => {
    const html = renderToStaticMarkup(<AutosizeTextarea name="description" />);
    expect(html.match(/<textarea/g)).toHaveLength(1);
  });

  it("forwards the name attribute unchanged, for correct form submission", () => {
    const html = renderToStaticMarkup(<AutosizeTextarea name="notes" />);
    expect(html).toContain('name="notes"');
  });

  it("forwards defaultValue unchanged, with no value transformation", () => {
    const html = renderToStaticMarkup(
      <AutosizeTextarea name="description" defaultValue="Some persisted text." />
    );
    expect(html).toContain("Some persisted text.");
  });

  it("preserves a blank/undefined defaultValue as a genuinely empty field", () => {
    const html = renderToStaticMarkup(<AutosizeTextarea name="description" />);
    expect(html).toMatch(/<textarea[^>]*name="description"[^>]*><\/textarea>/);
  });

  it("forwards arbitrary passthrough props (required, aria-describedby, rows) unchanged", () => {
    const html = renderToStaticMarkup(
      <AutosizeTextarea
        name="description"
        required
        aria-describedby="description-helper"
        rows={6}
      />
    );
    expect(html).toContain("required=\"\"");
    expect(html).toContain('aria-describedby="description-helper"');
    expect(html).toContain('rows="6"');
  });
});

describe("AutosizeTextarea: shared class application", () => {
  it("always applies the shared admin-autosize-textarea class", () => {
    const html = renderToStaticMarkup(<AutosizeTextarea name="description" />);
    expect(html).toMatch(/class="admin-autosize-textarea"/);
  });

  it("combines the shared class with a caller-supplied className, never replacing it", () => {
    const html = renderToStaticMarkup(
      <AutosizeTextarea name="description" className="form-input" />
    );
    expect(html).toMatch(/class="admin-autosize-textarea form-input"/);
  });
});

describe("AutosizeTextarea: no unrelated markup or attributes introduced", () => {
  it("renders no wrapper element around the textarea itself", () => {
    const html = renderToStaticMarkup(
      <AutosizeTextarea name="description" defaultValue="x" />
    );
    // The component's own root output IS the <textarea> — no enclosing
    // <div> or other wrapper that would change surrounding form-field
    // layout.
    expect(html.trim().startsWith("<textarea")).toBe(true);
  });

  it("never renders a manual resize handle style inline (resize is governed by the shared CSS class, not an inline override)", () => {
    const html = renderToStaticMarkup(<AutosizeTextarea name="description" />);
    expect(html).not.toContain("style=");
  });
});
