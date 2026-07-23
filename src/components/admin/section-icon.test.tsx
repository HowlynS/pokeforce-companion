// Component tests for the shared SectionIcon bubble (Admin Editor
// Section Redesign pass), rendered to static HTML with react-dom/server
// — the established Node-only component-test approach this codebase
// already uses. A static render fully covers this component: it has no
// interactive behavior at all, purely structural/decorative markup.

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SectionIcon } from "@/components/admin/section-icon";
import { IdCard, ShieldCheck } from "lucide-react";

describe("SectionIcon: decorative, never independently focusable", () => {
  it("renders the wrapping bubble as aria-hidden", () => {
    const html = renderToStaticMarkup(<SectionIcon icon={IdCard} />);
    expect(html).toMatch(/<span aria-hidden="true"/);
  });

  it("renders as a plain <span>, never a <button> or <a>", () => {
    const html = renderToStaticMarkup(<SectionIcon icon={IdCard} />);
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("tabindex");
    expect(html).not.toContain("role=\"button\"");
  });

  it("carries no title attribute needing a separate tooltip", () => {
    const html = renderToStaticMarkup(<SectionIcon icon={IdCard} />);
    expect(html).not.toContain("title=");
  });
});

describe("SectionIcon: default vs compact bubble", () => {
  it("applies the default bubble class only, by default", () => {
    const html = renderToStaticMarkup(<SectionIcon icon={IdCard} />);
    expect(html).toContain('class="admin-section-icon"');
    expect(html).not.toContain("admin-section-icon-compact");
  });

  it("applies the compact modifier class alongside the base class", () => {
    const html = renderToStaticMarkup(<SectionIcon icon={IdCard} compact />);
    expect(html).toContain(
      'class="admin-section-icon admin-section-icon-compact"'
    );
  });
});

describe("SectionIcon: renders the given icon", () => {
  it("renders an <svg> for the supplied icon", () => {
    const html = renderToStaticMarkup(<SectionIcon icon={ShieldCheck} />);
    expect(html).toContain("<svg");
  });

  it("renders different markup for different icons (no hardcoded single icon)", () => {
    const idCardHtml = renderToStaticMarkup(<SectionIcon icon={IdCard} />);
    const shieldHtml = renderToStaticMarkup(<SectionIcon icon={ShieldCheck} />);
    expect(idCardHtml).not.toBe(shieldHtml);
  });
});
