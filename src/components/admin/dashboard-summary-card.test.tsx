// Component test for DashboardSummaryCard (Slice 9G.1), added in Slice 9H
// alongside the component's own conversion from inline style objects to
// shared admin-dashboard-card* classes: proves the markup shape (one
// anchor, a real heading, count/unit/context text) and that no inline
// style attribute leaked back in. Rendered to static HTML with
// react-dom/server, matching the project's other editor-primitive tests.

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DashboardSummaryCard } from "@/components/admin/dashboard-summary-card";

describe("DashboardSummaryCard", () => {
  it("renders as a single anchor carrying the resource's canonical href", () => {
    const html = renderToStaticMarkup(
      <DashboardSummaryCard
        title="Items"
        href="/admin/items"
        count={16}
        unitLabel="items"
      />
    );

    expect(html.match(/<a /g)).toHaveLength(1);
    expect(html).toContain('href="/admin/items"');
    expect(html).toContain("admin-dashboard-card");
  });

  it("renders the title as a heading, plus the count and unit label", () => {
    const html = renderToStaticMarkup(
      <DashboardSummaryCard
        title="Recipes"
        href="/admin/recipes"
        count={0}
        unitLabel="recipes"
      />
    );

    expect(html).toMatch(/<h3[^>]*>Recipes<\/h3>/);
    // Zero is meaningful and must render, never be hidden.
    expect(html).toContain(">0<");
    expect(html).toContain("recipes");
  });

  it("renders supporting context only when supplied", () => {
    const withContext = renderToStaticMarkup(
      <DashboardSummaryCard
        title="Items"
        href="/admin/items"
        count={16}
        unitLabel="items"
        context="5 acquisition sources"
      />
    );
    expect(withContext).toContain("5 acquisition sources");

    const withoutContext = renderToStaticMarkup(
      <DashboardSummaryCard
        title="Professions"
        href="/admin/professions"
        count={10}
        unitLabel="professions"
      />
    );
    expect(withoutContext).not.toContain("admin-dashboard-card-context");
  });

  it("carries no inline style attribute (Slice 9H moved every rule to shared classes)", () => {
    const html = renderToStaticMarkup(
      <DashboardSummaryCard
        title="Locations"
        href="/admin/locations"
        count={3}
        unitLabel="locations"
        context="1 root location"
      />
    );

    expect(html).not.toContain("style=");
  });
});
