import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WorldTree } from "@/components/content/world-tree";
import type { WorldLocationNode } from "@/lib/world/world-tree";

function node(
  id: string,
  name: string,
  depth: number,
  children: WorldLocationNode[] = [],
): WorldLocationNode {
  return {
    id,
    name,
    slug: id,
    type: "TOWN",
    parentId: depth === 0 ? null : "root",
    depth,
    children,
  };
}

const LEAF = node("market-street", "Market Street", 1);
const ROOT = node("goldenrod", "Goldenrod City", 0, [LEAF]);

function render(selectedId: string, expandedIds: string[]) {
  return renderToStaticMarkup(
    <WorldTree
      nodes={[ROOT]}
      selectedId={selectedId}
      expandedIds={expandedIds}
      query=""
    />,
  );
}

describe("WorldTree", () => {
  it("gives the row's whole hit area to real controls", () => {
    const html = render("goldenrod", ["goldenrod"]);

    // The disclosure is a real button and the label a real link; the row that
    // carries the highlight is an inert wrapper around exactly those two.
    expect(html).toContain('<button type="button" class="world-tree-toggle"');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('aria-label="Collapse Goldenrod City"');
    expect(html).toContain(
      '<a class="world-tree-label" aria-current="true" href="/world?location=goldenrod"',
    );
    // No <summary>/<details> disclosure remains to steal the row's clicks.
    expect(html).not.toContain("<summary");
    expect(html).not.toContain("<details");
  });

  it("marks a leaf row and gives it no disclosure control", () => {
    const html = render("market-street", ["goldenrod", "market-street"]);

    expect(html).toContain("world-tree-row--leaf");
    // One branch (the root) means exactly one toggle button.
    expect(html.match(/world-tree-toggle/g)).toHaveLength(1);
  });

  it("renders collapsed branch content instead of dropping it", () => {
    const html = render("goldenrod", []);

    // The branch stays mounted so its collapse can animate; CSS holds it at
    // 0fr and visibility:hidden rather than the markup removing it.
    expect(html).toContain("world-tree-branch");
    expect(html).not.toContain("world-tree-branch--open");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-label="Expand Goldenrod City"');
    expect(html).toContain("Market Street");
  });

  it("opens every branch on the selected Location's own path", () => {
    const html = render("market-street", ["goldenrod", "market-street"]);

    expect(html).toContain("world-tree-branch world-tree-branch--open");
    expect(html).toContain("world-tree-row--open");
  });

  it("preserves the filter query on every node link", () => {
    const html = renderToStaticMarkup(
      <WorldTree
        nodes={[ROOT]}
        selectedId="goldenrod"
        expandedIds={["goldenrod"]}
        query="market"
      />,
    );

    expect(html).toContain("href=\"/world?location=goldenrod&amp;q=market\"");
    expect(html).toContain("href=\"/world?location=market-street&amp;q=market\"");
  });
});
