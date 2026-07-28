import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PageHeader } from "@/components/layout/page-header";

describe("PageHeader authored description content", () => {
  it("renders structured description content in preference to the plain fallback", () => {
    const html = renderToStaticMarkup(
      <PageHeader
        title="Test resource"
        description="Legacy fallback"
        descriptionContent={
          <div className="rich-text-content">
            <h2>Structured section</h2>
            <p>Formatted copy.</p>
          </div>
        }
      />
    );

    expect(html).toContain("<h2>Structured section</h2>");
    expect(html).toContain("<p>Formatted copy.</p>");
    expect(html).not.toContain("Legacy fallback");
  });

  it("preserves the existing plain-description behavior", () => {
    const html = renderToStaticMarkup(
      <PageHeader title="Test resource" description="Legacy fallback" />
    );

    expect(html).toContain("<p");
    expect(html).toContain("Legacy fallback");
  });
});
