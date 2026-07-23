// Component tests for the shared InfoTooltip (Opus Pass 1), rendered to
// static HTML with react-dom/server — the established Node-only
// component-test approach this codebase uses (see AutosizeTextarea,
// RecordSlugField, DateField). A static render never runs effects or
// dispatches events, so the INTERACTIVE behavior (open on hover/focus/
// click, close on Escape/blur/outside-pointerdown, one-open-at-a-time,
// and listener cleanup) is real-browser territory, covered instead by
// e2e/admin-recipe-quantity-help.spec.ts — matching the same split
// AutosizeTextarea and RecordSlugField already use for their own
// interactive behavior.
//
// What IS fully verifiable from a single static render: the trigger is a
// real <button> carrying the correct accessible name, the tooltip content
// is present with the exact copy but starts hidden (so neither visible
// nor announced), the trigger references that content via aria-describedby
// (a stable useId, matching the rendered id), the visible icon is
// decorative (aria-hidden, not separately announced), and two instances
// receive distinct ids so adjacent tooltips never collide.

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { InfoTooltip } from "@/components/admin/info-tooltip";

const MIN_LABEL = "More information about Minimum quantity";
const MIN_COPY = "The smallest number of items this recipe can produce.";

describe("InfoTooltip: accessible trigger", () => {
  it("renders the trigger as a real button (not a div)", () => {
    const html = renderToStaticMarkup(
      <InfoTooltip label={MIN_LABEL} content={MIN_COPY} />
    );
    expect(html).toMatch(/<button[^>]*type="button"/);
  });

  it("gives the trigger the supplied accessible name via aria-label", () => {
    const html = renderToStaticMarkup(
      <InfoTooltip label={MIN_LABEL} content={MIN_COPY} />
    );
    expect(html).toContain(`aria-label="${MIN_LABEL}"`);
  });

  it("marks the visible icon decorative so it is not separately announced", () => {
    const html = renderToStaticMarkup(
      <InfoTooltip label={MIN_LABEL} content={MIN_COPY} />
    );
    // The only <svg> is the Lucide info glyph; it must be aria-hidden.
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"/);
  });

  it("does not mark the trigger open in its initial (closed) state", () => {
    const html = renderToStaticMarkup(
      <InfoTooltip label={MIN_LABEL} content={MIN_COPY} />
    );
    expect(html).not.toContain('data-open="true"');
  });
});

describe("InfoTooltip: tooltip content and relationship", () => {
  it("renders the exact copy inside a role=tooltip element", () => {
    const html = renderToStaticMarkup(
      <InfoTooltip label={MIN_LABEL} content={MIN_COPY} />
    );
    expect(html).toContain('role="tooltip"');
    expect(html).toContain(MIN_COPY);
  });

  it("keeps the tooltip content hidden initially (not visible, not announced)", () => {
    const html = renderToStaticMarkup(
      <InfoTooltip label={MIN_LABEL} content={MIN_COPY} />
    );
    // The role=tooltip element carries the boolean `hidden` attribute.
    expect(html).toMatch(/role="tooltip"[^>]*hidden|hidden[^>]*role="tooltip"/);
  });

  it("references the tooltip content from the trigger via aria-describedby, matching the content's own id", () => {
    const html = renderToStaticMarkup(
      <InfoTooltip label={MIN_LABEL} content={MIN_COPY} />
    );
    const describedBy = html.match(/aria-describedby="([^"]+)"/);
    expect(describedBy).not.toBeNull();
    const contentId = describedBy![1];
    // The same id is the tooltip content element's own id.
    expect(html).toContain(`id="${contentId}"`);
  });
});

describe("InfoTooltip: multiple instances", () => {
  it("gives two adjacent instances distinct describedby ids (rendered in one tree, as they are on the page) so their tooltips never collide", () => {
    // Rendered in a SINGLE tree — the way both quantity tooltips actually
    // render on the Recipe editor. useId only differentiates instances
    // within one render root, which is exactly the real-page condition.
    const html = renderToStaticMarkup(
      <>
        <InfoTooltip label={MIN_LABEL} content={MIN_COPY} />
        <InfoTooltip
          label="More information about Maximum quantity"
          content="The largest number of items this recipe can produce."
        />
      </>
    );
    const ids = [...html.matchAll(/aria-describedby="([^"]+)"/g)].map(
      (match) => match[1]
    );
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toEqual(ids[1]);
  });
});
