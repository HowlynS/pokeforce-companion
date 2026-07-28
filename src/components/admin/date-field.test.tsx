import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DateField } from "@/components/admin/date-field";

describe("DateField closed state", () => {
  it("shows a persisted date as DD MMM YYYY and submits unchanged ISO", () => {
    const html = renderToStaticMarkup(
      <DateField
        name="releaseDate"
        label="Release date (optional)"
        defaultValue="2026-09-05"
      />
    );

    expect(html).toMatch(/<input [^>]*value="05 Sep 2026"/);
    expect(html).toMatch(
      /<input type="hidden" name="releaseDate" value="2026-09-05"/
    );
  });

  it("keeps an optional date blank when no value exists", () => {
    const html = renderToStaticMarkup(
      <DateField
        name="releaseDate"
        label="Release date (optional)"
        defaultValue={null}
      />
    );

    expect(html).toMatch(/<input [^>]*value=""/);
    expect(html).toMatch(/<input type="hidden" name="releaseDate" value=""/);
  });

  it("uses the caller-supplied field name", () => {
    const html = renderToStaticMarkup(
      <DateField name="availableOn" label="Available on" />
    );

    expect(html).toContain('name="availableOn"');
    expect(html).not.toContain('name="releaseDate"');
  });
});

describe("DateField accessibility and calendar trigger", () => {
  it("renders a labelled readonly field and a dialog trigger", () => {
    const html = renderToStaticMarkup(
      <DateField name="releaseDate" label="Release date (optional)" />
    );

    expect(html).toContain("Release date (optional)");
    expect(html).toContain('readOnly=""');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-label="Choose release date"');
    expect(html).toContain("Display format: DD MMM YYYY.");
  });

  it("supports a field-specific trigger name", () => {
    const html = renderToStaticMarkup(
      <DateField
        name="releaseDate"
        label="Release date (optional)"
        triggerLabel="Choose version release date"
      />
    );

    expect(html).toContain('aria-label="Choose version release date"');
  });

  it("does not expose a native browser date input", () => {
    const html = renderToStaticMarkup(
      <DateField name="releaseDate" label="Release date (optional)" />
    );

    expect(html).not.toContain('type="date"');
  });
});
