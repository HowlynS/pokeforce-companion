// Component tests for the shared ResourceIcon (Admin Polish Pass 1),
// rendered to static HTML with react-dom/server — the established
// Node-only approach for this codebase's presentational components.

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ResourceIcon } from "@/components/admin/resource-icon";

describe("ResourceIcon: image rendering", () => {
  it("renders an <img> with the given src when imageUrl is present", () => {
    const html = renderToStaticMarkup(
      <ResourceIcon imageUrl="https://example.com/iron-ore.png" />
    );
    expect(html).toContain('src="https://example.com/iron-ore.png"');
    expect(html).toContain("resource-icon-img");
  });

  it("defaults to an empty (decorative) alt attribute", () => {
    const html = renderToStaticMarkup(
      <ResourceIcon imageUrl="https://example.com/iron-ore.png" />
    );
    expect(html).toContain('alt=""');
  });

  it("accepts a meaningful alt when the image is the only representation", () => {
    const html = renderToStaticMarkup(
      <ResourceIcon imageUrl="https://example.com/iron-ore.png" alt="Iron Ore" />
    );
    expect(html).toContain('alt="Iron Ore"');
  });
});

describe("ResourceIcon: fallback rendering", () => {
  it("renders the fixed slot with no <img> when imageUrl is null", () => {
    const html = renderToStaticMarkup(<ResourceIcon imageUrl={null} />);
    expect(html).not.toContain("<img");
    expect(html).toContain("resource-icon-empty");
  });

  it("renders the fixed slot with no <img> when imageUrl is undefined", () => {
    const html = renderToStaticMarkup(<ResourceIcon />);
    expect(html).not.toContain("<img");
    expect(html).toContain("resource-icon-empty");
  });

  it("hides the empty slot from assistive technology", () => {
    const html = renderToStaticMarkup(<ResourceIcon imageUrl={null} />);
    expect(html).toContain('aria-hidden="true"');
  });

  it("never marks a populated icon as aria-hidden on the wrapper", () => {
    const html = renderToStaticMarkup(
      <ResourceIcon imageUrl="https://example.com/iron-ore.png" />
    );
    expect(html).not.toContain('aria-hidden="true"');
  });
});

describe("ResourceIcon: sizing variants", () => {
  it("defaults to the compact (sm) size", () => {
    const html = renderToStaticMarkup(
      <ResourceIcon imageUrl="https://example.com/iron-ore.png" />
    );
    expect(html).toContain("resource-icon-sm");
    expect(html).not.toContain("resource-icon-md");
  });

  it("supports the larger (md) size for tables/lists", () => {
    const html = renderToStaticMarkup(
      <ResourceIcon imageUrl="https://example.com/iron-ore.png" size="md" />
    );
    expect(html).toContain("resource-icon-md");
    expect(html).not.toContain("resource-icon-sm");
  });
});

describe("ResourceIcon: composition", () => {
  it("merges a caller-supplied className alongside the base classes", () => {
    const html = renderToStaticMarkup(
      <ResourceIcon imageUrl={null} className="my-extra-class" />
    );
    expect(html).toContain("my-extra-class");
    expect(html).toContain("resource-icon");
  });
});
