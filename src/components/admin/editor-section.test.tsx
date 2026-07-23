// Component tests for the shared EditorSection card (Admin Editor
// Section Redesign pass), rendered to static HTML with react-dom/server
// — the established Node-only component-test approach this codebase
// already uses (see RecordSlugField, DateField, ContextPanel). A static
// render fully covers this component: title, icon, description,
// heading level, className, id, and children are all derived from props
// alone, with no interactive behavior.

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EditorSection } from "@/components/admin/editor-section";
import { IdCard } from "lucide-react";

describe("EditorSection: structure", () => {
  it("renders a <section> as its own root element", () => {
    const html = renderToStaticMarkup(
      <EditorSection title="Identity" icon={IdCard}>
        <p>Field content</p>
      </EditorSection>
    );
    expect(html.trim().startsWith("<section")).toBe(true);
  });

  it("applies the shared admin-editor-section class", () => {
    const html = renderToStaticMarkup(
      <EditorSection title="Identity" icon={IdCard}>
        <p>x</p>
      </EditorSection>
    );
    expect(html).toMatch(/class="admin-editor-section"/);
  });

  it("combines a caller-supplied className with the base class, never replacing it", () => {
    const html = renderToStaticMarkup(
      <EditorSection
        title="Identity"
        icon={IdCard}
        className="admin-editor-section--full"
      >
        <p>x</p>
      </EditorSection>
    );
    expect(html).toMatch(
      /class="admin-editor-section admin-editor-section--full"/
    );
  });

  it("renders children inside the section body", () => {
    const html = renderToStaticMarkup(
      <EditorSection title="Identity" icon={IdCard}>
        <input name="name" />
      </EditorSection>
    );
    expect(html).toContain('<div class="admin-editor-section-body">');
    expect(html).toContain('name="name"');
  });
});

describe("EditorSection: heading", () => {
  it("renders the title as an h2 by default", () => {
    const html = renderToStaticMarkup(
      <EditorSection title="Classification" icon={IdCard}>
        <p>x</p>
      </EditorSection>
    );
    expect(html).toMatch(/<h2 class="admin-editor-section-title">Classification<\/h2>/);
  });

  it("renders the title as an h3 when headingLevel is overridden", () => {
    const html = renderToStaticMarkup(
      <EditorSection title="Classification" icon={IdCard} headingLevel="h3">
        <p>x</p>
      </EditorSection>
    );
    expect(html).toMatch(/<h3 class="admin-editor-section-title">Classification<\/h3>/);
    expect(html).not.toContain("<h2");
  });

  it("renders the icon bubble beside the title", () => {
    const html = renderToStaticMarkup(
      <EditorSection title="Identity" icon={IdCard}>
        <p>x</p>
      </EditorSection>
    );
    expect(html).toContain('<div class="admin-editor-section-heading">');
    expect(html).toContain('class="admin-section-icon"');
  });

  it("omits the description paragraph when not supplied", () => {
    const html = renderToStaticMarkup(
      <EditorSection title="Identity" icon={IdCard}>
        <p>x</p>
      </EditorSection>
    );
    expect(html).not.toContain("admin-editor-section-description");
  });

  it("renders the description paragraph when supplied", () => {
    const html = renderToStaticMarkup(
      <EditorSection title="Recipes" icon={IdCard} description="2 recipes">
        <p>x</p>
      </EditorSection>
    );
    expect(html).toContain(
      '<p class="admin-editor-section-description">2 recipes</p>'
    );
  });
});

describe("EditorSection: optional id (anchor targets)", () => {
  it("omits the id attribute when not supplied", () => {
    const html = renderToStaticMarkup(
      <EditorSection title="Identity" icon={IdCard}>
        <p>x</p>
      </EditorSection>
    );
    expect(html).not.toContain("id=");
  });

  it("renders the given id on the section root", () => {
    const html = renderToStaticMarkup(
      <EditorSection title="Create Game Version" icon={IdCard} id="create-game-version">
        <p>x</p>
      </EditorSection>
    );
    expect(html).toMatch(/<section id="create-game-version"/);
  });
});

describe("EditorSection: no duplicated content", () => {
  it("renders exactly one heading and one icon bubble per section", () => {
    const html = renderToStaticMarkup(
      <EditorSection title="Identity" icon={IdCard}>
        <p>x</p>
      </EditorSection>
    );
    expect(html.match(/<h2/g)).toHaveLength(1);
    expect(html.match(/admin-section-icon"/g)).toHaveLength(1);
  });

  it("never renders the title text more than once", () => {
    const html = renderToStaticMarkup(
      <EditorSection title="Identity" icon={IdCard}>
        <p>Some other text</p>
      </EditorSection>
    );
    expect(html.match(/Identity/g)).toHaveLength(1);
  });
});
