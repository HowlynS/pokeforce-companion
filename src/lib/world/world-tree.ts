import type { LocationType } from "@/lib/validation/location";

/**
 * Pure World Navigation tree helpers.
 *
 * The handoff's World screen shows a "region → route → building" tree. In
 * production the only real hierarchy primitive is `Location.parent`
 * (containment, per the Milestone 10 rule that hierarchy means containment,
 * not adjacency), so a "region" here is simply a topmost Location — the exact
 * same root derivation `/locations` and `/shops` already use for their own
 * grouping. The prototype's fixed three levels are NOT reproduced as a limit:
 * the real chain is rendered at whatever depth it actually has.
 *
 * Nothing here touches Prisma, so the tree shape, filtering, and selection are
 * unit-testable on plain records.
 */

export type WorldLocationRecord = {
  id: string;
  name: string;
  slug: string;
  type: LocationType;
  parentId: string | null;
};

export type WorldLocationNode = WorldLocationRecord & {
  depth: number;
  children: WorldLocationNode[];
};

/** Defensive bound mirroring loadLocationAncestors' own MAX_BREADCRUMB_ANCESTORS:
    the admin's wouldCreateLocationCycle guard should make a real cycle
    unreachable, but a self-relation is still worth defending in a renderer. */
const MAX_WORLD_DEPTH = 24;

function compareLocations(a: WorldLocationRecord, b: WorldLocationRecord): number {
  return a.name.localeCompare(b.name) || a.slug.localeCompare(b.slug);
}

/**
 * Builds the root-first containment tree. A Location is a root when it has no
 * parent, or when its parent is not present in the supplied set (a defensive
 * case: callers load every Location, so an orphan would otherwise vanish).
 */
export function buildWorldTree(
  locations: readonly WorldLocationRecord[],
): WorldLocationNode[] {
  const byId = new Map(locations.map((location) => [location.id, location]));
  const childrenByParent = new Map<string, WorldLocationRecord[]>();
  const roots: WorldLocationRecord[] = [];

  for (const location of locations) {
    const parentId =
      location.parentId && byId.has(location.parentId) ? location.parentId : null;
    if (!parentId) {
      roots.push(location);
      continue;
    }
    const siblings = childrenByParent.get(parentId);
    if (siblings) siblings.push(location);
    else childrenByParent.set(parentId, [location]);
  }

  const visited = new Set<string>();

  function toNode(record: WorldLocationRecord, depth: number): WorldLocationNode {
    visited.add(record.id);
    const children =
      depth >= MAX_WORLD_DEPTH
        ? []
        : (childrenByParent.get(record.id) ?? [])
            .filter((child) => !visited.has(child.id))
            .sort(compareLocations)
            .map((child) => toNode(child, depth + 1));
    return { ...record, depth, children };
  }

  return roots.sort(compareLocations).map((root) => toNode(root, 0));
}

/** Every node of the tree, depth-first, in render order. */
export function flattenWorldTree(
  nodes: readonly WorldLocationNode[],
): WorldLocationNode[] {
  return nodes.flatMap((node) => [node, ...flattenWorldTree(node.children)]);
}

/**
 * Name filter for the sidebar. A branch survives when the node itself matches
 * (keeping its whole subtree, so a matched region stays browsable) or when any
 * descendant matches (keeping the path down to it).
 */
export function filterWorldTree(
  nodes: readonly WorldLocationNode[],
  query: string,
): WorldLocationNode[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [...nodes];

  function visit(node: WorldLocationNode): WorldLocationNode | null {
    if (node.name.toLocaleLowerCase().includes(needle)) return node;
    const children = node.children
      .map(visit)
      .filter((child): child is WorldLocationNode => child !== null);
    return children.length > 0 ? { ...node, children } : null;
  }

  return nodes
    .map(visit)
    .filter((node): node is WorldLocationNode => node !== null);
}

/** Root-first path to the node with this slug, or null when absent. */
export function findWorldPath(
  nodes: readonly WorldLocationNode[],
  slug: string,
): WorldLocationNode[] | null {
  for (const node of nodes) {
    if (node.slug === slug) return [node];
    const childPath = findWorldPath(node.children, slug);
    if (childPath) return [node, ...childPath];
  }
  return null;
}

export type WorldSelection = {
  /** Root-first path including the selected node itself. */
  path: WorldLocationNode[];
  selected: WorldLocationNode;
  /** Ids whose branch must render expanded to reveal the selection. */
  expandedIds: Set<string>;
};

/**
 * Resolves `?location=` against the tree. An absent or unknown slug falls back
 * to the first root so the page always has a truthful selection rather than an
 * empty right pane; callers can detect the fallback by comparing slugs.
 */
export function selectWorldLocation(
  nodes: readonly WorldLocationNode[],
  slug: string | null,
): WorldSelection | null {
  if (nodes.length === 0) return null;
  const path = (slug ? findWorldPath(nodes, slug) : null) ?? [nodes[0]];
  return {
    path,
    selected: path[path.length - 1],
    // Ancestors expand; the selected node expands too, so its own children are
    // visible the moment it is chosen.
    expandedIds: new Set(path.map((node) => node.id)),
  };
}
