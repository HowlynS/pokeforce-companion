// Component test for DashboardSummaryCard (Slice 9G.1; restructured in
// Visual Pass II Section 8 into a linked summary plus an attached create
// action): proves the two-anchor shape (summary link to the resource's
// list/workspace, a separate full-width action link to its create route),
// a real heading, count/unit/context text, and that no inline style
// attribute leaked back in. Rendered to static HTML with react-dom/server,
// matching the project's other editor-primitive tests.

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DashboardSummaryCard } from "@/components/admin/dashboard-summary-card";

describe("DashboardSummaryCard", () => {
  it("renders exactly two anchors: the summary link and the attached create action", () => {
    const html = renderToStaticMarkup(
      <DashboardSummaryCard
        title="Items"
        href="/admin/items"
        count={16}
        unitLabel="items"
        createHref="/admin/items/new"
        createLabel="Create item"
      />
    );

    expect(html.match(/<a /g)).toHaveLength(2);
    expect(html).toContain('href="/admin/items"');
    expect(html).toContain('href="/admin/items/new"');
    expect(html).toContain("Create item");
    expect(html).toContain("admin-dashboard-card");
  });

  it("renders the title as a heading, plus the count and unit label", () => {
    const html = renderToStaticMarkup(
      <DashboardSummaryCard
        title="Recipes"
        href="/admin/recipes"
        count={0}
        unitLabel="recipes"
        createHref="/admin/recipes/new"
        createLabel="Create recipe"
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
        createHref="/admin/items/new"
        createLabel="Create item"
      />
    );
    expect(withContext).toContain("5 acquisition sources");

    const withoutContext = renderToStaticMarkup(
      <DashboardSummaryCard
        title="Professions"
        href="/admin/professions"
        count={10}
        unitLabel="professions"
        createHref="/admin/professions/new"
        createLabel="Create profession"
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
        createHref="/admin/locations/new"
        createLabel="Create location"
      />
    );

    expect(html).not.toContain("style=");
  });

  it("keeps the create action as a distinct anchor from the summary link", () => {
    const html = renderToStaticMarkup(
      <DashboardSummaryCard
        title="Categories"
        href="/admin/categories"
        count={5}
        unitLabel="categories"
        createHref="/admin/categories/new"
        createLabel="Create category"
      />
    );

    expect(html).toContain("admin-dashboard-card-summary");
    expect(html).toContain("admin-dashboard-card-action");
  });
});
