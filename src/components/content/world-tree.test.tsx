import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WorldSidebar } from "@/components/content/world-tree";
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

const VAULT = node("archive-vault", "Archive Vault", 2);
const STOCKROOM = node("stockroom", "Stockroom", 1, [VAULT]);
const MARKET = node("market-street", "Market Street", 1);
const ROOT = node("goldenrod", "Goldenrod City", 0, [MARKET, STOCKROOM]);

function render(
  selectedId: string,
  expandedIds: string[],
  initialQuery = "",
) {
  return renderToStaticMarkup(
    <WorldSidebar
      nodes={[ROOT]}
      selectedId={selectedId}
      selectedSlug={selectedId}
      expandedIds={expandedIds}
      initialQuery={initialQuery}
    />,
  );
}

describe("WorldSidebar", () => {
  it("gives the row's whole hit area to real controls", () => {
    const html = render("goldenrod", ["goldenrod"]);

    // The disclosure is a real button and the label a real link; the row that
    // carries the highlight is an inert wrapper around exactly those two.
    expect(html).toContain('<button type="button" class="world-tree-toggle"');
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
    // Two branches (the root and the Stockroom) means exactly two toggles.
    expect(html.match(/world-tree-toggle/g)).toHaveLength(2);
  });

  it("renders collapsed branch content instead of dropping it", () => {
    const html = render("goldenrod", []);

    // The branch stays mounted so its collapse can animate; CSS holds it at
    // 0fr and visibility:hidden rather than the markup removing it.
    expect(html).toContain("world-tree-branch");
    expect(html).not.toContain("world-tree-branch--open");
    expect(html).toContain('aria-label="Expand Goldenrod City"');
    expect(html).toContain("Market Street");
  });

  it("opens every branch on the selected Location's own path", () => {
    const html = render("market-street", ["goldenrod", "market-street"]);

    expect(html).toContain("world-tree-branch world-tree-branch--open");
    expect(html).toContain("world-tree-row--open");
  });

  it("renders the live filter field seeded from the URL", () => {
    const html = render("goldenrod", ["goldenrod"], "vault");

    expect(html).toContain('aria-label="Filter locations"');
    expect(html).toContain('value="vault"');
  });

  it("applies the initial query before hydration, keeping the ancestor chain", () => {
    const html = render("goldenrod", ["goldenrod"], "vault");

    // A deep match is shown in context: the whole containment chain survives…
    expect(html).toContain("Goldenrod City");
    expect(html).toContain("Stockroom");
    expect(html).toContain("Archive Vault");
    // …while an unrelated sibling branch disappears entirely.
    expect(html).not.toContain("Market Street");
    // Both ancestor branches are revealed so the match is actually visible.
    expect(html.match(/world-tree-branch--open/g)).toHaveLength(2);
  });

  it("shows a live clear control when nothing matches", () => {
    const html = render("goldenrod", ["goldenrod"], "no-such-place");

    expect(html).toContain("world-sidebar-empty");
    expect(html).toContain("Clear the filter");
    // Clearing is client state, not a navigation back to an unfiltered URL.
    expect(html).toContain('class="world-sidebar-clear"');
  });

  it("preserves the filter query on every node link", () => {
    const html = render("goldenrod", ["goldenrod"], "street");

    expect(html).toContain(
      'href="/world?location=market-street&amp;q=street"',
    );
  });
});
