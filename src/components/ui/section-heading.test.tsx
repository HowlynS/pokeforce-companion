// Component tests for the shared public SectionHeading (Admin Full-Width
// Card Layout pass) — rendered to static HTML with react-dom/server, the
// same Node-only approach every other component test in this codebase
// uses. Replaces five identical copy-pasted local SectionHeading
// components (Item/Recipe/Profession/Category/Location detail pages).

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SectionHeading } from "@/components/ui/section-heading";
import { ScrollText } from "lucide-react";

describe("SectionHeading: semantic structure", () => {
  it("renders an <h2> as its own root element", () => {
    const html = renderToStaticMarkup(<SectionHeading>Recipes</SectionHeading>);
    expect(html.trim().startsWith("<h2")).toBe(true);
  });

  it("renders the heading text unchanged", () => {
    const html = renderToStaticMarkup(<SectionHeading>Produced by</SectionHeading>);
    expect(html).toContain("Produced by");
  });
});

describe("SectionHeading: optional icon (Option B — bare, no bubble)", () => {
  it("omits any icon markup when icon is not supplied", () => {
    const html = renderToStaticMarkup(<SectionHeading>Description</SectionHeading>);
    expect(html).not.toContain("admin-section-icon");
    expect(html).not.toContain("<svg");
  });

  it("renders a decorative, aria-hidden icon when icon is supplied", () => {
    const html = renderToStaticMarkup(
      <SectionHeading icon={ScrollText}>Recipes</SectionHeading>
    );
    expect(html).toContain('class="admin-section-icon"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("<svg");
  });

  it("never renders a bubble container (no border/background wrapper element)", () => {
    const html = renderToStaticMarkup(
      <SectionHeading icon={ScrollText}>Recipes</SectionHeading>
    );
    // Option B is bare-icon: exactly one decorative span, no nested
    // wrapper div/bubble element between the heading and the icon span.
    expect(html.match(/<span/g)).toHaveLength(1);
  });
});
