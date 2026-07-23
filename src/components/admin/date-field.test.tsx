// Component tests for the shared DateField (Admin Visual/UX Correction
// pass, Part 10), rendered to static HTML with react-dom/server — the
// established Node-only component-test approach this codebase already
// uses for RecordSlugField. A static render never runs effects, so this
// covers everything derivable from props alone: the visible DD MMM YYYY
// text, the submitted hidden ISO value, blank/optional behavior, and
// label/accessibility structure. Genuinely interactive typing/blur
// behavior is E2E territory, matching the RecordSlugField precedent.

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DateField } from "@/components/admin/date-field";

describe("DateField: visible DD MMM YYYY formatting from a persisted ISO value", () => {
  it("shows the persisted date as DD MMM YYYY", () => {
    const html = renderToStaticMarkup(
      <DateField name="releaseDate" label="Release date (optional)" defaultValue="2026-09-05" />
    );

    expect(html).toMatch(/<input [^>]*value="05 Sep 2026"/);
  });

  it("shows a blank field when there is no persisted value", () => {
    const html = renderToStaticMarkup(
      <DateField name="releaseDate" label="Release date (optional)" defaultValue={null} />
    );

    expect(html).toMatch(/<input [^>]*value=""/);
  });

  it("shows a blank field when defaultValue is omitted entirely", () => {
    const html = renderToStaticMarkup(
      <DateField name="releaseDate" label="Release date (optional)" />
    );

    expect(html).toMatch(/<input [^>]*value=""/);
  });
});

describe("DateField: hidden submitted value stays normalized ISO", () => {
  it("submits the normalized ISO value in a hidden field with the given name", () => {
    const html = renderToStaticMarkup(
      <DateField name="releaseDate" label="Release date (optional)" defaultValue="2026-09-05" />
    );

    expect(html).toMatch(
      /<input type="hidden" name="releaseDate" value="2026-09-05"/
    );
  });

  it("submits an empty hidden value for a blank optional field", () => {
    const html = renderToStaticMarkup(
      <DateField name="releaseDate" label="Release date (optional)" defaultValue={null} />
    );

    expect(html).toMatch(/<input type="hidden" name="releaseDate" value=""/);
  });

  it("uses the caller-supplied field name for the hidden input", () => {
    const html = renderToStaticMarkup(
      <DateField name="verifiedAt" label="Some other date" defaultValue={null} />
    );

    expect(html).toContain('name="verifiedAt"');
    expect(html).not.toContain('name="releaseDate"');
  });
});

describe("DateField: structure and accessibility", () => {
  it("associates the label with the visible input via nesting (no separate id/for pair)", () => {
    const html = renderToStaticMarkup(
      <DateField name="releaseDate" label="Release date (optional)" />
    );

    expect(html).toMatch(
      /<label class="form-field"><span class="form-field-label">Release date \(optional\)<\/span><input [^>]*id="[^"]+"/
    );
  });

  it("renders format guidance text", () => {
    const html = renderToStaticMarkup(
      <DateField name="releaseDate" label="Release date (optional)" />
    );

    expect(html).toContain("DD MMM YYYY");
    expect(html).toContain("05 Sep 2026");
  });

  it("renders no error message before the field has been touched, even with no value", () => {
    const html = renderToStaticMarkup(
      <DateField name="releaseDate" label="Release date (optional)" />
    );

    expect(html).not.toContain("role=\"alert\"");
  });

  it("has no locale-dependent native date input anywhere in its markup", () => {
    const html = renderToStaticMarkup(
      <DateField name="releaseDate" label="Release date (optional)" />
    );

    expect(html).not.toContain('type="date"');
  });
});
