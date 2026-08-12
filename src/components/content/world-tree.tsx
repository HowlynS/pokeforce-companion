import Link from "next/link";
import type { WorldLocationNode } from "@/lib/world/world-tree";

type WorldTreeProps = {
  nodes: readonly WorldLocationNode[];
  selectedId: string;
  expandedIds: ReadonlySet<string>;
  /** Preserved on every node link so filtering survives navigation. */
  query: string;
};

function nodeHref(slug: string, query: string): string {
  const params = new URLSearchParams();
  params.set("location", slug);
  if (query) params.set("q", query);
  return `/world?${params.toString()}`;
}

/**
 * The handoff's region tree. Branch rows are real `<details>` disclosures so
 * expansion is keyboard-native and works without JavaScript; the node name
 * inside each `<summary>` is a link that selects the Location through the URL
 * (`?location=`), keeping the whole page server-rendered and linkable rather
 * than the prototype's client-only `selectedPath` state.
 *
 * Depth is whatever the real containment chain has. The handoff's three fixed
 * levels only drive styling: level 0 is the region row, level 1 the nested
 * row, and level 2+ reuse the leaf treatment.
 */
function WorldTreeNodes({
  nodes,
  selectedId,
  expandedIds,
  query,
}: WorldTreeProps) {
  return (
    <ul className="world-tree-list">
      {nodes.map((node) => {
        const level = Math.min(node.depth, 2);
        const selected = node.id === selectedId;
        const rowClassName =
          `world-tree-row world-tree-row--level-${level}` +
          (selected ? " world-tree-row--selected" : "");
        const label = (
          <Link
            href={nodeHref(node.slug, query)}
            className="world-tree-label"
            aria-current={selected ? "true" : undefined}
          >
            {node.name}
          </Link>
        );

        if (node.children.length === 0) {
          return (
            <li key={node.id}>
              <div className={`${rowClassName} world-tree-row--leaf`}>{label}</div>
            </li>
          );
        }

        return (
          <li key={node.id}>
            <details open={expandedIds.has(node.id) || undefined}>
              <summary className={rowClassName}>
                <span className="world-tree-chevron" aria-hidden="true">
                  <svg width={level === 0 ? 10 : 9} height={level === 0 ? 10 : 9} viewBox="0 0 24 24">
                    <path
                      d="M8 5l8 7-8 7"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      fill="none"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                {label}
              </summary>
              <div className="world-tree-branch">
                <WorldTreeNodes
                  nodes={node.children}
                  selectedId={selectedId}
                  expandedIds={expandedIds}
                  query={query}
                />
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}

export function WorldTree(props: WorldTreeProps) {
  return (
    <nav aria-label="World locations" className="world-tree">
      <WorldTreeNodes {...props} />
    </nav>
  );
}
