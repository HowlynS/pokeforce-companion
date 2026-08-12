import { describe, expect, it } from "vitest";
import {
  buildWorldTree,
  filterWorldTree,
  findWorldPath,
  flattenWorldTree,
  selectWorldLocation,
  type WorldLocationRecord,
} from "@/lib/world/world-tree";

function record(
  id: string,
  name: string,
  parentId: string | null = null,
): WorldLocationRecord {
  return { id, name, slug: id, type: "REGION", parentId };
}

const REGION = record("johto", "Johto");
const ROUTE = record("route-29", "Route 29", "johto");
const HOUSE = record("house", "Mr Pokemon House", "route-29");
const CITY = record("cherrygrove", "Cherrygrove City", "johto");
const OTHER = record("kanto", "Kanto");

describe("buildWorldTree", () => {
  it("nests real parent/child containment root-first and alphabetically", () => {
    const tree = buildWorldTree([HOUSE, OTHER, ROUTE, CITY, REGION]);

    expect(tree.map((node) => node.name)).toEqual(["Johto", "Kanto"]);
    expect(tree[0].children.map((node) => node.name)).toEqual([
      "Cherrygrove City",
      "Route 29",
    ]);
    expect(tree[0].children[1].children.map((node) => node.name)).toEqual([
      "Mr Pokemon House",
    ]);
    expect(tree[0].depth).toBe(0);
    expect(tree[0].children[1].children[0].depth).toBe(2);
  });

  it("treats a location whose parent is absent from the set as a root", () => {
    const orphan = record("orphan", "Orphan", "missing-parent");
    const tree = buildWorldTree([REGION, orphan]);

    expect(tree.map((node) => node.name)).toEqual(["Johto", "Orphan"]);
  });

  it("does not loop or duplicate when records form a cycle", () => {
    const a = record("a", "A", "b");
    const b = record("b", "B", "a");

    const tree = buildWorldTree([a, b]);

    // Neither is a root by parentId, so the cycle yields no roots rather than
    // recursing forever.
    expect(tree).toEqual([]);
  });

  it("renders the real depth rather than the prototype's three fixed levels", () => {
    const deep = [
      record("l0", "L0"),
      record("l1", "L1", "l0"),
      record("l2", "L2", "l1"),
      record("l3", "L3", "l2"),
      record("l4", "L4", "l3"),
    ];

    expect(flattenWorldTree(buildWorldTree(deep)).map((node) => node.depth)).toEqual([
      0, 1, 2, 3, 4,
    ]);
  });
});

describe("filterWorldTree", () => {
  const tree = buildWorldTree([REGION, ROUTE, HOUSE, CITY, OTHER]);

  it("returns the tree unchanged for a blank query", () => {
    expect(filterWorldTree(tree, "   ")).toHaveLength(2);
  });

  it("keeps the ancestors of a deep match so the path stays navigable", () => {
    const filtered = filterWorldTree(tree, "mr pokemon");

    expect(filtered.map((node) => node.name)).toEqual(["Johto"]);
    expect(filtered[0].children.map((node) => node.name)).toEqual(["Route 29"]);
    expect(filtered[0].children[0].children.map((node) => node.name)).toEqual([
      "Mr Pokemon House",
    ]);
  });

  it("keeps a matched node's whole subtree", () => {
    const filtered = filterWorldTree(tree, "route 29");

    expect(filtered[0].children[0].children).toHaveLength(1);
  });

  it("matches case-insensitively and drops non-matching branches", () => {
    const filtered = filterWorldTree(tree, "KANTO");

    expect(filtered.map((node) => node.name)).toEqual(["Kanto"]);
  });

  it("returns nothing when no location matches", () => {
    expect(filterWorldTree(tree, "no such place")).toEqual([]);
  });
});

describe("findWorldPath and selectWorldLocation", () => {
  const tree = buildWorldTree([REGION, ROUTE, HOUSE, CITY, OTHER]);

  it("returns the root-first path to a nested location", () => {
    expect(findWorldPath(tree, "house")?.map((node) => node.name)).toEqual([
      "Johto",
      "Route 29",
      "Mr Pokemon House",
    ]);
  });

  it("returns null for an unknown slug", () => {
    expect(findWorldPath(tree, "nowhere")).toBeNull();
  });

  it("expands every ancestor of the selection plus the selection itself", () => {
    const selection = selectWorldLocation(tree, "house");

    expect(selection?.selected.name).toBe("Mr Pokemon House");
    expect([...(selection?.expandedIds ?? [])].sort()).toEqual(
      ["house", "johto", "route-29"].sort(),
    );
  });

  it("falls back to the first root when the slug is missing or unknown", () => {
    expect(selectWorldLocation(tree, null)?.selected.name).toBe("Johto");
    expect(selectWorldLocation(tree, "nowhere")?.selected.name).toBe("Johto");
  });

  it("returns null when there are no locations at all", () => {
    expect(selectWorldLocation([], "anything")).toBeNull();
  });
});
